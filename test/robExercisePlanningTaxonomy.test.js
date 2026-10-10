import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { auditRobExercisePlanningTaxonomy, createRobExercisePlanningProfile, createRobExercisePlanningTaxonomy, planningOverlap } from "../src/services/rob/robExercisePlanningTaxonomy.js";

const byId = (id) => catalogue.exercises.find((entry) => entry.id === id);
const byName = (name) => catalogue.exercises.find((entry) => entry.name === name);
const contribution = (profile, group) => profile.secondaryStimulus.contributions.find((item) => item.muscleGroup === group);

test("planning taxonomy preserves catalogue identity and keeps equipment eligibility outside planning metadata", () => {
  const profile = createRobExercisePlanningProfile(byId("wger-73"));
  assert.equal(profile.exerciseId, "wger-73");
  assert.equal(profile.source.sourceName, "Bench Press");
  assert.equal("equipment" in profile, false);
  assert.deepEqual(byId("wger-73").equipment, ["Barbell", "Bench"]);
});

test("representative pressing, pulling, lower-body, isolation, and trunk exercises receive stable planning profiles", () => {
  const cases = [
    [byId("wger-73"), "horizontal_push", "compound"],
    [byId("wger-567"), "vertical_push", "compound"],
    [byName("Lateral Raises"), "isolation", "isolation"],
    [byId("wger-723"), "vertical_pull", "compound"],
    [byName("Seated Row"), "horizontal_pull", "compound"],
    [byName("Squats"), "knee_dominant", "compound"],
    [byName("Romanian Deadlift"), "hinge", "compound"],
    [byName("Leg Curl"), "isolation", "isolation"],
    [byName("Dumbbell Curl"), "isolation", "isolation"],
    [byName("Triceps Extensions on Cable"), "isolation", "isolation"],
    [byId("wger-458"), "trunk", "trunk"],
  ];
  for (const [entry, pattern, role] of cases) {
    assert.ok(entry, `missing fixture ${pattern}`);
    const profile = createRobExercisePlanningProfile(entry);
    assert.equal(profile.movementPattern.value, pattern, entry.name);
    assert.equal(profile.role.value, role, entry.name);
    assert.ok(profile.fatigueTags.length, entry.name);
  }
});

test("secondary stimulus retains source, inferred, reviewed, and unknown states without treating missing source data as none", () => {
  const bench = createRobExercisePlanningProfile(byId("wger-73"));
  assert.ok(contribution(bench, "shoulders").evidence.includes("source_normalized"));
  assert.equal(contribution(bench, "arms").involvement, "meaningful");
  const shoulderPress = createRobExercisePlanningProfile(byId("wger-567"));
  assert.equal(contribution(shoulderPress, "arms").provenance, "manual_review");
  const lateralRaise = createRobExercisePlanningProfile(byName("Lateral Raises"));
  assert.equal(lateralRaise.secondaryStimulus.status, "unknown");
  assert.deepEqual(lateralRaise.secondaryStimulus.contributions, []);
});

test("fatigue overlap and sequencing metadata identify shared planning demands without pair restrictions", () => {
  const bench = createRobExercisePlanningProfile(byId("wger-73"));
  const shoulderPress = createRobExercisePlanningProfile(byId("wger-567"));
  const row = createRobExercisePlanningProfile(byName("Seated Row"));
  const overlap = planningOverlap(bench, shoulderPress);
  assert.ok(overlap.sharedMuscles.includes("shoulders"));
  assert.ok(overlap.sharedFatigueTags.includes("compound_fatigue"));
  assert.equal(planningOverlap(bench, row).sharedFatigueTags.includes("elbow_extension"), false);
  assert.ok(bench.sequencingTags.includes("perform_before_related_isolation"));
});

test("taxonomy audit covers all source records and reports explicit unknowns, contradictions, and stale reviews", () => {
  const taxonomy = createRobExercisePlanningTaxonomy(catalogue);
  const audit = auditRobExercisePlanningTaxonomy(catalogue);
  assert.equal(taxonomy.catalogueVersion, catalogue.version);
  assert.equal(taxonomy.profiles.length, catalogue.exercises.length);
  assert.equal(audit.recordCount, 907);
  assert.ok(audit.confidence.low > 0);
  assert.ok(audit.unknown.secondaryStimulus.count > 0);
  assert.deepEqual(audit.staleReviewedExceptions, []);
  assert.ok(Array.isArray(audit.contradictions));
  assert.ok(audit.contradictions.some((item) => item.exerciseId === "wger-1730" && item.code === "name_primary_conflict"));
});

test("catalogue refreshes retain matching reviewed metadata but surface a changed reviewed name", () => {
  const stableRefresh = { version: 3, exercises: [byId("wger-73")] };
  assert.equal(createRobExercisePlanningTaxonomy(stableRefresh).profiles[0].movementPattern.provenance, "manual_review");
  const renamedRefresh = { version: 3, exercises: [{ ...byId("wger-73"), name: "Different exercise" }] };
  const audit = auditRobExercisePlanningTaxonomy(renamedRefresh);
  assert.equal(createRobExercisePlanningTaxonomy(renamedRefresh).profiles[0].movementPattern.provenance, "unknown");
  assert.deepEqual(audit.staleReviewedExceptions, [{ exerciseId: "wger-73", code: "reviewed_name_changed" }, { exerciseId: "wger-567", code: "reviewed_id_missing" }, { exerciseId: "wger-723", code: "reviewed_id_missing" }, { exerciseId: "wger-507", code: "reviewed_id_missing" }]);
});
