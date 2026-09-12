import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTINE_PROPOSAL_VERSION,
  applyRoutineProposal,
  validateRoutineProposal,
} from "../src/services/routineProposal.js";

const exercise = (routineExerciseId, exerciseId, overrides = {}) => ({
  routineExerciseId,
  exerciseId,
  sets: 3,
  repRange: "8-12",
  restSeconds: 120,
  supersetGroupId: null,
  ...overrides,
});

const createProgram = () => ({
  id: "program-1",
  name: "Program",
  days: [
    {
      id: "routine-a",
      name: "Routine A",
      exercises: [
        exercise("entry-a", "wger-1"),
        exercise("entry-b", "wger-2", { note: "Keep this" }),
        exercise("entry-c", "wger-3"),
      ],
    },
  ],
  completedWorkouts: [{ id: "history-1", exercises: [{ exerciseId: "wger-1" }] }],
  activeWorkout: { id: "active-1", exercises: [{ exerciseId: "wger-2" }] },
});

const modifyProposal = (changes, overrides = {}) => ({
  id: "proposal-1",
  version: ROUTINE_PROPOSAL_VERSION,
  proposalType: "modify_routine",
  targetProgramId: "program-1",
  targetRoutineId: "routine-a",
  title: "Routine adjustment",
  summary: "A readable summary",
  changes,
  ...overrides,
});

test("create_routine preserves order, translates local groups, and does not mutate or persist", () => {
  const program = createProgram();
  const before = structuredClone(program);
  let writes = 0;
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { setItem: () => { writes += 1; } };
  const proposal = {
    id: "create-1",
    version: 1,
    proposalType: "create_routine",
    targetProgramId: "program-1",
    title: "Create lower day",
    summary: "Adds a paired lower-body routine.",
    routine: {
      id: "routine-b",
      name: "Lower",
      exercises: [
        { ...exercise("entry-d", "wger-4"), proposalGroupKey: "lower-pair" },
        { ...exercise("entry-e", "wger-5"), proposalGroupKey: "lower-pair" },
        exercise("entry-f", "wger-6"),
      ],
    },
  };

  try {
    const result = applyRoutineProposal(program, proposal);
    assert.equal(result.applied, true);
    const created = result.program.days[1];
    assert.equal(created.id, "routine-b");
    assert.deepEqual(created.exercises.map((item) => item.routineExerciseId), ["entry-d", "entry-e", "entry-f"]);
    assert.match(created.exercises[0].supersetGroupId, /^ss-proposal-/);
    assert.equal(created.exercises[0].supersetGroupId, created.exercises[1].supersetGroupId);
    assert.equal(created.exercises[2].supersetGroupId, null);
    assert.equal("proposalGroupKey" in created.exercises[0], false);
    assert.deepEqual(program, before);
    assert.equal(writes, 0);
  } finally {
    globalThis.localStorage = previousLocalStorage;
  }
});

test("update_exercise changes the complete editable prescription and keeps review intent", () => {
  const proposal = modifyProposal([{
    type: "update_exercise",
    targetRoutineExerciseId: "entry-a",
    updates: {
      sets: 4,
      repRange: "6 - 10",
      restSeconds: 90,
      displayNameOverride: "Machine Press",
      note: "Controlled eccentric",
    },
  }]);
  const result = applyRoutineProposal(createProgram(), proposal);
  const updated = result.program.days[0].exercises[0];
  assert.deepEqual(
    { sets: updated.sets, repRange: updated.repRange, restSeconds: updated.restSeconds, displayNameOverride: updated.displayNameOverride, note: updated.note },
    { sets: 4, repRange: "6-10", restSeconds: 90, displayNameOverride: "Machine Press", note: "Controlled eccentric" },
  );
  assert.equal(result.review.title, proposal.title);
  assert.equal(result.review.changes[0].targetRoutineExerciseId, "entry-a");
  assert.deepEqual(proposal.changes[0].updates, {
    sets: 4, repRange: "6 - 10", restSeconds: 90,
    displayNameOverride: "Machine Press", note: "Controlled eccentric",
  });
});

test("add, remove, replace, and move target stable entry IDs deterministically", () => {
  const result = applyRoutineProposal(createProgram(), modifyProposal([
    { type: "add_exercise", afterRoutineExerciseId: "entry-a", exercise: exercise("entry-new", "wger-9", { sets: 2 }) },
    { type: "remove_exercise", targetRoutineExerciseId: "entry-b" },
    { type: "replace_exercise", targetRoutineExerciseId: "entry-c", exercise: exercise(undefined, "wger-8", { sets: 5, repRange: "5", restSeconds: 180 }) },
    { type: "move_exercise", targetRoutineExerciseId: "entry-c", afterRoutineExerciseId: null },
  ]));
  assert.equal(result.applied, true);
  const items = result.program.days[0].exercises;
  assert.deepEqual(items.map((item) => item.routineExerciseId), ["entry-c", "entry-a", "entry-new"]);
  assert.equal(items[0].exerciseId, "wger-8");
  assert.deepEqual({ sets: items[0].sets, repRange: items[0].repRange, restSeconds: items[0].restSeconds }, { sets: 5, repRange: "5", restSeconds: 180 });
  assert.equal(items[2].exerciseId, "wger-9");
});

