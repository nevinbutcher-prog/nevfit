import test from "node:test";
import assert from "node:assert/strict";
import { createRobProposalHandler } from "../src/index.js";
import { parseRobProposal, validateRobProposalRequest } from "../src/rob/robProposal.js";

const context = { version: 1, requestType: "routine_review", target: { scope: "routine", programId: "program-1", routineId: "routine-1" }, program: { id: "program-1", routines: [{ id: "routine-1", exercises: [{ routineExerciseId: "row-1", exerciseId: "wger-1" }] }] } };
const request = { type: "modify_routine", instruction: "Prepare a safe candidate." };
const review = { summary: "Improve balance.", concerns: [{ title: "Low pulling volume", explanation: "The routine has little back work.", routineIds: ["routine-1"], routineExerciseIds: ["row-1"] }], suggestedChanges: [{ title: "Add a row", explanation: "Add one horizontal pulling movement.", priority: "medium", routineIds: ["routine-1"], routineExerciseIds: ["row-1"] }] };
const response = JSON.stringify({ version: 1, explanation: "A concise reason.", candidate: { proposalType: "modify_routine", targetProgramId: "program-1", targetRoutineId: "routine-1", title: "Refine rest", summary: "Adjust prescribed rest.", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-1", updates: { restSeconds: 90 } }] } });

test("authenticated Rob proposal receives bounded structured review findings and invokes provider once", async () => {
  let calls = 0;
  let messages;
  const handler = createRobProposalHandler({ providerFactory: () => ({ generate: async (input) => { calls += 1; messages = input.messages; return { text: response, model: "test", usage: {} }; } }) });
  const result = await handler({ auth: { uid: "verified" }, data: { context, request, review } });
  assert.equal(calls, 1);
  assert.equal(result.candidate.proposalType, "modify_routine");
  assert.equal(result.candidate.changes[0].targetRoutineExerciseId, "row-1");
  assert.match(messages[0].content, /only the supplied structured review recommendations/i);
  assert.match(messages[1].content, /STRUCTURED REVIEW FINDINGS/);
  assert.match(messages[1].content, /Low pulling volume/);
  assert.match(messages[1].content, /"routineIds":\["routine-1"\]/);
  assert.match(messages[1].content, /"routineExerciseIds":\["row-1"\]/);
});

test("proposal review input is bounded and does not accept arbitrary fields", () => {
  assert.throws(() => validateRobProposalRequest({ context, request }), (error) => error.code === "ai_invalid_request" && error.validationDiagnostic?.reason === "review_required");
  assert.throws(() => validateRobProposalRequest({ context, request, review: { ...review, strengths: [] } }), (error) => error.code === "ai_invalid_request" && error.validationDiagnostic?.reason === "review_shape");
});

test("proposal review references are revalidated against the routine context before prompting", () => {
  const checked = validateRobProposalRequest({ context, request, review: { ...review, concerns: [{ ...review.concerns[0], routineIds: ["routine-1", "stale-routine"], routineExerciseIds: ["row-1", "stale-row"] }] } });
  assert.deepEqual(checked.review.concerns[0].routineIds, ["routine-1"]);
  assert.deepEqual(checked.review.concerns[0].routineExerciseIds, ["row-1"]);
  assert.throws(() => validateRobProposalRequest({ context, request, review: { ...review, concerns: [{ ...review.concerns[0], routineIds: "routine-1" }] } }), (error) => error.code === "ai_invalid_request" && error.validationDiagnostic?.reason === "review_shape");
});

test("proposal parser rejects provider garbage, unsupported operations, and wrong types safely", () => {
  const unknownNestedOperationField = JSON.stringify({ ...JSON.parse(response), candidate: { ...JSON.parse(response).candidate, changes: [{ type: "remove_exercise", targetRoutineExerciseId: "row-1", providerNote: "untrusted" }] } });
  for (const value of ["", "{'version':1}", "[]", `before ${response}`, JSON.stringify({ ...JSON.parse(response), extra: true }), response.replace('"update_exercise"', '"save_program"'), response.replace('"modify_routine"', '"create_routine"'), unknownNestedOperationField]) {
    assert.throws(() => parseRobProposal(value, request), (error) => Boolean(error.code === "ai_invalid_response" && error.retryable && error.validationDiagnostic?.category));
  }
});
