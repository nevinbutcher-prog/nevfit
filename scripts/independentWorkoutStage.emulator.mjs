import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, doc, collection, getDocFromServer, getDocsFromServer, setDoc, runTransaction, updateDoc, deleteDoc, disableNetwork, enableNetwork, Timestamp, setLogLevel } from "firebase/firestore";
import { captureTrainingReadinessFromFirestore } from "../src/services/trainingReadinessSource.js";
import { createIndependentWorkoutStageFirestore, INDEPENDENT_WORKOUT_STAGE_MARKER } from "../src/services/independentWorkoutStageFirestore.js";
import { prepareIndependentWorkoutStage, stageIndependentWorkouts } from "../src/services/independentWorkoutStage.js";
import { encodeFirestoreValue } from "../src/services/firestoreValueCodec.js";

const projectId = "demo-nevfit-stage";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8091" || process.env.GCLOUD_PROJECT !== projectId) {
  throw new Error("Requires the isolated demo-nevfit-stage emulator on 127.0.0.1:8091. No production access permitted.");
}
setLogLevel("silent");
const apps = [];
const same = (a, b) => assert.deepEqual(encodeFirestoreValue(a), encodeFirestoreValue(b));
function client(uid) {
  const app = initializeApp({ projectId, apiKey: "demo-key" }, `fixture-${apps.length}`);
  apps.push(app);
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, "127.0.0.1", 8091, { mockUserToken: { sub: uid, user_id: uid } });
  const auth = { currentUser: { uid } }; // Emulator JWT above enforces real rules; facade exercises adapter identity checks.
  return { uid, firestore, auth, isMounted: () => true };
}
async function fixture(uid, empty = false) {
  const context = client(uid), db = context.firestore;
  if (!empty) {
    const days = [{ id: "r", name: "Synthetic workout", archived: false, exercises: [
      { routineExerciseId: "row-1", exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: 90, note: "Synthetic", supersetGroupId: null },
    ] }];
    await Promise.all([
      setDoc(doc(db, "users", uid), { uid }),
      runTransaction(db, async (transaction) => {
        const revision = doc(db, "users", uid, "appState", "trainingLegacyRevision");
        const previous = await transaction.get(revision);
        transaction.set(doc(db, "users", uid, "programs", "p"), { id: "p", name: "Synthetic program", archived: true, days, routines: days, createdAt: new Timestamp(1, 987654321) });
        transaction.set(revision, { revision: (previous.exists() ? previous.data().revision : 0) + 1 });
      }),
      setDoc(doc(db, "users", uid, "completedWorkouts", "history"), { id: "history", exercises: [], unchanged: "Synthetic historical data" }),
      setDoc(doc(db, "users", uid, "appState", "planning"), { activeProgramId: "p", schedule: [{ id: "mon", routineDayId: "r" }] }),
    ]);
  }
  const backup = await captureTrainingReadinessFromFirestore({ ...context, isCurrent: () => context.auth.currentUser?.uid === uid });
  const options = { ...context, backup, enabled: true, confirmation: `STAGE ${uid}` };
  const adapter = createIndependentWorkoutStageFirestore(options);
  const engine = { uid, projectId, backup, firestore: db, attemptId: "fixture-attempt", adapter, isCurrent: () => context.auth.currentUser?.uid === uid };
  return { context, db, uid, backup, options, adapter, engine };
}
async function marker(h) { return (await getDocFromServer(doc(h.db, "users", h.uid, "appState", INDEPENDENT_WORKOUT_STAGE_MARKER))).data(); }
async function prepared(h) {
  const { exported: current } = await h.adapter.readSourceFromServer();
  return prepareIndependentWorkoutStage({ uid: h.uid, projectId, backup: h.backup, current, firestore: h.db });
}
const lockFor = (stage, attemptId) => ({ status: "staging", attemptId, sourceFingerprint: stage.sourceFingerprint, targetFingerprint: stage.targetFingerprint, legacyAuthoritative: true });
const denied = (promise) => assert.rejects(promise, (error) => error.code === "permission-denied");

