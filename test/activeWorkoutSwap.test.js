import test from "node:test";
import assert from "node:assert/strict";
import {
  restoreSwappedWorkoutExercise,
  swapActiveWorkoutExercise,
} from "../src/services/activeWorkoutSwap.js";

const workout = () => ({
  scheduleDayId: "mon",
  routineDayId: "routine-a",
  exercises: [
    {
      exerciseId: "wger-leg-press",
      exerciseName: "Leg Press",
      prescribedSets: 3,
      repRange: "8-12",
      restSeconds: 120,
      supersetGroupId: "ss-1",
      sets: [
        { setNumber: 1, weight: "", reps: "" },
        { setNumber: 2, weight: "", reps: "" },
        { setNumber: 3, weight: "", reps: "" },
      ],
    },
    {
      exerciseId: "wger-row",
      exerciseName: "Cable Row",
      prescribedSets: 3,
      repRange: "8-12",
      restSeconds: 120,
      supersetGroupId: "ss-1",
      sets: [{ setNumber: 1, weight: "", reps: "" }],
    },
  ],
});

test("pre-logging swap replaces the performed exercise and retains original context", () => {
  const source = workout();
  const result = swapActiveWorkoutExercise(source, 0, {
    id: "wger-hack-squat",
    name: "Hack Squat",
  });
  assert.equal(result.swapped, true);
  const swapped = result.workout.exercises[0];
  assert.equal(swapped.exerciseId, "wger-hack-squat");
  assert.equal(swapped.exerciseName, "Hack Squat");
  assert.equal(swapped.originalExerciseId, "wger-leg-press");
  assert.equal(swapped.originalExerciseName, "Leg Press");
  assert.equal(swapped.prescribedSets, 3);
  assert.equal(swapped.repRange, "8-12");
  assert.equal(swapped.restSeconds, 120);
  assert.equal(swapped.supersetGroupId, "ss-1");
  assert.deepEqual(source.exercises[0], workout().exercises[0]);
  assert.equal(swapped.sets[0].reps, "");
});

test("logged sets protect the active exercise from silent reassignment", () => {
  const source = workout();
  source.exercises[0].sets[0].reps = "10";
  const result = swapActiveWorkoutExercise(source, 0, {
    id: "wger-hack-squat",
    name: "Hack Squat",
  });
  assert.equal(result.swapped, false);
  assert.equal(result.code, "logged_sets");
  assert.equal(result.message.includes("Clear"), true);
  assert.equal(source.exercises[0].exerciseId, "wger-leg-press");
  assert.equal(source.exercises[0].sets[0].reps, "10");
});

test("undo restores the original exercise before logging and keeps the slot intact", () => {
  const swapped = swapActiveWorkoutExercise(workout(), 0, {
    id: "wger-hack-squat",
    name: "Hack Squat",
  }).workout;
  const restored = restoreSwappedWorkoutExercise(swapped, 0);
  assert.equal(restored.restored, true);
  assert.equal(restored.workout.exercises[0].exerciseId, "wger-leg-press");
  assert.equal("originalExerciseId" in restored.workout.exercises[0], false);
  assert.equal(restored.workout.exercises[0].supersetGroupId, "ss-1");
});

test("old snapshots without swap metadata continue unchanged", () => {
  const source = workout();
  const result = restoreSwappedWorkoutExercise(source, 0);
  assert.equal(result.restored, false);
  assert.equal(result.code, "not_swapped");
  assert.equal(source.exercises[0].exerciseId, "wger-leg-press");
});

test("swap metadata survives the active-workout JSON persistence boundary", () => {
  const swapped = swapActiveWorkoutExercise(workout(), 0, {
    id: "wger-hack-squat",
    name: "Hack Squat",
  }).workout;
  const reloaded = JSON.parse(JSON.stringify(swapped));
  assert.equal(reloaded.exercises[0].exerciseId, "wger-hack-squat");
  assert.equal(reloaded.exercises[0].originalExerciseId, "wger-leg-press");
  assert.equal(reloaded.exercises[0].originalExerciseName, "Leg Press");
  assert.equal(reloaded.exercises[0].supersetGroupId, "ss-1");
});
