import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../src/data/nevfitExerciseCatalogue.v1.json" with { type: "json" };
import registry from "../src/data/nevfitExerciseIdentityRegistry.v1.json" with { type: "json" };
import taxonomy from "../src/data/nevfitMuscleTaxonomy.v1.json" with { type: "json" };
import crosswalk from "../evaluation/nevfitLegacyExerciseCrosswalk.v1.json" with { type: "json" };
import mapping from "../evaluation/exercise-catalogue-mapping.json" with { type: "json" };
import snapshot from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { validateNevfitCatalogue } from "../evaluation/nevfitCatalogueValidation.js";
import { getPreviousExercisePerformance } from "../src/services/workoutSnapshots.js";

const inputs = { catalogue, registry, taxonomy, crosswalk, wgerSnapshot: snapshot, expectedCount: 247 };
const byId = new Map(catalogue.entries.map((entry) => [entry.id, entry]));

test("all 247 source exercises have unique committed Nevfit IDs and valid provisional metadata", () => {
  const result = validateNevfitCatalogue(inputs);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts, { catalogue: 247, registry: 247, legacy: 28, selectedWger: 42, withoutWger: 205 });
  assert.equal(catalogue.entries.filter((entry) => entry.metadata.status === "partially_reviewed").length, 12);
  assert.equal(catalogue.entries.filter((entry) => entry.metadata.status === "provisional").length, 235);
  assert.equal(catalogue.entries.filter((entry) => entry.secondaryMuscles.length).length, 184);
  assert.equal(catalogue.entries.filter((entry) => entry.subdivisions.length).length, 46);
  assert.ok(catalogue.entries.every((entry) => entry.movementPattern !== "other"));
  assert.ok(catalogue.entries.every((entry) => entry.media === undefined));
  assert.equal(new Set(catalogue.entries.map((entry) => entry.id)).size, 247);
  assert.equal(new Set(catalogue.entries.map((entry) => entry.displayName.toLowerCase())).size, 247);
  assert.equal(taxonomy.muscles.filter((item) => item.kind === "main").length, 18);
  assert.deepEqual(catalogue.entries.map((entry) => entry.metadata.provenance.sourceRow), mapping.exercises.map((entry) => entry.sourceRow));
});

test("identity registry remains authoritative when a display name changes; variants stay separate", () => {
  assert.equal(byId.get("nevfit-seated-leg-curl").displayName, "Seated Leg Curl");
  assert.notEqual(byId.get("nevfit-seated-leg-curl").id, byId.get("nevfit-lying-leg-curl").id);
  const renamed = structuredClone(byId.get("nevfit-seated-leg-curl"));
  renamed.displayName = "Seated Hamstring Curl";
  assert.equal(renamed.id, "nevfit-seated-leg-curl");
  assert.equal(registry.entries.find((entry) => entry.id === renamed.id).sourceNameAtAssignment, "Seated Leg Curl");
  assert.equal(byId.get("nevfit-reverse-barbell-curl").possibleDuplicateGroup, "reverse_barbell_curl");
  assert.equal(byId.get("nevfit-barbell-reverse-curl").possibleDuplicateGroup, "reverse_barbell_curl");
  assert.notEqual(byId.get("nevfit-reverse-barbell-curl").id, byId.get("nevfit-barbell-reverse-curl").id);
});

test("primary, secondary and subdivision vocabularies express compounds without equating browse group to anatomy", () => {
  const press = byId.get("nevfit-flat-barbell-bench-press");
  assert.equal(press.browseGroup, "Chest");
  assert.deepEqual(press.primaryMuscles, ["chest"]);
  assert.ok(press.secondaryMuscles.includes("triceps"));
  assert.ok(press.secondaryMuscles.includes("front_deltoids"));
  const abduction = byId.get("nevfit-hip-abduction-machine");
  assert.equal(abduction.browseGroup, "Glutes");
  assert.deepEqual(abduction.primaryMuscles, ["hip_abductors"]);
  assert.ok(abduction.subdivisions.includes("gluteus_medius_minimus"));
  const deadlift = byId.get("nevfit-conventional-barbell-deadlift");
  assert.deepEqual(deadlift.primaryMuscles, ["glutes", "hamstrings"]);
  assert.ok(deadlift.secondaryMuscles.includes("spinal_erectors"));
});

test("all 28 historical references are protected, preferred IDs remain separate, and no history is reattributed", () => {
  const relation = crosswalk.relationships.find((item) => item.nevfitId === "nevfit-seated-leg-curl");
  assert.equal(relation.historicalWgerId, "wger-364");
  assert.equal(relation.preferredWgerId, "wger-2626");
  assert.equal(relation.automaticHistoryAttributionAllowed, false);
  assert.equal(byId.get(relation.nevfitId).externalReferences.wger, null);
  assert.equal(crosswalk.relationships.filter((item) => item.ambiguityStatus === "requires_variant_review").length > 0, true);
  assert.equal(crosswalk.relationships.find((item) => item.historicalWgerId === "wger-1372").preferredWgerId, null);
  assert.equal(crosswalk.relationships.find((item) => item.historicalWgerId === "wger-1372").preferredWgerIdRaw, "wger-2634?");
  const oldWorkouts = [{ completedAt: "2025-02-01T10:00:00Z", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ weight: "45", reps: "9" }] }] }];
  const hasEffort = (set) => Number(set.reps) > 0;
  assert.equal(getPreviousExercisePerformance("wger-364", oldWorkouts, hasEffort).sets[0].weight, "45");
  assert.equal(getPreviousExercisePerformance("nevfit-seated-leg-curl", oldWorkouts, hasEffort), null);
  assert.equal(oldWorkouts[0].exercises[0].exerciseName, "Leg Curl");
});

test("validator rejects duplicate IDs, invalid muscles, and unsafe shared WGER references", () => {
  const duplicate = structuredClone(catalogue);
  duplicate.entries[1].id = duplicate.entries[0].id;
  assert.equal(validateNevfitCatalogue({ ...inputs, catalogue: duplicate }).valid, false);
  const invalidMuscle = structuredClone(catalogue);
  invalidMuscle.entries[0].secondaryMuscles.push("invented_muscle");
  assert.equal(validateNevfitCatalogue({ ...inputs, catalogue: invalidMuscle }).valid, false);
  const shared = structuredClone(catalogue);
  const chosen = shared.entries.find((entry) => entry.externalReferences.wger);
  const another = shared.entries.find((entry) => entry.id !== chosen.id && entry.externalReferences.wger);
  another.externalReferences.wger = structuredClone(chosen.externalReferences.wger);
  assert.equal(validateNevfitCatalogue({ ...inputs, catalogue: shared }).valid, false);
  const optionalMedia = structuredClone(catalogue);
  optionalMedia.entries[0].description = "Optional future description";
  optionalMedia.entries[0].instructions = "Optional future instructions";
  optionalMedia.entries[0].media = { imageReferences: [], videoReferences: [] };
  optionalMedia.entries[0].attribution = [{ source: "Future source" }];
  assert.equal(validateNevfitCatalogue({ ...inputs, catalogue: optionalMedia }).valid, true);
});

test("the historical WGER snapshot remains available after catalogue activation", () => {
  assert.equal(snapshot.exercises.find((entry) => entry.id === "wger-364").name, "Leg Curl");
});
