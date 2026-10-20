import test from "node:test";
import assert from "node:assert/strict";
import { createBackup } from "../src/services/backupPayload.js";
import { createExerciseMigrationPlan, applyExerciseMigrationPlan, rollbackExerciseMigration } from "../src/services/exerciseIdentityMigration.js";
import { prepareExactExerciseMigration } from "../src/services/exerciseMigrationPreparation.js";
import crosswalk from "../evaluation/nevfitHistoricalCrosswalk.v3.json" with { type: "json" };

const fixture = () => {
  const data = {
    uid: "synthetic-preparation", planning: {}, health: {}, activeWorkout: null, exerciseNotes: {}, programs: [],
    completedWorkouts: [
      { id: "one", completedAt: "2026-10-01T00:00:00Z", exercises: [{ exerciseId: "wger-1444", exerciseName: "Unknown exercise", sets: [{ weight: "30", reps: "8" }] }] },
      { id: "two", completedAt: "2026-10-02T00:00:00Z", exercises: [{ exerciseId: "wger-20", exerciseName: "Arnold Shoulder Press", sets: [{ weight: "15", reps: "10" }] }] },
      { id: "three", completedAt: "2026-10-03T00:00:00Z", exercises: [{ exerciseId: "wger-265", exerciseName: "Glute Bridge", sets: [{ weight: "0", reps: "12" }] }] },
    ],
  };
  return { data, backup: createBackup(data), preflight: createExerciseMigrationPlan(data) };
};
const manifest = (approvedStrongWgerIds = [], rejectedStrongWgerIds = [], excludedOccurrences = []) =>
  ({ approvedStrongWgerIds, rejectedStrongWgerIds, excludedOccurrences });

test("current backup and preflight prepare exact confirmed decisions while B stays pending", () => {
  const { data, backup, preflight } = fixture();
  const prepared = prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest() });
  assert.equal(prepared.review.pendingStrongWgerIds.length, 33);
  assert.equal(prepared.review.reviewComplete, false);
  assert.equal(prepared.decisions.length, 1);
  assert.equal(prepared.decisions[0].historicalWgerId, "wger-1444");
  assert.equal(prepared.decisions[0].recordedName, "Unknown exercise");
  assert.equal(prepared.plan.confirmed.length, 1);
  const { data: migrated, manifest: rollback } = applyExerciseMigrationPlan(data, prepared.plan);
  assert.equal(migrated.completedWorkouts[0].exercises[0].exerciseName, "Unknown exercise");
  assert.equal(migrated.completedWorkouts[0].exercises[0].sets[0].weight, "30");
  assert.equal(migrated.completedWorkouts[1].exercises[0].exerciseId, "wger-20");
  assert.equal(migrated.completedWorkouts[2].exercises[0].exerciseId, "wger-265");
  assert.deepEqual(rollbackExerciseMigration(migrated, rollback), data);
});

test("explicit B approval creates exact decisions and an occurrence exclusion remains excluded", () => {
  const { backup, preflight } = fixture();
  const rejected = { kind: "completedWorkout", docId: "one", path: "exercises.0.exerciseId", historicalWgerId: "wger-1444", recordedName: "Unknown exercise", reason: "Synthetic occurrence exception." };
  const prepared = prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest(["wger-20"], [], [rejected]) });
  assert.equal(prepared.plan.confirmed.length, 1);
  assert.equal(prepared.plan.confirmed[0].historicalWgerId, "wger-20");
  assert.equal(prepared.plan.rejected.length, 1);
  assert.equal(prepared.review.excludedOccurrenceCount, 1);
  assert.throws(() => prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest(["wger-1444"]) }), /Strong mapping approvals/);
  assert.throws(() => prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest(["wger-20"], ["wger-20"]) }), /Strong mapping approvals/);
});

test("preparation rejects changed backup, changed occurrence and fabricated exclusion", () => {
  const { backup, preflight } = fixture();
  const changed = structuredClone(backup);
  changed.completedWorkouts[0].exercises[0].exerciseId = "wger-75";
  assert.throws(() => prepareExactExerciseMigration({ preflight, backup: changed, approvalManifest: manifest() }), /Backup and preflight identities differ/);
  const fabricated = { kind: "completedWorkout", docId: "missing", path: "exercises.0.exerciseId", historicalWgerId: "wger-1444", recordedName: "Unknown exercise", reason: "Not present." };
  assert.throws(() => prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest([], [], [fabricated]) }), /exactly match/);
  assert.throws(() => prepareExactExerciseMigration({ preflight: { ...preflight, crosswalkVersion: 2 }, backup, approvalManifest: manifest() }), /current matching preflight/);
  assert.throws(() => prepareExactExerciseMigration({ preflight, backup: { ...backup, version: 1 }, approvalManifest: manifest() }), /version 2 full backup/);
  const unobserved = { kind: "completedWorkout", docId: "one", path: "exercises.0.exerciseId", historicalWgerId: "wger-1012", nevfitId: "nevfit-alternating-dumbbell-curl", recordedName: "Alternating curl", confirmed: true, reason: "Fabricated approval." };
  assert.throws(() => createExerciseMigrationPlan({ ...fixture().data, decisions: [unobserved] }), /reviewed identity/);
});

test("all six no-match legacy identities remain readable and outside prepared writes", () => {
  const { data } = fixture();
  const retained = crosswalk.relationships.filter((item) => item.reviewClass === "D");
  assert.equal(retained.length, 6);
  data.completedWorkouts = retained.map((item, index) => ({
    id: `retained-${index}`, completedAt: "2026-10-01T00:00:00Z",
    exercises: [{ exerciseId: item.historicalWgerId, exerciseName: `Original ${index}`, sets: [{ weight: "10", reps: "8" }] }],
  }));
  const prepared = prepareExactExerciseMigration({ preflight: createExerciseMigrationPlan(data), backup: createBackup(data), approvalManifest: manifest() });
  assert.equal(prepared.plan.confirmed.length, 0);
  assert.equal(prepared.plan.unmappedWgerIds.length, 6);
  assert.deepEqual(prepared.plan.unmappedWgerIds.sort(), retained.map((item) => item.historicalWgerId).sort());
});

test("two confirmed source IDs converging inside one workout stop preparation", () => {
  const { data } = fixture();
  data.completedWorkouts = [{ id: "collision", completedAt: "2026-10-01T00:00:00Z", exercises: [
    { exerciseId: "wger-687", exerciseName: "Overhead Press", sets: [{ weight: "40", reps: "8" }] },
    { exerciseId: "wger-1893", exerciseName: "Overhead Barbell Press", sets: [{ weight: "45", reps: "8" }] },
  ] }];
  const preflight = createExerciseMigrationPlan(data), backup = createBackup(data);
  assert.throws(() => prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest() }), /conflict/);
  const excluded = { kind: "completedWorkout", docId: "collision", path: "exercises.1.exerciseId", historicalWgerId: "wger-1893", recordedName: "Overhead Barbell Press", reason: "Duplicate movement in synthetic fixture." };
  const prepared = prepareExactExerciseMigration({ preflight, backup, approvalManifest: manifest([], [], [excluded]) });
  assert.equal(prepared.plan.confirmed.length, 1);
  assert.equal(prepared.plan.rejected.length, 1);
});
