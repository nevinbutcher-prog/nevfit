import test from "node:test";
import assert from "node:assert/strict";
import {
  finalizeWorkoutSet,
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
  assert.equal(finalizeWorkoutSet(current, 0, 1).finalized, true);
});

test("partial sets cannot finalise and invalid edits clear completion", () => {
  let current = updateWorkoutSetDraft(workout(), 0, 1, "weight", "40");
  assert.equal(finalizeWorkoutSet(current, 0, 1).finalized, false);
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "13");
  current = finalizeWorkoutSet(current, 0, 1).workout;
  current = updateWorkoutSetDraft(current, 0, 1, "reps", "");
  assert.equal(isWorkoutSetComplete(current.exercises[0].sets[0]), false);
  assert.equal(current.exercises[0].sets[1].reps, "");
});

test("bodyweight sets can be explicitly completed without a weight", () => {
  const current = updateWorkoutSetDraft(workout(), 0, 1, "reps", "12");
  assert.equal(finalizeWorkoutSet(current, 0, 1).finalized, true);
});
