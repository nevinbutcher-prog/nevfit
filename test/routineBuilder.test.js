import test from "node:test";
import assert from "node:assert/strict";
import {
  addRoutineExercise,
  createWorkoutSessionSnapshot,
  duplicateRoutineExercises,
  hasRoutineExercise,
  moveRoutineExercise,
  normalizeRoutineDay,
  removeRoutineExercise,
  replaceRoutineExercise,
  updateRoutineExerciseSuperset,
} from "../src/services/routineBuilder.js";

const entry = (routineExerciseId, exerciseId, overrides = {}) => ({
  routineExerciseId,
  exerciseId,
  sets: 3,
  repRange: "8-12",
  restSeconds: 120,
  supersetGroupId: null,
  ...overrides,
});

test("repeated Add preserves order and prevents duplicate provider IDs per routine", () => {
  const first = addRoutineExercise([], entry("row-1", "wger-1"));
  const second = addRoutineExercise(first.exercises, entry("row-2", "wger-2"));
  const duplicate = addRoutineExercise(second.exercises, entry("row-3", "wger-1"));

  assert.equal(first.added, true);
  assert.equal(second.added, true);
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.exercises, second.exercises);
  assert.deepEqual(second.exercises.map((item) => item.exerciseId), ["wger-1", "wger-2"]);
  assert.equal(hasRoutineExercise(second.exercises, "wger-1"), true);
  assert.equal(hasRoutineExercise([], "wger-1"), false, "the same exercise remains addable in another routine");
});

test("legacy and sparse routines normalize without destructive data loss", () => {
  const normalized = normalizeRoutineDay(
    {
      id: "routine-legacy",
      name: " Legacy Day ",
      exercises: [
        {
          exerciseId: "wger-1",
          sets: "3",
          groupId: "legacy-pair",
          displayNameOverride: " Machine Press ",
        },
        {
          exerciseId: "wger-2",
          sets: 4,
          repRange: "10-12",
          restSeconds: "90",
          groupId: "legacy-pair",
        },
      ],
    },
    null,
    (exerciseId) => exerciseId.startsWith("wger-"),
  );
  assert.equal(normalized.name, "Legacy Day");
  assert.deepEqual(normalized.exercises.map((item) => item.routineExerciseId), [
    "ri-routine-legacy-1",
    "ri-routine-legacy-2",
  ]);
  assert.equal(normalized.exercises[0].repRange, "8-12");
  assert.equal(normalized.exercises[0].restSeconds, null);
  assert.equal(normalized.exercises[0].displayNameOverride, "Machine Press");
  assert.equal(normalized.exercises[0].supersetGroupId, "legacy-pair");
  assert.equal(normalized.exercises[1].restSeconds, 90);
});

test("reorder keeps configuration and superset membership attached to stable rows", () => {
  const exercises = [
    entry("row-1", "wger-1", { note: "first" }),
    entry("row-2", "wger-2", { sets: 5, supersetGroupId: "ss-1" }),
    entry("row-3", "wger-3", { supersetGroupId: "ss-1" }),
  ];
  const moved = moveRoutineExercise(exercises, 1, -1);
  assert.deepEqual(moved.map((item) => item.routineExerciseId), ["row-2", "row-1", "row-3"]);
  assert.equal(moved[0].sets, 5);
  assert.equal(moved[0].supersetGroupId, "ss-1");
  assert.equal(exercises[1].routineExerciseId, "row-2");
});

test("swap preserves routine-row identity and prescription", () => {
  const exercises = [entry("row-1", "wger-1", { sets: 4, displayNameOverride: "Custom" })];
  const swapped = replaceRoutineExercise(exercises, 0, "wger-9");
  assert.equal(swapped[0].routineExerciseId, "row-1");
  assert.equal(swapped[0].exerciseId, "wger-9");
  assert.equal(swapped[0].sets, 4);
  assert.equal(swapped[0].displayNameOverride, "");
});

test("superset create, change, clear, delete, and duplicate-exercise targeting remain safe", () => {
  let groupNumber = 0;
  const createGroupId = () => `ss-${++groupNumber}`;
  const exercises = [
    entry("row-1", "wger-1"),
    entry("row-2", "wger-1"),
    entry("row-3", "wger-3"),
  ];
  const paired = updateRoutineExerciseSuperset(exercises, 0, 1, createGroupId);
  assert.equal(paired[0].supersetGroupId, "ss-1");
  assert.equal(paired[1].supersetGroupId, "ss-1");

  const changed = updateRoutineExerciseSuperset(paired, 0, 2, createGroupId);
  assert.equal(changed[0].supersetGroupId, "ss-2");
  assert.equal(changed[2].supersetGroupId, "ss-2");
  assert.equal(changed[1].supersetGroupId, null);

  const cleared = updateRoutineExerciseSuperset(changed, 0, null, createGroupId);
  assert.ok(cleared.every((item) => item.supersetGroupId === null));

  const repaired = updateRoutineExerciseSuperset(exercises, 0, 1, createGroupId);
  const afterDelete = removeRoutineExercise(repaired, 1);
  assert.equal(afterDelete[0].supersetGroupId, null);
  assert.equal(afterDelete[0].routineExerciseId, "row-1");
});

test("routine duplication copies configuration but creates independently editable row IDs", () => {
  const source = [entry("row-1", "wger-1", { note: "source" }), entry("row-2", "wger-2")];
  let id = 0;
  const duplicate = duplicateRoutineExercises(source, () => `copy-${++id}`);
  duplicate[0].sets = 6;
  assert.deepEqual(duplicate.map((item) => item.routineExerciseId), ["copy-1", "copy-2"]);
  assert.equal(duplicate[0].note, "source");
  assert.equal(source[0].sets, 3);
  assert.equal(source[0].routineExerciseId, "row-1");
});

test("workout snapshots preserve selected routine order, effective names, and prescription", () => {
  const history = [{ id: "completed-1", exerciseName: "Historical name" }];
  const activeWorkout = { id: "already-active", exercises: [] };
  const routine = {
    id: "routine-b",
    exercises: [
      entry("row-2", "wger-2", { sets: 2, repRange: "6-8", restSeconds: 90, displayNameOverride: "Cable Row", supersetGroupId: "ss-4" }),
      entry("row-1", "wger-1", { note: "Pause", supersetGroupId: "ss-4" }),
    ],
  };
  const snapshot = createWorkoutSessionSnapshot(
    { id: "tue" },
    routine,
    (exercise) => exercise.displayNameOverride || `Exercise ${exercise.exerciseId}`,
  );
  assert.equal(snapshot.scheduleDayId, "tue");
  assert.equal(snapshot.routineDayId, "routine-b");
  assert.deepEqual(snapshot.exercises.map((item) => item.exerciseId), ["wger-2", "wger-1"]);
  assert.deepEqual(snapshot.exercises[0], {
    exerciseId: "wger-2",
    exerciseName: "Cable Row",
    prescribedSets: 2,
    repRange: "6-8",
    note: undefined,
    restSeconds: 90,
    supersetGroupId: "ss-4",
    sets: [
      { setNumber: 1, weight: "", reps: "" },
      { setNumber: 2, weight: "", reps: "" },
    ],
  });
  assert.deepEqual(history, [{ id: "completed-1", exerciseName: "Historical name" }]);
  assert.deepEqual(activeWorkout, { id: "already-active", exercises: [] });
});

test("builder transformations have no persistence side effects", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL("../src/services/routineBuilder.js", import.meta.url),
      "utf8",
    ),
  );
  assert.doesNotMatch(
    source,
    /firebase|firestore|localStorage|sessionStorage|saveProgram|setDoc/,
  );
});
