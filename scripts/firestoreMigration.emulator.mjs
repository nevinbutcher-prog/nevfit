import assert from "node:assert/strict";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../src/services/firebase.js";
import { createBackup } from "../src/services/backupPayload.js";
import { runExerciseMigrationPreflight, loadMigrationAccountData } from "../src/services/exerciseMigrationPreflight.js";
import { executeApprovedExerciseMigration, rollbackApprovedExerciseMigration, getExerciseMigrationStatus } from "../src/services/exerciseMigrationExecution.js";
import { getPreviousExercisePerformance } from "../src/services/workoutSnapshots.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST.startsWith("127.0.0.1:"))
  throw new Error("This test requires the isolated local Firestore emulator.");

const decision = (kind, docId, path, recordedName) => ({
  kind, docId, path, recordedName, historicalWgerId: "wger-364", nevfitId: "nevfit-seated-leg-curl",
  confirmed: true, reason: "Synthetic seated leg curl fixture.",
});
const decisions = [
  decision("completedWorkout", "w1", "exercises.0.exerciseId", "Leg Curl"),
  decision("program", "p1", "days.0.exercises.0.exerciseId", ""),
  decision("activeWorkout", "activeWorkout", "activeWorkoutSession.exercises.0.exerciseId", "Leg Curl"),
  decision("exerciseNotes", "exerciseNotes", "notes.wger-364", ""),
];
const initial = () => ({
  programs: [{ id: "p1", days: [{ id: "d1", exercises: [{ exerciseId: "wger-364", routineExerciseId: "ri-1", supersetGroupId: "pair-1", sets: 3 }] }], routines: [{ id: "d1", exercises: [{ exerciseId: "wger-364", routineExerciseId: "ri-1", supersetGroupId: "pair-1", sets: 3 }] }] }],
  completedWorkouts: [{ id: "w1", completedAt: "2026-10-19T00:00:00.000Z", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", supersetGroupId: "pair-1", sets: [{ setNumber: 1, weight: "45", reps: "10", unit: "kg" }] }] }],
  activeWorkout: { exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ weight: "50", reps: "8" }] }] },
  exerciseNotes: { "wger-364": "Seat 3" }, planning: {}, health: {},
});
async function seed(uid) {
  const data = initial();
  await Promise.all([
    setDoc(doc(db, "users", uid, "programs", "p1"), data.programs[0]),
    setDoc(doc(db, "users", uid, "completedWorkouts", "w1"), data.completedWorkouts[0]),
    setDoc(doc(db, "users", uid, "appState", "activeWorkout"), { activeWorkoutSession: data.activeWorkout }),
    setDoc(doc(db, "users", uid, "appState", "exerciseNotes"), { notes: data.exerciseNotes }),
    setDoc(doc(db, "users", uid, "appState", "planning"), data.planning),
    setDoc(doc(db, "users", uid, "appState", "health"), data.health),
  ]);
  return { data, backup: createBackup(data) };
}

const uid = "synthetic-migration-account";
const { data, backup } = await seed(uid);
const plan = await runExerciseMigrationPreflight(uid, decisions);
assert.equal(plan.confirmed.length, 4);
assert.equal(plan.counts.completedWorkouts, 1);
const result = await executeApprovedExerciseMigration({ uid, plan, decisions, backup, explicitApproval: "approved-after-real-account-review" });
assert.equal(result.migratedOccurrences, 4);
const migrated = await loadMigrationAccountData(uid);
assert.equal(migrated.completedWorkouts[0].exercises[0].exerciseName, "Leg Curl");
assert.deepEqual(migrated.completedWorkouts[0].exercises[0].sets, data.completedWorkouts[0].exercises[0].sets);
assert.equal(migrated.programs[0].days[0].exercises[0].routineExerciseId, "ri-1");
assert.equal(migrated.programs[0].routines[0].exercises[0].supersetGroupId, "pair-1");
assert.equal(getPreviousExercisePerformance("nevfit-seated-leg-curl", migrated.completedWorkouts, () => true)?.sets[0].weight, "45");
const futureWorkout = {
  id: "future", completedAt: "2026-10-21T00:00:00.000Z",
  exercises: [{ exerciseId: "nevfit-seated-leg-curl", exerciseName: "Seated Leg Curl", sets: [{ weight: "50", reps: "10" }] }],
};
assert.equal(getPreviousExercisePerformance("nevfit-seated-leg-curl", [...migrated.completedWorkouts, futureWorkout], () => true)?.sets[0].weight, "50");
assert.equal(getPreviousExercisePerformance("wger-364", migrated.completedWorkouts, () => true), null);
assert.equal((await getExerciseMigrationStatus(uid)).status, "verified");
await assert.rejects(executeApprovedExerciseMigration({ uid, plan, decisions, backup, explicitApproval: "approved-after-real-account-review" }), /already completed/);
await rollbackApprovedExerciseMigration({ uid, plan, backup, explicitApproval: "approved-migration-rollback" });
const restored = await loadMigrationAccountData(uid);
assert.deepEqual(restored.completedWorkouts[0].exercises, data.completedWorkouts[0].exercises);
assert.deepEqual(restored.programs[0].days, data.programs[0].days);
assert.deepEqual(restored.programs[0].routines, data.programs[0].routines);
assert.deepEqual(restored.exerciseNotes, data.exerciseNotes);
assert.equal((await getExerciseMigrationStatus(uid)).status, "rolled_back");

const concurrentUid = "synthetic-concurrent-edit";
const concurrent = await seed(concurrentUid);
const concurrentPlan = await runExerciseMigrationPreflight(concurrentUid, decisions);
const workoutRef = doc(db, "users", concurrentUid, "completedWorkouts", "w1");
const modified = structuredClone(concurrent.data.completedWorkouts[0].exercises);
modified[0].sets[0].weight = "55";
await updateDoc(workoutRef, { exercises: modified });
await assert.rejects(executeApprovedExerciseMigration({ uid: concurrentUid, plan: concurrentPlan, decisions, backup: concurrent.backup, explicitApproval: "approved-after-real-account-review" }), /backup differs/);
assert.equal((await getDoc(workoutRef)).data().exercises[0].exerciseId, "wger-364");
assert.equal(await getExerciseMigrationStatus(concurrentUid), null);

const partialUid = "synthetic-partial-run";
const partial = await seed(partialUid);
const partialPlan = await runExerciseMigrationPreflight(partialUid, decisions);
const already = structuredClone(partial.data.completedWorkouts[0].exercises);
already[0].exerciseId = "nevfit-seated-leg-curl";
await updateDoc(doc(db, "users", partialUid, "completedWorkouts", "w1"), { exercises: already });
const resumed = await executeApprovedExerciseMigration({ uid: partialUid, plan: partialPlan, decisions, backup: partial.backup, explicitApproval: "approved-after-real-account-review" });
assert.equal(resumed.migratedOccurrences, 4);
assert.equal((await loadMigrationAccountData(partialUid)).completedWorkouts.length, 1);
await rollbackApprovedExerciseMigration({ uid: partialUid, plan: partialPlan, backup: partial.backup, explicitApproval: "approved-migration-rollback" });
assert.equal((await loadMigrationAccountData(partialUid)).completedWorkouts[0].exercises[0].exerciseId, "wger-364");

process.stdout.write("Firestore emulator migration, concurrency, resume and rollback checks passed.\n");
process.exit(0);
