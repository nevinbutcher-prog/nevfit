import test from "node:test";
import assert from "node:assert/strict";
import { resolveProposedExercise } from "../src/services/exerciseResolution.js";

const provider = (results) => async () => results;

test("resolves exact normalized and Fitbot alias matches", async () => {
  const result = await resolveProposedExercise({ requestedName: "DB Bench", query: "db bench", exerciseProvider: provider([{ id: "wger-1", name: "Dumbbell Bench Press" }]) });
  assert.equal(result.status, "resolved");
  assert.equal(result.exercise.id, "wger-1");
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

test("returns unresolved for weak or missing provider matches", async () => {
  const result = await resolveProposedExercise({ requestedName: "Mystery movement", query: "mystery", exerciseProvider: provider([{ id: "wger-1", name: "Cable Curl" }]) });
  assert.equal(result.status, "unresolved");
});