try {
  const basic = await fixture("fixture-basic");
  const plan = await prepared(basic);
  assert.equal((await basic.adapter.readTargetsFromServer()).documents.length, 0, "missing collections are a confirmed empty inventory");
  const beforeProgram = (await getDocFromServer(doc(basic.db, "users", basic.uid, "programs", "p"))).data();
  const beforeHistory = (await getDocFromServer(doc(basic.db, "users", basic.uid, "completedWorkouts", "history"))).data();
  // Identical existing target must be accepted without an update (rules deny updates).
  await setDoc(doc(basic.db, plan.documents[0].path), plan.documents[0].data);
  assert.equal((await stageIndependentWorkouts(basic.engine)).ok, true);
  const verified = await marker(basic);
  assert.equal(verified.status, "verified");
  assert.equal(verified.cutoverAllowed, false);
  assert.equal((await stageIndependentWorkouts(basic.engine)).reused, true);
  same((await getDocFromServer(doc(basic.db, "users", basic.uid, "programs", "p"))).data(), beforeProgram);
  same((await getDocFromServer(doc(basic.db, "users", basic.uid, "completedWorkouts", "history"))).data(), beforeHistory);
  const intruder = client("fixture-intruder");
  for (const target of plan.documents) {
    await denied(getDocFromServer(doc(intruder.firestore, target.path)));
    await denied(setDoc(doc(intruder.firestore, target.path), target.data));
    await denied(updateDoc(doc(basic.db, target.path), { name: "Must be denied" }));
    await denied(deleteDoc(doc(basic.db, target.path)));
  }
  await denied(setDoc(doc(intruder.firestore, "users", basic.uid, "workouts", "foreign-create"), { id: "foreign-create", name: "Denied fixture", archived: false, programId: null, exercises: [] }));
  await denied(setDoc(doc(intruder.firestore, "users", basic.uid, "programsV2", "foreign-create"), { id: "foreign-create", name: "Denied fixture", archived: false, workoutIds: [] }));
  await denied(setDoc(doc(basic.db, "users", basic.uid, "workouts", "bad"), { id: "different-id", name: "Denied fixture", archived: false, programId: null, exercises: [] }));
  await denied(setDoc(doc(basic.db, "users", basic.uid, "programsV2", "bad"), { id: "bad", name: "Bad", archived: false, workoutIds: [], days: [] }));
  await assert.rejects(basic.adapter.createOrVerifyDocuments([{ path: `users/${basic.uid}/programs/p`, exists: true, data: beforeProgram }]), /invalid_stage_target/);
  const disabled = createIndependentWorkoutStageFirestore({ ...basic.options, enabled: false });
  await assert.rejects(disabled.claimStage(null, lockFor(plan, "disabled")), /staging_activation_disabled/);
  const unconfirmed = createIndependentWorkoutStageFirestore({ ...basic.options, confirmation: "wrong" });
  await assert.rejects(unconfirmed.claimStage(null, lockFor(plan, "wrong")), /staging_activation_disabled/);
  await disableNetwork(basic.db);
  await assert.rejects(basic.adapter.readTargetsFromServer());
  await assert.rejects(basic.adapter.readSourceFromServer());
  await enableNetwork(basic.db);
  process.stdout.write("PASS owner rules, server-only inventory, immutable/idempotent targets, path and activation gates\n");

  const race = await fixture("fixture-race"), racePlan = await prepared(race);
  const a = race.adapter, b = createIndependentWorkoutStageFirestore(race.options);
  const locks = [lockFor(racePlan, "attempt-a"), lockFor(racePlan, "attempt-b")];
  const claims = await Promise.allSettled([a.claimStage(null, locks[0]), b.claimStage(null, locks[1])]);
  assert.equal(claims.filter((entry) => entry.status === "fulfilled").length, 1);
  const winner = claims[0].status === "fulfilled" ? a : b;
  const lock = claims[0].status === "fulfilled" ? locks[0] : locks[1];
  await assert.rejects(winner.claimStage(null, lock), /stage_marker_changed/);
  await Promise.all([winner.createOrVerifyDocuments(racePlan.documents), winner.createOrVerifyDocuments(racePlan.documents)]);
  await winner.completeStage(lock, { ...lock, status: "verified", schemaVersion: 2, cutoverAllowed: false });
  assert.equal((await marker(race)).attemptId, lock.attemptId);
  await assert.rejects(winner.completeStage({ ...lock, attemptId: "wrong" }, { ...lock, status: "verified" }), /invalid_verified_marker/);
  process.stdout.write("PASS transactional claim race, marker CAS and concurrent create-if-identical retries\n");

  const partial = await fixture("fixture-partial");
  let batches = 0;
  const originalWrite = partial.adapter.createOrVerifyDocuments;
  partial.adapter.createOrVerifyDocuments = async (entries) => { if (++batches === 2) throw new Error("synthetic_interruption"); return originalWrite(entries); };
  const stopped = await stageIndependentWorkouts({ ...partial.engine, batchSize: 1 });
  assert.equal(stopped.ok, false);
  assert.equal(stopped.stagedPaths.length, 1);
  const retryAdapter = createIndependentWorkoutStageFirestore(partial.options);
  assert.equal((await stageIndependentWorkouts({ ...partial.engine, adapter: retryAdapter, batchSize: 1 })).ok, true);
  const conflicting = await fixture("fixture-conflict"), conflictPlan = await prepared(conflicting);
  await setDoc(doc(conflicting.db, conflictPlan.documents[0].path), { ...conflictPlan.documents[0].data, name: "Conflicting fixture" });
  assert.equal((await stageIndependentWorkouts(conflicting.engine)).error, "target_conflict");
  const unknown = await fixture("fixture-inventory");
  await setDoc(doc(unknown.db, "users", unknown.uid, "workouts", "extra"), { id: "extra", name: "Extra fixture", archived: false, programId: null, exercises: [] });
  assert.equal((await stageIndependentWorkouts(unknown.engine)).error, "target_conflict");
  process.stdout.write("PASS partial interruption/resume, conflicting targets and unexpected inventory\n");

  const drift = await fixture("fixture-drift");
  const originalComplete = drift.adapter.completeStage;
  drift.adapter.completeStage = async (...args) => {
    await runTransaction(drift.db, async (transaction) => {
      const ref = doc(drift.db, "users", drift.uid, "appState", "trainingLegacyRevision");
      const revision = await transaction.get(ref);
      transaction.update(doc(drift.db, "users", drift.uid, "programs", "p"), { name: "Edit in verification window" });
      transaction.set(ref, { revision: revision.data().revision + 1 });
    });
    return originalComplete(...args);
  };
  assert.equal((await stageIndependentWorkouts(drift.engine)).error, "source_drift");
  assert.equal((await marker(drift)).status, "staging");
  const active = await fixture("fixture-active");
  await setDoc(doc(active.db, "users", active.uid, "appState", "activeWorkout"), { activeWorkoutSession: { sessionKind: "quick", exercises: [] } });
  assert.equal((await stageIndependentWorkouts(active.engine)).error, "active_session_present");
  const switching = await fixture("fixture-switch");
  const inFlight = switching.adapter.readTargetsFromServer();
  switching.context.auth.currentUser = null;
  await assert.rejects(inFlight, /account_changed/);
  const empty = await fixture("fixture-empty", true);
  const emptyResult = await stageIndependentWorkouts(empty.engine);
  assert.equal(emptyResult.ok, true);
  assert.deepEqual(emptyResult.stagedPaths, []);
  assert.equal((await getDocsFromServer(collection(empty.db, "users", empty.uid, "programs"))).size, 0);
  process.stdout.write("PASS final-window source drift, active-session/account guards and zero-program stage\n");
} finally {
  await Promise.all(apps.map((app) => deleteApp(app)));
}
