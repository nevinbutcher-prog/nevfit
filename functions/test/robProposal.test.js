import test from "node:test";
import assert from "node:assert/strict";
import { createRobProposalHandler } from "../src/index.js";
import { parseRobProposal } from "../src/rob/robProposal.js";

const context = { version: 1, requestType: "routine_review", target: { scope: "routine", programId: "program-1", routineId: "routine-1" }, program: { id: "program-1", routines: [{ id: "routine-1", exercises: [{ routineExerciseId: "row-1", exerciseId: "wger-1" }] }] } };
const request = { type: "modify_routine", instruction: "Prepare a safe candidate." };
const response = JSON.stringify({ version: 1, explanation: "A concise reason.", candidate: { proposalType: "modify_routine", targetProgramId: "program-1", targetRoutineId: "routine-1", title: "Refine rest", summary: "Adjust prescribed rest.", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-1", updates: { restSeconds: 90 } }] } });

test("authenticated Rob proposal parses one candidate and invokes provider once", async () => {
  let calls = 0;
  const handler = createRobProposalHandler({ providerFactory: () => ({ generate: async () => { calls += 1; return { text: response, model: "test", usage: {} }; } }) });
  const result = await handler({ auth: { uid: "verified" }, data: { context, request } });
  assert.equal(calls, 1);
  assert.equal(result.candidate.proposalType, "modify_routine");
  assert.equal(result.candidate.changes[0].targetRoutineExerciseId, "row-1");
});

test("proposal parser rejects provider garbage, unsupported operations, and wrong types safely", () => {
  for (const value of ["", "{'version':1}", "[]", `before ${response}`, JSON.stringify({ ...JSON.parse(response), extra: true }), response.replace('"update_exercise"', '"save_program"'), response.replace('"modify_routine"', '"create_routine"')]) {
    assert.throws(() => parseRobProposal(value, request), (error) => Boolean(error.code === "ai_invalid_response" && error.retryable && error.validationDiagnostic?.category));
  }
});
