import test from "node:test";
import assert from "node:assert/strict";
import { createExerciseMigrationPlan, applyExerciseMigrationPlan, rollbackExerciseMigration, validateHistoricalMappings } from "../src/services/exerciseIdentityMigration.js";
import historicalCrosswalk from "../evaluation/nevfitHistoricalCrosswalk.v2.json" with { type: "json" };
import { getPreviousExercisePerformance } from "../src/services/workoutSnapshots.js";

const fixture = () => ({
  uid: "synthetic-user",
  programs: [{ id: "p1", days: [{ id: "d1", exercises: [{ routineExerciseId: "ri-1", exerciseId: "wger-364", sets: 3, supersetGroupId: "pair-1" }] }], routines: [{ id: "d1", exercises: [{ routineExerciseId: "ri-1", exerciseId: "wger-364", sets: 3, supersetGroupId: "pair-1" }] }] }],
  completedWorkouts: [{ id: "w1", completedAt: "2026-10-19T00:00:00Z", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ setNumber: 1, weight: "45", reps: "10", unit: "kg" }] }] }],
  activeWorkout: { exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ weight: "50", reps: "8" }] }] },
  exerciseNotes: { "wger-364": "Seat setting 3" },
});
const location = { completedWorkout: ["w1", "exercises.0.exerciseId"], program: ["p1", "days.0.exercises.0.exerciseId"], activeWorkout: ["activeWorkout", "activeWorkoutSession.exercises.0.exerciseId"], exerciseNotes: ["exerciseNotes", "notes.wger-364"] };
const decision = (kind, recordedName) => ({ kind, historicalWgerId: "wger-364", nevfitId: "nevfit-seated-leg-curl", recordedName, docId: location[kind][0], path: location[kind][1], confirmed: true, reason: "Synthetic fixture movement verified." });
const reviewed = (item) => ({ mappingConfidence: { A: "user_confirmed", B: "strong_proposed" }[item.reviewClass], historicalRecordedNames: ["Seated Leg Curl"], historicalNameMissingReferences: 0, evidence: { wgerSnapshotName: "Leg Curl", wgerSnapshotEquipment: [] }, provenance: { source: "synthetic_fixture" }, reviewReason: "Synthetic reviewed movement.", ...item });

test("expanded crosswalk has complete reviewed identities and one scoped user confirmation", () => {
  const mappings = validateHistoricalMappings(historicalCrosswalk);
  assert.equal(mappings.size, 69);
  assert.equal(historicalCrosswalk.observedHistoricalIds, 68);
  assert.equal(historicalCrosswalk.relationships.filter((item) => item.reviewClass === "A").length, 1);
  assert.deepEqual(mappings.get("wger-364").userConfirmation.scope, ["completedWorkout", "program"]);
  assert.equal(mappings.get("wger-1012").provenance.source, "original_crosswalk_only");
  assert.equal(mappings.has("wger-2626"), false);
});

test("dry run counts actual references and expands only the user-confirmed mapping", () => {
  const data = fixture(), before = structuredClone(data);
  const plan = createExerciseMigrationPlan(data);
  assert.equal(plan.counts.completedWorkouts, 1);
  assert.equal(plan.counts.historicalOccurrences, 1);
  assert.equal(plan.counts.routineReferences, 1);
  assert.equal(plan.counts.activeReferences, 1);
  assert.equal(plan.counts.noteReferences, 1);
  assert.equal(plan.confirmed.length, 2);
  assert.equal(plan.ambiguous.length, 2);
  assert.equal(plan.mappingReview.length, 69);
  assert.deepEqual(data, before);
});

