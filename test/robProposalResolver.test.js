import test from "node:test";
import assert from "node:assert/strict";
import { resolveRobProposalCandidate } from "../src/services/rob/robProposalResolver.js";

const program = { id: "program-1", days: [{ id: "routine-1", name: "Routine", exercises: [{ routineExerciseId: "row-1", exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: 90 }] }] };

test("proposal resolver resolves an exact provider exercise, generates IDs, and validates without mutation", async () => {
  const before = structuredClone(program);
  const result = await resolveRobProposalCandidate({ candidate: { proposalType: "modify_routine", targetRoutineId: "routine-1", title: "Add raise", summary: "Add a raise.", changes: [{ type: "add_exercise", afterRoutineExerciseId: "row-1", exercise: { exerciseRef: { query: "cable lateral raise", name: "Cable Lateral Raise" }, sets: 3, repRange: "10-15", restSeconds: 90 } }] }, currentProgram: program, searchExercises: async () => [{ id: "wger-99", name: "Cable Lateral Raise" }] });
  assert.equal(result.validation.valid, true);
  assert.equal(result.proposal.changes[0].exercise.exerciseId, "wger-99");
  assert.match(result.proposal.changes[0].exercise.routineExerciseId, /^ri-rob-/);
  assert.deepEqual(program, before);
});

test("proposal resolver rejects ambiguous or unresolved provider exercises", async () => {
  const candidate = { proposalType: "modify_routine", targetRoutineId: "routine-1", title: "Add", summary: "Add", changes: [{ type: "add_exercise", afterRoutineExerciseId: "row-1", exercise: { exerciseRef: { query: "raise", name: "Cable Lateral Raise" }, sets: 3, repRange: "10-15", restSeconds: 90 } }] };
  for (const results of [[], [{ id: "wger-1", name: "Cable Lateral Raise" }, { id: "wger-2", name: "Cable Lateral Raise" }]]) await assert.rejects(() => resolveRobProposalCandidate({ candidate, currentProgram: program, searchExercises: async () => results }), (error) => error.code === "proposal_exercise_unresolved");
});
