import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExerciseNotes, setExerciseNote } from "../src/services/exerciseNotes.js";

test("personal notes are keyed by stable exercise ID across workout contexts", () => {
  const firstRoutineNotes = setExerciseNote({}, "wger-123", "Seat 4\nHandles low");
  assert.equal(firstRoutineNotes["wger-123"], "Seat 4\nHandles low");

  const secondRoutineNotes = setExerciseNote(firstRoutineNotes, "wger-456", "Back pad 2");
  assert.equal(secondRoutineNotes["wger-123"], "Seat 4\nHandles low");
  assert.equal(firstRoutineNotes["wger-456"], undefined);

  const cleared = setExerciseNote(secondRoutineNotes, "wger-123", "");
  assert.equal(cleared["wger-123"], undefined);
  assert.equal(cleared["wger-456"], "Back pad 2");
});

test("malformed stored note entries are excluded", () => {
  assert.deepEqual(normalizeExerciseNotes({
    "wger-123": "Seat 4\nHandles low",
    "wger-456": 17,
    "wger-789": "",
  }), { "wger-123": "Seat 4\nHandles low" });
});
