import test from "node:test";
import assert from "node:assert/strict";
import { createRobProgramGenerationHandler } from "../src/index.js";
import { assessProgramQuality, generateRobProgramCandidate, parseProgramCandidate, programCandidateResponseFormat, programGenerationMessages, validateProgramGenerationRequest } from "../src/rob/robProgramGeneration.js";

const catalogue = { version: 2, ids: ["wger-73", "wger-76", "wger-145", "wger-371", "wger-458", "wger-475", "wger-567", "wger-723", "wger-1370"] };
const requirements = { version: 1, goal: "hypertrophy", daysPerWeek: 3, sessionMinutes: 60, priorities: ["back"], environment: "commercial_gym", equipment: ["machines", "dumbbells"], constraints: "" };
const response = JSON.stringify({ version: 1, proposalType: "create_program", explanation: "A balanced three-day plan.", program: { name: "Three Day Build", summary: "A concise program.", days: ["Pull", "Push", "Legs"].map((name) => ({ name, focus: `${name} focus`, exercises: [{ exerciseId: "wger-73", sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: null }] })) } });

test("authenticated whole-program generation returns a transient bounded candidate", async () => {
  let calls = 0;
  const handler = createRobProgramGenerationHandler({ providerFactory: () => ({ generate: async () => { calls += 1; return { text: response, model: "test", usage: {} }; } }) });
  const result = await handler({ auth: { uid: "verified" }, data: { requirements, catalogue } });
  assert.equal(calls, 1);
  assert.equal(result.candidate.proposalType, "create_program");
  assert.equal(result.candidate.program.days.length, 3);
  assert.equal(result.candidate.program.days[0].exercises[0].exerciseId, "wger-73");
});

test("whole-program candidates reject wrong routine counts and provider-supplied IDs", () => {
  assert.throws(() => parseProgramCandidate(response.replace('"Legs"', '"Legs", "Upper"'), requirements), (error) => error.code === "ai_invalid_response");
  assert.throws(() => parseProgramCandidate(response.replace('"exerciseId":"wger-73"', '"forged":"provider-id","exerciseId":"wger-73"'), requirements), (error) => error.code === "ai_invalid_response");
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
  for (const daysPerWeek of [3, 4, 5]) assert.deepEqual(validateProgramGenerationRequest({ requirements: { ...requirements, daysPerWeek }, catalogue }).requirements.daysPerWeek, daysPerWeek);
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
  const recovered = parseProgramCandidate(JSON.stringify(singleMember), requirements);
  assert.equal(recovered.candidate.program.days[0].exercises[0].proposalGroupKey, null);
  const paired = structuredClone(parsed);
  paired.program.days[0].exercises.push({ exerciseId: "wger-723", sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: "pair-1" });
  paired.program.days[0].exercises[0].proposalGroupKey = "pair-1";
  assert.doesNotThrow(() => parseProgramCandidate(JSON.stringify(paired), requirements));
  const oneInvalidExercise = structuredClone(paired);
  oneInvalidExercise.program.days[0].exercises[1].sets = 0;
  assert.throws(() => parseProgramCandidate(JSON.stringify(oneInvalidExercise), requirements), (error) => error.code === "ai_invalid_response");
});

test("orphaned supersets are recovered routine-locally without changing prescriptions", () => {
  const candidate = JSON.parse(response);
  const first = candidate.program.days[0].exercises[0];
  first.proposalGroupKey = "shared-key";
  candidate.program.days[1].exercises[0].proposalGroupKey = "shared-key";
  const originalPrescription = { exerciseId: first.exerciseId, sets: first.sets, repRange: first.repRange, restSeconds: first.restSeconds, note: first.note };

  const parsed = parseProgramCandidate(JSON.stringify(candidate), requirements);
  const recovered = parsed.candidate.program.days;
  assert.equal(recovered[0].exercises[0].proposalGroupKey, null);
  assert.equal(recovered[1].exercises[0].proposalGroupKey, null);
  assert.deepEqual({ exerciseId: recovered[0].exercises[0].exerciseId, sets: recovered[0].exercises[0].sets, repRange: recovered[0].exercises[0].repRange, restSeconds: recovered[0].exercises[0].restSeconds, note: recovered[0].exercises[0].note }, originalPrescription);
});

test("valid routine-local supersets remain unchanged", () => {
  const candidate = JSON.parse(response);
  candidate.program.days[0].exercises.push({ exerciseId: "wger-723", sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: "pair-1" });
  candidate.program.days[0].exercises[0].proposalGroupKey = "pair-1";

  const parsed = parseProgramCandidate(JSON.stringify(candidate), requirements);
  assert.equal(parsed.candidate.program.days[0].exercises[0].proposalGroupKey, "pair-1");
  assert.equal(parsed.candidate.program.days[0].exercises[1].proposalGroupKey, "pair-1");
});

