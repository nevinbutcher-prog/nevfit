import test from "node:test";
import assert from "node:assert/strict";
import { createRobProgramGenerationHandler } from "../src/index.js";
import { generateRobProgramCandidate, parseProgramCandidate, validateProgramGenerationRequest } from "../src/rob/robProgramGeneration.js";

const requirements = { version: 1, goal: "hypertrophy", daysPerWeek: 3, sessionMinutes: 60, priorities: ["back"], environment: "commercial_gym", equipment: ["machines", "dumbbells"], constraints: "" };
const response = JSON.stringify({ version: 1, proposalType: "create_program", explanation: "A balanced three-day plan.", program: { name: "Three Day Build", summary: "A concise program.", days: ["Pull", "Push", "Legs"].map((name) => ({ name, focus: `${name} focus`, exercises: [{ exerciseRef: "Cable row", sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: null }] })) } });

test("authenticated whole-program generation returns a transient bounded candidate", async () => {
  let calls = 0;
  const handler = createRobProgramGenerationHandler({ providerFactory: () => ({ generate: async () => { calls += 1; return { text: response, model: "test", usage: {} }; } }) });
  const result = await handler({ auth: { uid: "verified" }, data: { requirements } });
  assert.equal(calls, 1);
  assert.equal(result.candidate.proposalType, "create_program");
  assert.equal(result.candidate.program.days.length, 3);
  assert.equal(result.candidate.program.days[0].exercises[0].exerciseRef, "Cable row");
});

test("whole-program candidates reject wrong routine counts and provider-supplied IDs", () => {
  assert.throws(() => parseProgramCandidate(response.replace('"Legs"', '"Legs", "Upper"'), requirements), (error) => error.code === "ai_invalid_response");
  assert.throws(() => parseProgramCandidate(response.replace('"exerciseRef":"Cable row"', '"exerciseId":"provider-id","exerciseRef":"Cable row"'), requirements), (error) => error.code === "ai_invalid_response");
});

test("whole-program generation accepts only confirmed intake-shaped requests", () => {
  assert.throws(() => validateProgramGenerationRequest({ requirements: { ...requirements, persistence: true } }), (error) => error.code === "ai_invalid_request");
  assert.throws(() => validateProgramGenerationRequest({ requirements: { ...requirements, daysPerWeek: 7 } }), (error) => error.code === "ai_invalid_request");
});

test("malformed confirmed requirements are rejected before the provider is called", async () => {
  const invalidRequirements = [
    { ...requirements, goal: "unsupported" },
    { ...requirements, goal: "other", goalDescription: "   " },
    { ...requirements, environment: "garage" },
    { ...requirements, priorities: ["mobility"] },
    { ...requirements, priorities: ["back", "back"] },
    { ...requirements, priorities: ["back", "arms", "chest", "legs", "core", "glutes", "shoulders"] },
    { ...requirements, equipment: ["machines", "machines"] },
    { ...requirements, equipment: ["kettlebells"] },
    { ...requirements, equipment: ["machines", "dumbbells", "barbell", "cables", "bench", "pull_up_equipment", "machines-2", "machines-3", "machines-4"] },
    { ...requirements, goalDescription: "x".repeat(161) },
    { ...requirements, priorityNote: "x".repeat(241) },
    { ...requirements, equipmentOther: "x".repeat(161) },
    { ...requirements, constraints: "x".repeat(361) },
  ];
  for (const candidate of invalidRequirements) {
    let calls = 0;
    await assert.rejects(() => handler({ auth: { uid: "verified" }, data: { requirements: candidate } }), (error) => error.code === "invalid-argument");
    assert.equal(calls, 0);
    function handler(request) { return createRobProgramGenerationHandler({ providerFactory: () => ({ generate: async () => { calls += 1; return { text: response, model: "test", usage: {} }; } }) })(request); }
  }
});

test("three, four, and five day confirmed requirements are accepted", () => {
  for (const daysPerWeek of [3, 4, 5]) assert.deepEqual(validateProgramGenerationRequest({ requirements: { ...requirements, daysPerWeek } }).requirements.daysPerWeek, daysPerWeek);
});

