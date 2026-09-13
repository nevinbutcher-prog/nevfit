import test from "node:test";
import assert from "node:assert/strict";
import {
  toggleWorkoutSetCompletion,
  isWorkoutSetComplete,
  updateWorkoutSetDraft,
} from "../src/services/workoutSetLifecycle.js";

const workout = () => ({ exercises: [{ sets: [
  { setNumber: 1, weight: "", reps: "", completed: false },
  { setNumber: 2, weight: "", reps: "", completed: false },
  { setNumber: 3, weight: "", reps: "", completed: false },
] }] });

test("draft typing is isolated and never completes a set", () => {
  let current = updateWorkoutSetDraft(workout(), 0, 1, "weight", "4");
  current = updateWorkoutSetDraft(current, 0, 1, "weight", "40");
  assert.equal(current.exercises[0].sets[0].weight, "40");
  assert.equal(current.exercises[0].sets[1].weight, "");
  assert.equal(isWorkoutSetComplete(current.exercises[0].sets[0]), false);
});

test("multi-digit reps stay a draft until explicit finalisation", () => {
  let current = updateWorkoutSetDraft(workout(), 0, 1, "weight", "40");
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "1");
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "13");
  assert.equal(current.exercises[0].sets[0].reps, "13");
  assert.equal(toggleWorkoutSetCompletion(current, 0, 1).completed, true);
});

test("partial sets cannot finalise and invalid edits clear completion", () => {
  let current = updateWorkoutSetDraft(workout(), 0, 1, "weight", "40");
  assert.equal(toggleWorkoutSetCompletion(current, 0, 1).changed, false);
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "13");
  current = toggleWorkoutSetCompletion(current, 0, 1).workout;
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "");
  assert.equal(isWorkoutSetComplete(current.exercises[0].sets[0]), false);
  assert.equal(current.exercises[0].sets[1].reps, "");
});

test("bodyweight sets can be explicitly completed without a weight", () => {
  const current = updateWorkoutSetDraft(workout(), 0, 1, "reps", "12");
  assert.equal(
    toggleWorkoutSetCompletion(current, 0, 1, { allowsBlankWeight: true }).completed,
    true,
  );
});

test("only explicit valid completion changes the selected set", () => {
  let current = updateWorkoutSetDraft(workout(), 0, 1, "weight", "25");
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "12");
  const completed = toggleWorkoutSetCompletion(current, 0, 1);
  assert.equal(completed.completed, true);
  assert.equal(isWorkoutSetComplete(completed.workout.exercises[0].sets[1]), false);
  const uncompleted = toggleWorkoutSetCompletion(completed.workout, 0, 1);
  assert.equal(uncompleted.completed, false);
  assert.equal(isWorkoutSetComplete(uncompleted.workout.exercises[0].sets[0]), false);
});
