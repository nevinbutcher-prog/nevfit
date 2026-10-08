import test from "node:test";
import assert from "node:assert/strict";
import { createRobProgramGenerationHandler } from "../src/index.js";
import { parseProgramCandidate, validateProgramGenerationRequest } from "../src/rob/robProgramGeneration.js";

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