test("candidate prescriptions and routine-local supersets are strict", () => {
  const parsed = JSON.parse(response);
  for (const valid of ["8", "8-12", "12-15"]) {
    const candidate = structuredClone(parsed);
    candidate.program.days[0].exercises[0].repRange = valid;
    assert.doesNotThrow(() => parseProgramCandidate(JSON.stringify(candidate), requirements));
  }
  for (const invalid of ["banana", "12-8", "0-10", "8-200"]) {
    const candidate = structuredClone(parsed);
    candidate.program.days[0].exercises[0].repRange = invalid;
    assert.throws(() => parseProgramCandidate(JSON.stringify(candidate), requirements), (error) => error.code === "ai_invalid_response");
  }
  for (const invalid of [[], {}, 2, true, "   ", "bad key!"]) {
    const candidate = structuredClone(parsed);
    candidate.program.days[0].exercises[0].proposalGroupKey = invalid;
    assert.throws(() => parseProgramCandidate(JSON.stringify(candidate), requirements), (error) => error.code === "ai_invalid_response");
  }
  const singleMember = structuredClone(parsed);
  singleMember.program.days[0].exercises[0].proposalGroupKey = "pair-1";
  assert.throws(() => parseProgramCandidate(JSON.stringify(singleMember), requirements), (error) => error.code === "ai_invalid_response");
  const paired = structuredClone(parsed);
  paired.program.days[0].exercises.push({ exerciseRef: "Pulldown", sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: "pair-1" });
  paired.program.days[0].exercises[0].proposalGroupKey = "pair-1";
  assert.doesNotThrow(() => parseProgramCandidate(JSON.stringify(paired), requirements));
  const oneInvalidExercise = structuredClone(paired);
  oneInvalidExercise.program.days[0].exercises[1].sets = 0;
  assert.throws(() => parseProgramCandidate(JSON.stringify(oneInvalidExercise), requirements), (error) => error.code === "ai_invalid_response");
});

test("whole-program generation uses its bounded budget without changing routine generation", async () => {
  let received;
  const handler = createRobProgramGenerationHandler({
    config: { model: "test-model", programMaxOutputTokens: 4000 },
    providerFactory: () => ({ generate: async (request) => { received = request; return { text: response, model: "test", usage: { outputTokens: 900 }, finishReason: "stop" }; } }),
  });
  await handler({ auth: { uid: "verified" }, data: { requirements } });
  assert.equal(received.maxOutputTokens, 4000);
});

test("truncated output is classified from the provider finish reason without a retry", async () => {
  let calls = 0;
  await assert.rejects(
    () => generateRobProgramCandidate({ requirements }, { provider: { generate: async () => { calls += 1; return { text: response.slice(0, -20), model: "test", usage: { outputTokens: 1200 }, finishReason: "length" }; } }, maxOutputTokens: 4000 }),
    (error) => error.code === "ai_invalid_response"
      && error.programGenerationFailureCategory === "output_exhausted"
      && error.programGenerationDiagnostic.providerFinishReason === "length"
      && error.programGenerationDiagnostic.providerOutputTokens === 1200
      && error.programGenerationDiagnostic.responseCharacterLength > 0,
  );
  assert.equal(calls, 1);
});

test("realistic three-, four-, and five-day candidates remain complete under the program budget", async () => {
  for (const daysPerWeek of [3, 4, 5]) {
    const candidate = JSON.parse(response);
    candidate.program.days = Array.from({ length: daysPerWeek }, (_, day) => ({
      name: `Day ${day + 1}`,
      focus: "Hypertrophy focus",
      exercises: Array.from({ length: 6 }, (_, exercise) => ({ exerciseRef: `Exercise ${day}-${exercise}`, sets: 3, repRange: "8-12", restSeconds: 90, note: "Controlled repetitions.", proposalGroupKey: null })),
    }));
    candidate.explanation = "A coordinated progression-focused weekly plan.";
    const raw = JSON.stringify(candidate);
    assert.ok(raw.length < 4000 * 4);
    const result = await generateRobProgramCandidate({ requirements: { ...requirements, daysPerWeek } }, { provider: { generate: async () => ({ text: raw, model: "test", usage: { outputTokens: 2500 }, finishReason: "stop" }) }, maxOutputTokens: 4000 });
    assert.equal(result.candidate.program.days.length, daysPerWeek);
  }
});

test("invalid complete candidate remains rejected with validation diagnostics", async () => {
  const invalidCandidate = JSON.parse(response);
  invalidCandidate.program.days[0].exercises[0].sets = 0;
  await assert.rejects(
    () => generateRobProgramCandidate({ requirements }, { provider: { generate: async () => ({ text: JSON.stringify(invalidCandidate), model: "test", usage: { outputTokens: 400 }, finishReason: "stop" }) }, maxOutputTokens: 4000 }),
    (error) => error.code === "ai_invalid_response" && error.programGenerationFailureCategory === "candidate_validation" && error.programGenerationDiagnostic.routineCount === 3,
  );
});