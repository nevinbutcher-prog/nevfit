import test from "node:test";
import assert from "node:assert/strict";
import { createRobReviewHandler } from "../src/index.js";
import { generateRobReview, parseReview, validateReviewContext } from "../src/rob/robReview.js";

const context = (requestType = "routine_review") => ({
  version: 1,
  requestType,
  target: requestType === "routine_review" ? { scope: "routine", programId: "program-1", routineId: "routine-1" } : { scope: "program", programId: "program-1", routineId: null },
  profile: { goals: ["Strength"] },
  program: { id: "program-1", routines: requestType === "routine_review" ? [{ id: "routine-1", exercises: [{ routineExerciseId: "exercise-1" }] }] : [{ id: "routine-1", exercises: [{ routineExerciseId: "exercise-1" }] }, { id: "routine-2", exercises: [{ routineExerciseId: "exercise-2" }] }] },
  history: { workouts: [] },
});

const response = (reviewType = "routine") => JSON.stringify({
  version: 1,
  reviewType,
  target: reviewType === "routine" ? { programId: "program-1", routineId: "routine-1" } : { programId: "program-1", routineId: null },
  summary: "A useful summary.",
  strengths: [{ title: "Good structure", explanation: "The supplied routine is clear.", routineIds: ["routine-1", "unknown"], routineExerciseIds: ["exercise-1", "unknown"] }],
  concerns: [],
  suggestedChanges: [{ title: "Consider rest", explanation: "Rest can support session flow.", priority: "medium", routineIds: ["unknown"], routineExerciseIds: ["exercise-1"] }],
  limitations: ["Recovery information is not supplied."],
});

test("authenticated routine review validates JSON, authoritative targets, and references", async () => {
  let calls = 0;
  const handler = createRobReviewHandler({ providerFactory: () => ({ generate: async () => { calls += 1; return { text: response(), model: "test", usage: {} }; } }) });
  const result = await handler({ auth: { uid: "verified" }, data: { context: context() } });
  assert.equal(calls, 1);
  assert.equal(result.review.target.programId, "program-1");
  assert.equal(result.review.target.routineId, "routine-1");
  assert.deepEqual(result.review.strengths[0].routineIds, ["routine-1"]);
  assert.deepEqual(result.review.strengths[0].routineExerciseIds, ["exercise-1"]);
});

test("program review permits active routines and invokes its provider once", async () => {
  let calls = 0;
  const result = await generateRobReview({ context: context("program_review") }, { provider: { generate: async () => { calls += 1; return { text: response("program"), model: "test", usage: {} }; } } });
  assert.equal(calls, 1);
  assert.equal(result.review.reviewType, "program");
  assert.equal(result.review.target.routineId, null);
});

test("review parser accepts one JSON fence and rejects prose, malformed JSON, invalid schema and arrays", () => {
  const reviewContext = context();
  assert.equal(parseReview(`\`\`\`json\n${response()}\n\`\`\``, reviewContext).summary, "A useful summary.");
  for (const value of [`Before ${response()}`, `${response()} after`, "{", "[]", response().replace('"medium"', '"urgent"'), response().replace('"program-1"', '"wrong-program"')]) {
    assert.throws(() => parseReview(value, reviewContext), (error) => error.code === "ai_invalid_response" && error.retryable);
  }
  const withoutLimitations = JSON.parse(response());
  delete withoutLimitations.limitations;
  assert.deepEqual(parseReview(JSON.stringify(withoutLimitations), reviewContext).limitations, []);
});

test("review request only accepts bounded, correctly-targeted review contexts", () => {
  assert.equal(validateReviewContext({ context: context() }).target.scope, "routine");
  for (const data of [{ context: { ...context(), requestType: "advice" } }, { context: { ...context(), target: { scope: "program", programId: "program-1", routineId: null } } }, { context: { ...context(), program: { id: "program-1", routines: [] } } }, { context: { ...context(), padding: "x".repeat(13000) } }]) {
    assert.throws(() => validateReviewContext(data), (error) => error.code === "ai_invalid_request");
  }
});
