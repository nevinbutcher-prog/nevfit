import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExerciseText, resolveProposedExercise } from "../src/services/exerciseResolution.js";

const provider = (results) => async () => results;

test("resolves exact normalized and Fitbot alias matches", async () => {
  const result = await resolveProposedExercise({ requestedName: "DB Bench", query: "db bench", exerciseProvider: provider([{ id: "wger-1", name: "Dumbbell Bench Press" }]) });
  assert.equal(result.status, "resolved");
  assert.equal(result.exercise.id, "wger-1");
});

test("canonical aliases are idempotent and normalize compatible gym language", () => {
  const pairs = [["Pulldown", "Lat Pulldown"], ["DB Bench", "Dumbbell Bench Press"], ["Lat Raise", "Lateral Raise"], ["BB Curl", "Barbell Curl"], ["Cable Pushdown", "Triceps Pushdown"]];
  for (const [alternative, canonical] of pairs) {
    const normalized = normalizeExerciseText(alternative);
    assert.equal(normalized, normalizeExerciseText(canonical));
    assert.equal(normalized, normalizeExerciseText(normalized));
  }
  for (const canonical of ["Lat Pulldown", "Dumbbell Bench Press", "Lateral Raise", "Barbell Curl", "Triceps Pushdown"]) assert.equal(normalizeExerciseText(canonical), normalizeExerciseText(normalizeExerciseText(canonical)));
});

test("resolves a high-confidence reordered provider name", async () => {
  const result = await resolveProposedExercise({ requestedName: "Incline Dumbbell Bench Press", query: "incline dumbbell bench press", exerciseProvider: provider([{ id: "wger-1", name: "Dumbbell Incline Bench Press" }]) });
  assert.equal(result.status, "resolved");
  assert.equal(result.confidence, "high");
});

test("does not resolve multiple plausible provider candidates", async () => {
  const result = await resolveProposedExercise({ requestedName: "Incline Dumbbell Press", query: "incline dumbbell press", exerciseProvider: provider([{ id: "wger-1", name: "Dumbbell Incline Bench Press" }, { id: "wger-2", name: "Dumbbell Incline Fly" }]) });
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.candidates.map((entry) => entry.id), ["wger-1", "wger-2"]);
});

test("keeps generic exercise names ambiguous when provider results are plausible", async () => {
  const candidates = [{ id: "wger-1", name: "Machine Chest Press" }, { id: "wger-2", name: "Shoulder Press" }, { id: "wger-3", name: "Cable Row" }, { id: "wger-4", name: "Barbell Row" }, { id: "wger-5", name: "Dumbbell Curl" }, { id: "wger-6", name: "Cable Curl" }, { id: "wger-7", name: "Cable Lateral Raise" }, { id: "wger-8", name: "Dumbbell Front Raise" }];
  for (const name of ["Press", "Row", "Curl", "Raise"]) {
    const result = await resolveProposedExercise({ requestedName: name, query: name, exerciseProvider: provider(candidates) });
    assert.equal(result.status, "ambiguous");
  }
});

test("returns unresolved for weak or missing provider matches", async () => {
  const result = await resolveProposedExercise({ requestedName: "Mystery movement", query: "mystery", exerciseProvider: provider([{ id: "wger-1", name: "Cable Curl" }]) });
  assert.equal(result.status, "unresolved");
});