test("whole-program generation uses its bounded budget without changing routine generation", async () => {
  let received;
  const handler = createRobProgramGenerationHandler({
    config: { model: "test-model", programMaxOutputTokens: 4000 },
    providerFactory: () => ({ generate: async (request) => { received = request; return { text: response, model: "test", usage: { outputTokens: 900 }, finishReason: "stop" }; } }),
  });
  await handler({ auth: { uid: "verified" }, data: { requirements, catalogue } });
  assert.equal(received.maxOutputTokens, 4000);
  assert.equal(received.responseFormat, programCandidateResponseFormat);
  assert.equal(received.requireResponseFormat, true);
});

test("truncated output is classified from the provider finish reason without a retry", async () => {
  let calls = 0;
  await assert.rejects(
    () => generateRobProgramCandidate({ requirements, catalogue }, { provider: { generate: async () => { calls += 1; return { text: response.slice(0, -20), model: "test", usage: { outputTokens: 1200 }, finishReason: "length" }; } }, maxOutputTokens: 4000 }),
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
      exercises: Array.from({ length: 6 }, (_, exercise) => ({ exerciseId: catalogue.ids[exercise % catalogue.ids.length], sets: 3, repRange: "8-12", restSeconds: 90, note: "Controlled repetitions.", proposalGroupKey: null })),
    }));
    candidate.explanation = "A coordinated progression-focused weekly plan.";
    const raw = JSON.stringify(candidate);
    assert.ok(raw.length < 4000 * 4);
    const result = await generateRobProgramCandidate({ requirements: { ...requirements, daysPerWeek }, catalogue }, { provider: { generate: async () => ({ text: raw, model: "test", usage: { outputTokens: 2500 }, finishReason: "stop" }) }, maxOutputTokens: 4000 });
    assert.equal(result.candidate.program.days.length, daysPerWeek);
  }
});

test("invalid complete candidate remains rejected with validation diagnostics", async () => {
  const invalidCandidate = JSON.parse(response);
  invalidCandidate.program.days[0].exercises[0].sets = 0;
  await assert.rejects(
    () => generateRobProgramCandidate({ requirements, catalogue }, { provider: { generate: async () => ({ text: JSON.stringify(invalidCandidate), model: "test", usage: { outputTokens: 400 }, finishReason: "stop" }) }, maxOutputTokens: 4000 }),
    (error) => error.code === "ai_invalid_response" && error.programGenerationFailureCategory === "candidate_validation" && error.programGenerationDiagnostic.routineCount === 3 && error.validationDiagnostic.routineIndex === 0 && error.validationDiagnostic.exerciseIndex === 0 && error.validationDiagnostic.field === "sets" && error.validationDiagnostic.fieldReason === "unsupported_format",
  );
});
test("four-day hypertrophy instructions encourage practical workload and coverage without a fixed minimum", () => {
  const messages = programGenerationMessages({ ...requirements, daysPerWeek: 4, sessionMinutes: 60, priorities: ["shoulders", "arms"] });
  assert.match(messages[0].content, /4-7 exercises/);
  assert.match(messages[0].content, /priorities and the muscle groups needed for a balanced program/);
  assert.match(messages[0].content, /not a fixed minimum/);
  const shortSession = structuredClone(JSON.parse(response));
  shortSession.program.days = [shortSession.program.days[0]];
  assert.doesNotThrow(() => parseProgramCandidate(JSON.stringify(shortSession), { ...requirements, daysPerWeek: 1, sessionMinutes: 20 }));
});

test("server owns the catalogue and rejects fabricated, stale, or undersized browser catalogues", () => {
  assert.doesNotThrow(() => validateProgramGenerationRequest({ requirements, catalogue: { version: 2, ids: ["wger-73"] } }));
  assert.throws(() => validateProgramGenerationRequest({ requirements, catalogue: { version: 1, ids: [...catalogue.ids.slice(0, 8), "wger-forged"] } }), (error) => error.validationDiagnostic?.reason === "catalogue");
  assert.throws(() => validateProgramGenerationRequest({ requirements, catalogue: { version: 1, ids: catalogue.ids } }), (error) => error.validationDiagnostic?.reason === "catalogue");
  const forged = JSON.parse(response);
  forged.program.days[0].exercises[0].exerciseId = "wger-forged";
  assert.throws(() => parseProgramCandidate(JSON.stringify(forged), requirements, { entries: catalogue.ids.map((id) => ({ id })) }), (error) => error.validationDiagnostic?.fieldReason === "out_of_catalogue");
});

test("quality assessment flags clearly underfilled longer sessions without rejecting valid programs", () => {
  const candidate = JSON.parse(response).program;
  assert.ok(assessProgramQuality({ program: candidate }, { sessionMinutes: 45 }).concerns.length > 0);
  assert.ok(assessProgramQuality({ program: candidate }, { sessionMinutes: 60 }).concerns.length > 0);
  assert.ok(assessProgramQuality({ program: candidate }, { sessionMinutes: 75 }).concerns.every((concern) => concern.code === "underfilled_duration"));
});
