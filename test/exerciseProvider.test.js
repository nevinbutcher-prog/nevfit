import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExerciseSearchText } from "../src/services/exerciseProvider.js";

test("search normalization expands safe common abbreviations and pull-down spelling", () => {
  assert.equal(normalizeExerciseSearchText("DB RDL"), "dumbbell romanian deadlift");
  assert.equal(normalizeExerciseSearchText("SLDL"), "stiff leg deadlift");
  assert.equal(normalizeExerciseSearchText("Lat pull down"), "lat pulldown");
});
