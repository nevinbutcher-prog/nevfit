import test from "node:test";
import assert from "node:assert/strict";
import {
  ROB_CATALOGUE_MAX_SIZE,
  buildRobExerciseCatalogue,
  catalogueFingerprint,
} from "../src/services/rob/robExerciseCatalogue.js";

const records = [
  ["wger-73", "Bench Press", ["Barbell", "Bench"], "Chest"],
  ["wger-145", "Cable Woodchoppers", ["Cable"], "Abs"],
  ["wger-371", "Leg Press", ["Machine"], "Quads"],
  ["wger-458", "Plank", ["Bodyweight"], "Abs"],
  ["wger-475", "Pull-ups", ["Pull-up bar"], "Back"],
  ["wger-567", "Shoulder Press, Dumbbells", ["Dumbbell"], "Shoulders"],
  ["wger-577", "Side Dumbbell Trunk Flexion", ["Dumbbell"], "Abs"],
  ["wger-723", "Wide-grip Pulldown", ["Cable"], "Back"],
  ["wger-1370", "Dumbbell Deadlift", ["Dumbbell"], "Legs"],
  ["wger-1801", "Barbell Full Squat", ["Barbell"], "Legs"],
  ["wger-2626", "Machine Seated Leg Curl", ["Machine"], "Hamstrings"],
  ["wger-2669", "Bent Over Dumbbell Rows", ["Dumbbell"], "Back"],
].map(([id, name, equipment, primaryMuscle]) => ({ id, name, equipment, primaryMuscle, bodyPart: primaryMuscle }));

test("catalogue uses only reviewed, complete provider records and removes duplicate names", () => {
  const catalogue = buildRobExerciseCatalogue([...records, { ...records[0], id: "wger-not-reviewed" }, { id: "wger-73", name: "", equipment: [] }], { requirements: { environment: "commercial_gym", priorities: ["back"] } });
  assert.ok(catalogue.entries.length <= ROB_CATALOGUE_MAX_SIZE);
  assert.ok(catalogue.entries.every((entry) => entry.id.startsWith("wger-") && entry.name && entry.source === "wger"));
  assert.equal(catalogue.entries.filter((entry) => entry.id === "wger-73").length, 1);
});

test("equipment contexts and explicit exclusions constrain catalogue entries without guessing unknown exclusions", () => {
  const home = buildRobExerciseCatalogue(records, { requirements: { environment: "home_gym", equipment: ["dumbbells"], priorities: [] }, excludedExerciseIds: ["wger-2669", "wger-unknown"] });
  assert.deepEqual(home.entries.map((entry) => entry.id), ["wger-1370", "wger-567", "wger-577"]);
  assert.deepEqual(home.excludedExerciseIds, ["wger-2669"]);
  const minimal = buildRobExerciseCatalogue(records, { requirements: { environment: "minimal_equipment", equipment: [], priorities: [] } });
  assert.deepEqual(minimal.entries.map((entry) => entry.id), ["wger-458"]);
});

test("catalogue fingerprints bind the exact authorised IDs and generation context", () => {
  const first = buildRobExerciseCatalogue(records, { requirements: { environment: "commercial_gym", priorities: ["back"] } });
  assert.notEqual(catalogueFingerprint(first, { goal: "strength" }), catalogueFingerprint(first, { goal: "hypertrophy" }));
});