test("set_superset is deterministic and clear_superset removes the whole grouping", () => {
  const proposal = modifyProposal([{
    type: "set_superset",
    proposalGroupKey: "pair-1",
    memberRoutineExerciseIds: ["entry-a", "entry-b"],
  }]);
  const first = applyRoutineProposal(createProgram(), proposal);
  const second = applyRoutineProposal(createProgram(), proposal);
  const firstGroup = first.program.days[0].exercises[0].supersetGroupId;
  assert.equal(firstGroup, first.program.days[0].exercises[1].supersetGroupId);
  assert.equal(firstGroup, second.program.days[0].exercises[0].supersetGroupId);

  const cleared = applyRoutineProposal(first.program, modifyProposal([{
    type: "clear_superset",
    targetRoutineExerciseId: "entry-a",
  }], { id: "proposal-2" }));
  assert.equal(cleared.program.days[0].exercises[0].supersetGroupId, null);
  assert.equal(cleared.program.days[0].exercises[1].supersetGroupId, null);
});

test("removal cleans an orphaned superset without touching unrelated entries", () => {
  const program = createProgram();
  program.days[0].exercises[0].supersetGroupId = "ss-existing";
  program.days[0].exercises[1].supersetGroupId = "ss-existing";
  const result = applyRoutineProposal(program, modifyProposal([{
    type: "remove_exercise",
    targetRoutineExerciseId: "entry-b",
  }]));
  assert.deepEqual(result.program.days[0].exercises.map((item) => item.routineExerciseId), ["entry-a", "entry-c"]);
  assert.equal(result.program.days[0].exercises[0].supersetGroupId, null);
  assert.equal(result.program.days[0].exercises[1].exerciseId, "wger-3");
});

test("invalid proposals return structured errors and no partial draft", () => {
  const cases = [
    [modifyProposal([], { version: 99 }), "unsupported_version"],
    [modifyProposal([{ type: "invent_operation" }]), "invalid_operation"],
    [modifyProposal([], { targetRoutineId: "missing" }), "missing_target_routine"],
    [modifyProposal([{ type: "remove_exercise", targetRoutineExerciseId: "missing" }]), "missing_target_exercise"],
    [modifyProposal([{ type: "update_exercise", targetRoutineExerciseId: "entry-a", updates: { sets: 0, repRange: "12-8", restSeconds: 999 } }]), "invalid_sets"],
    [modifyProposal([{ type: "remove_exercise", targetRoutineExerciseId: "entry-a" }, { type: "move_exercise", targetRoutineExerciseId: "entry-a", afterRoutineExerciseId: null }]), "missing_target_exercise"],
    [modifyProposal([{ type: "move_exercise", targetRoutineExerciseId: "entry-a", afterRoutineExerciseId: "entry-a" }]), "invalid_reorder_target"],
    [modifyProposal([{ type: "set_superset", proposalGroupKey: "pair", memberRoutineExerciseIds: ["entry-a", "entry-a"] }]), "invalid_superset_group"],
  ];
  cases.forEach(([proposal, expectedCode]) => {
    const validation = validateRoutineProposal(proposal, createProgram());
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === expectedCode));
    assert.ok(validation.errors.every((error) => typeof error.path === "string" && typeof error.message === "string"));
    const result = applyRoutineProposal(createProgram(), proposal);
    assert.equal(result.applied, false);
    assert.equal(result.program, null);
  });
});

test("application leaves the entire source graph, history, and active workout unchanged", () => {
  const program = createProgram();
  const before = structuredClone(program);
  const result = applyRoutineProposal(program, modifyProposal([{
    type: "update_exercise",
    targetRoutineExerciseId: "entry-a",
    updates: { sets: 4 },
  }]));
  assert.equal(result.applied, true);
  assert.notEqual(result.program, program);
  assert.deepEqual(program, before);
  assert.deepEqual(result.program.completedWorkouts, before.completedWorkouts);
  assert.deepEqual(result.program.activeWorkout, before.activeWorkout);
});

test("proposal module has no persistence dependencies", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/routineProposal.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|saveProgram|setDoc/);
});