test("confirmed exact-name migration preserves every other field and rolls back", () => {
  const data = fixture();
  const decisions = [decision("completedWorkout", "Leg Curl"), decision("activeWorkout", "Leg Curl"), decision("program", ""), decision("exerciseNotes", "")];
  const plan = createExerciseMigrationPlan({ ...data, decisions });
  assert.equal(plan.confirmed.length, 4);
  const { data: migrated, manifest } = applyExerciseMigrationPlan(data, plan);
  assert.equal(migrated.completedWorkouts[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.completedWorkouts[0].exercises[0].exerciseName, "Leg Curl");
  assert.equal(migrated.completedWorkouts[0].exercises[0].sets[0].weight, "45");
  assert.equal(migrated.activeWorkout.exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.programs[0].days[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.programs[0].routines[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.exerciseNotes["nevfit-seated-leg-curl"], "Seat setting 3");
  assert.deepEqual(rollbackExerciseMigration(migrated, manifest), data);
  assert.throws(() => applyExerciseMigrationPlan(migrated, plan), /changed since dry run/);
});

test("unmapped, conflicting and fabricated relationships never become confirmed", () => {
  const data = fixture();
  data.completedWorkouts[0].exercises.push({ exerciseId: "wger-999999", exerciseName: "Unknown", sets: [] });
  data.exerciseNotes["nevfit-seated-leg-curl"] = "Existing note";
  const plan = createExerciseMigrationPlan({ ...data, decisions: [decision("completedWorkout", "Leg Curl"), decision("exerciseNotes", "")] });
  assert.deepEqual(plan.unmappedWgerIds, ["wger-999999"]);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.confirmed.length, 2);
  assert.throws(() => applyExerciseMigrationPlan(data, plan), /Invalid migration plan/);
  assert.throws(() => createExerciseMigrationPlan({ ...data, decisions: [{ ...decision("completedWorkout", "Leg Curl"), nevfitId: "nevfit-forged" }] }), /reviewed identity/);
});

test("an interrupted document sequence can resume only remaining confirmed paths", () => {
  const data = fixture();
  const decisions = [decision("completedWorkout", "Leg Curl"), decision("activeWorkout", "Leg Curl")];
  const plan = createExerciseMigrationPlan({ ...data, decisions });
  const first = applyExerciseMigrationPlan(data, { ...plan, confirmed: plan.confirmed.slice(0, 1) });
  assert.equal(first.data.completedWorkouts[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(first.data.activeWorkout.exercises[0].exerciseId, "wger-364");
  const resumed = applyExerciseMigrationPlan(first.data, { ...plan, confirmed: plan.confirmed.slice(1) });
  assert.equal(resumed.data.activeWorkout.exercises[0].exerciseId, "nevfit-seated-leg-curl");
  const restored = rollbackExerciseMigration(rollbackExerciseMigration(resumed.data, resumed.manifest), first.manifest);
  assert.deepEqual(restored, data);
});

test("a user-confirmed mapping expands to exact occurrences; a reviewed exception excludes one", () => {
  const data = fixture();
  const mapping = { crosswalkVersion: 2, relationships: [reviewed({ historicalWgerId: "wger-364", nevfitId: "nevfit-seated-leg-curl", reviewClass: "A", reviewReason: "User confirmed seated machine", userConfirmation: { confirmed: true, scope: ["completedWorkout", "program"], reason: "All historical wger-364 sets used the seated leg curl machine." } })] };
  const plan = createExerciseMigrationPlan({ ...data, mapping });
  assert.equal(plan.confirmed.length, 2);
  assert.equal(plan.confirmed.every((item) => item.approvalSource === "user_confirmed_mapping"), true);
  assert.equal(plan.ambiguous.length, 2); // active and notes were outside the confirmed scope
  const excluded = createExerciseMigrationPlan({ ...data, mapping, decisions: [{ ...decision("completedWorkout", "Leg Curl"), confirmed: false, reason: "This single record was mislabelled." }] });
  assert.equal(excluded.confirmed.length, 1);
  assert.equal(excluded.rejected.length, 1);
  assert.equal(excluded.rejected[0].docId, "w1");
  assert.throws(() => validateHistoricalMappings({ crosswalkVersion: 2, relationships: [{ ...mapping.relationships[0], nevfitId: "nevfit-forged" }] }), /Invalid historical mapping/);
});

test("two old IDs proposed into one exercise list are flagged without blocking separate workouts", () => {
  const data = fixture();
  data.completedWorkouts[0].exercises.push({ exerciseId: "wger-2626", exerciseName: "Seated Leg Curl", sets: [] });
  const mapping = { crosswalkVersion: 2, relationships: [
    reviewed({ historicalWgerId: "wger-364", nevfitId: "nevfit-seated-leg-curl", reviewClass: "B" }),
    reviewed({ historicalWgerId: "wger-2626", nevfitId: "nevfit-seated-leg-curl", reviewClass: "B" }),
  ] };
  const decisions = [decision("completedWorkout", "Leg Curl"), { kind: "completedWorkout", docId: "w1", path: "exercises.1.exerciseId", historicalWgerId: "wger-2626", nevfitId: "nevfit-seated-leg-curl", recordedName: "Seated Leg Curl", confirmed: true, reason: "Synthetic identity." }];
  const plan = createExerciseMigrationPlan({ ...data, mapping, decisions });
  assert.equal(plan.conflicts.length, 2);
  assert.equal(plan.confirmed.length, 0);
  data.completedWorkouts[0].exercises.pop();
  data.completedWorkouts.push({ id: "w2", completedAt: "2026-10-20T00:00:00Z", exercises: [{ exerciseId: "wger-2626", exerciseName: "Seated Leg Curl", sets: [] }] });
  decisions[1].docId = "w2"; decisions[1].path = "exercises.0.exerciseId";
  const separated = createExerciseMigrationPlan({ ...data, mapping, decisions });
  assert.equal(separated.conflicts.length, 0);
  assert.equal(separated.confirmed.length, 2);
});

test("separate legacy IDs join one progression while variants and unmapped records stay distinct", () => {
  const workout = (id, completedAt, exerciseId, exerciseName, weight) => ({ id, completedAt, exercises: [{ exerciseId, exerciseName, sets: [{ weight, reps: "8" }] }] });
  const data = {
    uid: "synthetic-progression", programs: [], activeWorkout: null, exerciseNotes: {},
    completedWorkouts: [
      workout("one", "2026-10-01T00:00:00Z", "wger-354", "Lat Pull Down", "40"),
      workout("two", "2026-10-02T00:00:00Z", "wger-684", "Underhand Lat Pull Down", "45"),
      workout("three", "2026-10-03T00:00:00Z", "wger-1972", "Single-Arm Lat Pulldown", "25"),
      workout("four", "2026-10-04T00:00:00Z", "wger-999999", "Unmapped movement", "30"),
    ],
  };
  const decisions = [
    ["one", "wger-354", "nevfit-underhand-lat-pulldown", "Lat Pull Down"],
    ["two", "wger-684", "nevfit-underhand-lat-pulldown", "Underhand Lat Pull Down"],
    ["three", "wger-1972", "nevfit-single-arm-cable-lat-pulldown", "Single-Arm Lat Pulldown"],
  ].map(([docId, historicalWgerId, nevfitId, recordedName]) => ({ kind: "completedWorkout", docId, path: "exercises.0.exerciseId", historicalWgerId, nevfitId, recordedName, confirmed: true, reason: "Synthetic movement verification." }));
  const plan = createExerciseMigrationPlan({ ...data, decisions });
  assert.equal(plan.confirmed.length, 3);
  assert.deepEqual(plan.unmappedWgerIds, ["wger-999999"]);
  const { data: migrated, manifest } = applyExerciseMigrationPlan(data, plan);
  assert.equal(getPreviousExercisePerformance("nevfit-underhand-lat-pulldown", migrated.completedWorkouts, () => true)?.sets[0].weight, "45");
  assert.equal(getPreviousExercisePerformance("nevfit-single-arm-cable-lat-pulldown", migrated.completedWorkouts, () => true)?.sets[0].weight, "25");
  assert.equal(migrated.completedWorkouts[3].exercises[0].exerciseId, "wger-999999");
  assert.deepEqual(rollbackExerciseMigration(migrated, manifest), data);
});
