import test from "node:test";
import assert from "node:assert/strict";
import {
  PROGRAM_PROPOSAL_VERSION,
  applyProgramProposal,
  validateProgramProposal,
} from "../src/services/programProposal.js";

const exercise = (routineExerciseId, exerciseId, overrides = {}) => ({
  routineExerciseId, exerciseId, sets: 3, repRange: "8-12", restSeconds: 120,
  displayNameOverride: null, note: null, ...overrides,
});

const program = (id = "program-1") => ({
  id, name: "Current program", metadata: { keep: true },
  days: [
    { id: "upper-a", name: "Upper A", exercises: [exercise("row-a", "wger-1"), exercise("row-b", "wger-2")] },
    { id: "upper-b", name: "Upper B", exercises: [exercise("row-c", "wger-3"), exercise("row-d", "wger-4")] },
    { id: "lower-a", name: "Lower A", exercises: [exercise("row-e", "wger-5")] },
  ],
  completedWorkouts: [{ id: "history-1" }], activeWorkout: { id: "active-1" },
});

const createProposal = (days, overrides = {}) => ({
  id: "proposal-create", version: PROGRAM_PROPOSAL_VERSION, proposalType: "create_program",
  title: "Balanced plan", summary: "A complete balanced training week.",
  program: { id: "program-new", name: "New plan", days }, ...overrides,
});

const createDay = (id, rowId, overrides = {}) => ({
  id, name: id, exercises: [exercise(rowId, `wger-${rowId}`)], ...overrides,
});

const modifyProposal = (routineChanges, overrides = {}) => ({
  id: "proposal-modify", version: PROGRAM_PROPOSAL_VERSION, proposalType: "modify_program",
  targetProgramId: "program-1", title: "Progression update", summary: "Coordinate upper-body progression.",
  routineChanges, ...overrides,
});

test("create_program adds a normalized multi-routine program without mutating source state", () => {
  const programs = [program(), program("program-other")];
  const before = structuredClone(programs);
  const result = applyProgramProposal(programs, createProposal([
    { id: "upper-a-new", name: "Upper A", exercises: [
      { ...exercise("new-a", "wger-10"), proposalGroupKey: "pair" },
      { ...exercise("new-b", "wger-11"), proposalGroupKey: "pair" },
    ] },
    createDay("lower-new", "new-c"), createDay("full-new", "new-d"), createDay("arms-new", "new-e"),
  ]));
  assert.equal(result.applied, true);
  assert.equal(result.programs.length, 3);
  assert.deepEqual(result.programs.at(-1).days.map((day) => day.id), ["upper-a-new", "lower-new", "full-new", "arms-new"]);
  assert.equal(result.programs.at(-1).days[0].exercises[0].supersetGroupId, result.programs.at(-1).days[0].exercises[1].supersetGroupId);
  assert.equal("proposalGroupKey" in result.programs.at(-1).days[0].exercises[0], false);
  assert.deepEqual(programs, before);
  assert.equal(result.review.routines.length, 4);
});

test("create_program accepts five days and rejects collisions, invalid prescriptions, bad supersets, and oversized input", () => {
  const fiveDays = ["a", "b", "c", "d", "e"].map((id) => createDay(`routine-${id}`, `entry-${id}`));
  assert.equal(validateProgramProposal(createProposal(fiveDays), [program()]).valid, true);
  const cases = [
    [createProposal(fiveDays, { program: { id: "program-1", name: "Collision", days: fiveDays } }), "duplicate_program_id"],
    [createProposal([createDay("one", "same"), createDay("two", "same")]), "duplicate_routine_exercise_id"],
    [createProposal([createDay("one", "entry", { exercises: [exercise("entry", "wger-", { sets: 0, repRange: "10-4", restSeconds: 999 })] })]), "invalid_exercise_id"],
    [createProposal([{ id: "one", name: "One", exercises: [{ ...exercise("entry", "wger-1"), proposalGroupKey: "solo" }] }]), "invalid_superset_group"],
    [createProposal(Array.from({ length: 7 }, (_, index) => createDay(`r-${index}`, `e-${index}`))), "invalid_routine_count"],
    [createProposal([createDay("one", "entry", { exercises: Array.from({ length: 13 }, (_, index) => exercise(`row-${index}`, `wger-${index}`)) })]), "oversized_routine"],
  ];
  cases.forEach(([proposal, code]) => {
    const validation = validateProgramProposal(proposal, [program()]);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === code));
    assert.equal(applyProgramProposal([program()], proposal).applied, false);
  });
});

test("modify_program applies multiple routine changes atomically and preserves unrelated program state", () => {
  const programs = [program(), program("program-other")];
  const before = structuredClone(programs);
  const result = applyProgramProposal(programs, modifyProposal([
    { targetRoutineId: "upper-a", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-a", updates: { sets: 4 } }] },
    { targetRoutineId: "upper-b", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-c", updates: { repRange: "6-10" } }] },
    { targetRoutineId: "lower-a", changes: [{ type: "rename_routine", name: "Lower progression" }] },
  ]));
  assert.equal(result.applied, true);
  assert.equal(result.programs[0].days[0].exercises[0].sets, 4);
  assert.equal(result.programs[0].days[1].exercises[0].repRange, "6-10");
  assert.equal(result.programs[0].days[2].name, "Lower progression");
  assert.deepEqual(result.programs[0].completedWorkouts, before[0].completedWorkouts);
  assert.deepEqual(result.programs[0].activeWorkout, before[0].activeWorkout);
  assert.deepEqual(result.programs[1], before[1]);
  assert.deepEqual(programs, before);
});

test("modify_program rejects a missing target or invalid member without partial changes", () => {
  const programs = [program()];
  const before = structuredClone(programs);
  const cases = [
    [modifyProposal([{ targetRoutineId: "missing", changes: [] }]), "missing_target_routine"],
    [modifyProposal([
      { targetRoutineId: "upper-a", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-a", updates: { sets: 4 } }] },
      { targetRoutineId: "upper-b", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-c", updates: { restSeconds: -1 } }] },
    ]), "invalid_rest_seconds"],
    [modifyProposal([{ targetRoutineId: "upper-a", changes: [{ type: "remove_exercise", targetRoutineExerciseId: "row-a" }, { type: "move_exercise", targetRoutineExerciseId: "row-a", afterRoutineExerciseId: null }] }]), "missing_target_exercise"],
    [modifyProposal([{ targetRoutineId: "upper-a", changes: [] }, { targetRoutineId: "upper-a", changes: [] }]), "duplicate_routine_change"],
  ];
  cases.forEach(([proposal, code]) => {
    const result = applyProgramProposal(programs, proposal);
    assert.equal(result.applied, false);
    assert.equal(result.programs, null);
    assert.ok(result.errors.some((error) => error.code === code));
    assert.deepEqual(programs, before);
  });
});

test("program proposal module is a pure domain boundary", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/programProposal.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|savePrograms|persistProgramDrafts|setDoc|exerciseProvider|searchExercises|resolveProposedExercise/i);
});
