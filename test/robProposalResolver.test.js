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

test("proposal resolver supports a valid replace while refusing AI-supplied provider IDs", async () => {
  const candidate = { proposalType: "modify_routine", targetRoutineId: "routine-1", title: "Replace", summary: "Replace", changes: [{ type: "replace_exercise", targetRoutineExerciseId: "row-1", exercise: { exerciseRef: { query: "cable row", name: "Cable Row" }, exerciseId: "wger-invented", sets: 3, repRange: "8-12", restSeconds: 90 } }] };
  const result = await resolveRobProposalCandidate({ candidate, currentProgram: program, searchExercises: async () => [{ id: "wger-77", name: "Cable Row" }] });
  assert.equal(result.validation.valid, true);
  assert.equal(result.proposal.changes[0].exercise.exerciseId, "wger-77");
  assert.equal(result.proposal.changes[0].exercise.routineExerciseId, undefined);
});

test("proposal resolver keeps the validator authoritative for stale targets, anchors, supersets, and conflicts", async () => {
  const cases = [
    [{ type: "remove_exercise", targetRoutineExerciseId: "stale-row" }],
    [{ type: "move_exercise", targetRoutineExerciseId: "row-1", afterRoutineExerciseId: "stale-row" }],
    [{ type: "set_superset", proposalGroupKey: "pair", memberRoutineExerciseIds: ["row-1", "stale-row"] }],
    [{ type: "remove_exercise", targetRoutineExerciseId: "row-1" }, { type: "update_exercise", targetRoutineExerciseId: "row-1", updates: { sets: 4 } }]
  ];
  for (const changes of cases) {
    const result = await resolveRobProposalCandidate({ candidate: { proposalType: "modify_routine", targetRoutineId: "routine-1", title: "Invalid", summary: "Invalid", changes }, currentProgram: program });
    assert.equal(result.validation.valid, false);
    assert.equal(result.proposal, null);
  }
});

test("create proposal materialization uses Fitbot-generated routine and row IDs", async () => {
  const candidate = { proposalType: "create_routine", title: "New day", summary: "New day", routine: { name: "New Day", exercises: [{ exerciseRef: { query: "cable row", name: "Cable Row" }, sets: 3, repRange: "8-12", restSeconds: 90 }] } };
  const result = await resolveRobProposalCandidate({ candidate, currentProgram: program, searchExercises: async () => [{ id: "wger-77", name: "Cable Row" }] });
  assert.equal(result.validation.valid, true);
  assert.match(result.proposal.routine.id, /^routine-rob-/);
  assert.match(result.proposal.routine.exercises[0].routineExerciseId, /^ri-rob-/);
  assert.equal(result.proposal.routine.exercises[0].exerciseId, "wger-77");
});
