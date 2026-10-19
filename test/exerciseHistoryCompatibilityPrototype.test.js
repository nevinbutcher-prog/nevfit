import test from "node:test";
import assert from "node:assert/strict";
import { createCompletedWorkoutSnapshot, getPreviousExercisePerformance } from "../src/services/workoutSnapshots.js";
import { prototypePreviousPerformance } from "../evaluation/historyCompatibilityPrototype.js";

const meaningful = (set) => Number(set?.reps) > 0 || Number(set?.weight) > 0;
const old = {
  id: "fixture-old", completedAt: "2025-01-02T10:00:00.000Z", routineDayId: "r1", routineDayName: "Legs",
  exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ setNumber: 1, weight: "40", reps: "10" }] }],
};

test("A: rename preserves exact-ID historical performance", () => {
  const displayName = "Seated Leg Curl";
  assert.equal(displayName, "Seated Leg Curl");
  assert.equal(getPreviousExercisePerformance("wger-364", [old], meaningful).sets[0].weight, "40");
  assert.equal(old.exercises[0].exerciseName, "Leg Curl");
});

test("B: a changed external reference needs an explicit unique old-ID bridge", () => {
  const rows = [{ sourceRow: 179, historicalWgerId: "wger-364", preferredWgerId: "wger-2626" }];
  assert.equal(getPreviousExercisePerformance("wger-2626", [old], meaningful), null);
  assert.equal(prototypePreviousPerformance({ catalogueRows: rows, targetRow: 179, completedWorkouts: [old] }).performance.sets[0].reps, "10");
});

test("C: a shared historical ID cannot identify two different movements", () => {
  const rows = [{ sourceRow: 1, historicalWgerId: "wger-364" }, { sourceRow: 2, historicalWgerId: "wger-364" }];
  assert.equal(prototypePreviousPerformance({ catalogueRows: rows, targetRow: 1, completedWorkouts: [old] }).reason, "ambiguous_shared_historical_id");
  assert.equal(prototypePreviousPerformance({ catalogueRows: rows, targetRow: 2, completedWorkouts: [old] }).performance, null);
});

test("D: a genuinely different substitution does not inherit old performance", () => {
  const rows = [{ sourceRow: 179, historicalWgerId: "wger-364" }, { sourceRow: 180, historicalWgerId: null, preferredWgerId: "wger-2626" }];
  assert.equal(prototypePreviousPerformance({ catalogueRows: rows, targetRow: 180, completedWorkouts: [old] }).reason, "no_explicit_historical_link");
  assert.equal(getPreviousExercisePerformance("wger-2626", [old], meaningful), null);
});

test("E: older snapshots retain recorded name, date, sets and units", () => {
  const session = { scheduleDayId: "monday", routineDayId: "r1", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ setNumber: 1, weight: "40", reps: "10", unit: "kg" }] }] };
  const snapshot = createCompletedWorkoutSnapshot(session, "Legs", new Date(old.completedAt), "fixture-new", (exercise) => exercise.exerciseName);
  assert.equal(snapshot.completedAt, old.completedAt);
  assert.equal(snapshot.exercises[0].exerciseName, "Leg Curl");
  assert.deepEqual(snapshot.exercises[0].sets[0], { setNumber: 1, weight: "40", reps: "10", unit: "kg" });
  assert.equal(old.exercises[0].sets[0].weight, "40");
});
