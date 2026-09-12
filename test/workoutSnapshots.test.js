import test from "node:test";
import assert from "node:assert/strict";
import {
  createCompletedWorkoutSnapshot,
  getPreviousExercisePerformance,
} from "../src/services/workoutSnapshots.js";

const meaningful = (set) => Number(set.reps) > 0 || Number(set.weight) > 0;

test("completion records the performed replacement and original exercise metadata", () => {
  const session = {
    scheduleDayId: "mon",
    routineDayId: "routine-a",
    exercises: [{
      exerciseId: "wger-hack-squat",
      exerciseName: "Hack Squat",
      originalExerciseId: "wger-leg-press",
      originalExerciseName: "Leg Press",
      restSeconds: 120,
      supersetGroupId: "ss-1",
      sets: [{ setNumber: 1, weight: "100", reps: "10" }],
    }],
  };
  const record = createCompletedWorkoutSnapshot(
    session,
    "Lower A",
    new Date("2026-09-12T01:02:03.000Z"),
    "workout-1",
  );
  assert.equal(record.exercises[0].exerciseId, "wger-hack-squat");
  assert.equal(record.exercises[0].originalExerciseId, "wger-leg-press");
  assert.equal(record.exercises[0].originalExerciseName, "Leg Press");
  assert.equal(record.exercises[0].supersetGroupId, "ss-1");
  assert.deepEqual(record.exercises[0].sets[0], { setNumber: 1, weight: "100", reps: "10" });
});

test("previous performance follows the performed replacement ID, not the slot or original ID", () => {
  const history = [
    {
      completedAt: "2026-09-10T00:00:00.000Z",
      exercises: [{ exerciseId: "wger-leg-press", sets: [{ weight: "200", reps: "10" }] }],
    },
    {
      completedAt: "2026-09-11T00:00:00.000Z",
      exercises: [{ exerciseId: "wger-hack-squat", sets: [{ weight: "160", reps: "8" }] }],
    },
  ];
  const replacementPerformance = getPreviousExercisePerformance("wger-hack-squat", history, meaningful);
  assert.equal(replacementPerformance.sets[0].weight, "160");
  assert.equal(getPreviousExercisePerformance("wger-leg-press", history, meaningful).sets[0].weight, "200");
});
