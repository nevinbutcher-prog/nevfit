import test from "node:test";
import assert from "node:assert/strict";
import { getRecentWorkoutExercises, groupRecentWorkoutExercises } from "../src/services/recentWorkoutExercises.js";
import { createQuickWorkoutSession, addQuickWorkoutExercise } from "../src/services/workoutSnapshots.js";

const exercise = (exerciseId, exerciseName, reps = "8") => ({
  exerciseId, exerciseName, sets: [{ weight: "40", reps }],
});
const workout = (completedAt, exercises) => ({ completedAt, exercises });

test("recent selection is bounded, unique, ordered by performance date and scoped to supplied account history", () => {
  const history = [
    workout("2026-11-08", [exercise("wger-1", "Old name"), exercise("wger-3", "Older")]),
    workout("2026-11-10", [exercise("wger-2", "Latest"), exercise("wger-1", "New name")]),
    workout("invalid", [exercise("wger-4", "Unusable date")]),
    workout("2026-11-11", [{ ...exercise("wger-5", "Blank"), sets: [{ weight: "", reps: "" }] }, exercise("unsupported", "Unknown ID")]),
  ];
  const before = structuredClone(history);
  assert.deepEqual(getRecentWorkoutExercises(history, 2), [{ id: "wger-2", name: "Latest" }, { id: "wger-1", name: "New name" }]);
  assert.deepEqual(getRecentWorkoutExercises(history).map((item) => item.id), ["wger-2", "wger-1", "wger-3"]);
  assert.deepEqual(getRecentWorkoutExercises([]), []);
  assert.deepEqual(groupRecentWorkoutExercises([]), []);
  assert.deepEqual(history, before);
});

test("recent groups use canonical/provider muscle metadata and fallback without guessing or carrying historical sets", () => {
  const recent = getRecentWorkoutExercises([workout("2026-11-10", [
    exercise("nevfit-flat-barbell-bench-press", "Custom bench"),
    exercise("wger-1", "Press"),
    exercise("wger-2", "Unknown biceps curl"),
    exercise("wger-3", "Earlier press"),
  ])]);
  const groups = groupRecentWorkoutExercises(recent, (id) => id === "wger-1" || id === "wger-3"
    ? { id, name: "Provider press", primaryMuscle: "Chest" } : null);
  assert.equal(groups[0].exercises[0].name, "Flat Barbell Bench Press");
  assert.notEqual(groups[0].muscle, "Other / Uncategorised");
  const chest = groups.find((group) => group.muscle === "Chest");
  assert.deepEqual(chest.exercises.filter((item) => item.id.startsWith("wger-")).map((item) => item.id), ["wger-1", "wger-3"]);
  assert.deepEqual(groups.find((group) => group.muscle === "Other / Uncategorised").exercises.map((item) => item.id), ["wger-2"]);
  const picked = groups[0].exercises[0];
  const session = addQuickWorkoutExercise(createQuickWorkoutSession(), picked);
  assert.deepEqual(session.exercises[0].sets, [{ setNumber: 1, weight: "", reps: "", completed: false }]);
  assert.equal(addQuickWorkoutExercise(session, picked), session);
});
