import test from "node:test";
import assert from "node:assert/strict";
import { MAX_EDITOR_REPS, parseEditorRepCount, parseEditorRepRange, updateEditorRepRange } from "../src/services/repRangeEditor.js";
import { normalizeRoutineExercise } from "../src/services/routineBuilder.js";

test("existing ranges and fixed targets parse; invalid legacy values are not rewritten", () => {
  assert.deepEqual(parseEditorRepRange("8-12"), { min: 8, max: 12 });
  assert.deepEqual(parseEditorRepRange(" 10 - 10 "), { min: 10, max: 10 });
  assert.deepEqual(parseEditorRepRange("100-150"), { min: 100, max: 150 });
  for (const legacy of ["AMRAP", "10", "12-8", "0-10", "8–12", "", "1-10000"]) {
    assert.equal(parseEditorRepRange(legacy), null);
    assert.equal(updateEditorRepRange(legacy, "min", 10), "10-10");
  }
});

test("bound changes carry the opposite bound and reject invalid counts", () => {
  assert.equal(updateEditorRepRange("8-12", "min", 10), "10-12");
  assert.equal(updateEditorRepRange("10-12", "max", 15), "10-15");
  assert.equal(updateEditorRepRange("10-15", "max", 10), "10-10");
  assert.equal(updateEditorRepRange("8-12", "min", 13), "13-13");
  assert.equal(updateEditorRepRange("8-12", "max", 7), "7-7");
  for (const count of [0, -1, 1.5, NaN, Infinity, "", "1e2", "-2", MAX_EDITOR_REPS + 1]) {
    assert.equal(parseEditorRepCount(count), null);
    assert.equal(updateEditorRepRange("8-12", "min", count), null);
  }
  let value = "8-12";
  for (let count = 9; count <= 20; count++) value = updateEditorRepRange(value, "min", count);
  assert.equal(value, "20-20");
  assert.equal(updateEditorRepRange("1-1", "min", 0), null);
  assert.equal(updateEditorRepRange("999-999", "max", 1000), null);
});

test("editor output retains the existing string through routine normalization", () => {
  for (const repRange of [updateEditorRepRange("8-12", "max", 15), updateEditorRepRange("10-15", "max", 10)]) {
    const exercise = { exerciseId: "test", sets: 3, repRange, restSeconds: 60 };
    const saved = normalizeRoutineExercise(exercise, "row-1", () => true);
    const reloaded = normalizeRoutineExercise(JSON.parse(JSON.stringify(saved)), "row-1", () => true);
    assert.equal(reloaded.repRange, repRange);
    assert.match(reloaded.repRange, /^\d+-\d+$/);
    assert.deepEqual(parseEditorRepRange(reloaded.repRange), parseEditorRepRange(repRange));
  }
});
