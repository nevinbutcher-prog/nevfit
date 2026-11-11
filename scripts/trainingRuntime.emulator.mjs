import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, getDocsFromServer, collection, setDoc, runTransaction, Timestamp, setLogLevel } from "firebase/firestore";
import { createIndependentWorkoutStageFirestore } from "../src/services/independentWorkoutStageFirestore.js";
import { captureTrainingReadinessFromFirestore } from "../src/services/trainingReadinessSource.js";
import { stageIndependentWorkouts } from "../src/services/independentWorkoutStage.js";
import { createTrainingRuntimeStore } from "../src/services/trainingRuntimeStore.js";
import { projectTrainingPrograms } from "../src/services/trainingLibrary.js";
import { encodeFirestoreValue } from "../src/services/firestoreValueCodec.js";
import { createSavedWorkoutSession } from "../src/services/routineBuilder.js";

const projectId = "demo-nevfit-stage";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8091" || process.env.GCLOUD_PROJECT !== projectId) throw new Error("Isolated demo emulator required; production access forbidden.");
setLogLevel("silent");
const apps = [];
const same = (a, b) => assert.deepEqual(encodeFirestoreValue(a), encodeFirestoreValue(b));
function client(uid) {
  const app = initializeApp({ projectId, apiKey: "demo-key" }, `runtime-fixture-${apps.length}`); apps.push(app);
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, "127.0.0.1", 8091, { mockUserToken: { sub: uid, user_id: uid } });
  return { uid, firestore, auth: { currentUser: { uid } }, isMounted: () => true };
}
async function writeProgram(context, data) {
  await runTransaction(context.firestore, async (transaction) => {
    const revisionRef = doc(context.firestore, "users", context.uid, "appState", "trainingLegacyRevision");
    const revision = await transaction.get(revisionRef);
    transaction.set(doc(context.firestore, "users", context.uid, "programs", data.id), data);
    transaction.set(revisionRef, { revision: (revision.exists() ? revision.data().revision : 0) + 1 });
  });
}
async function fixture(uid, empty = false) {
  const context = client(uid), { firestore: db } = context;
  const history = { id: "history", completedAt: "2026-11-10T00:00:00Z", exercises: [{ exerciseId: "wger-1", exerciseName: "Synthetic", sets: [{ setNumber: 1, weight: "20", reps: "8" }] }] };
  if (!empty) {
    await writeProgram(context, { id: "p", name: "Synthetic saved program", archived: true, createdAt: new Timestamp(123, 456789), days: [
      { id: "r", name: "Synthetic saved workout", archived: false, exercises: [{ routineExerciseId: "row-1", exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: null, note: "Original note", supersetGroupId: null }] },
    ] });
    await Promise.all([
      setDoc(doc(db, "users", uid, "completedWorkouts", "history"), history),
      setDoc(doc(db, "users", uid, "appState", "planning"), { activeProgramId: "p", schedule: [{ id: "mon", label: "Monday", routineDayId: "r", note: "Keep" }] }),
      setDoc(doc(db, "users", uid, "appState", "activeWorkout"), { activeWorkoutSession: null }),
    ]);
  }
  const backup = await captureTrainingReadinessFromFirestore({ ...context, isCurrent: () => true });
  const adapter = createIndependentWorkoutStageFirestore({ ...context, backup, enabled: true, confirmation: `STAGE ${uid}` });
  const store = createTrainingRuntimeStore(context);
  const attemptId = "runtime-fixture-attempt";
  return { context, db, uid, history, backup, adapter, store, attemptId,
    stage: () => stageIndependentWorkouts({ uid, projectId, backup, firestore: db, attemptId, adapter, isCurrent: () => context.auth.currentUser?.uid === uid }),
    activate: () => adapter.activateStage({ attemptId, confirmation: `ACTIVATE ${uid}` }),
  };
}
const denied = (promise) => assert.rejects(promise, (error) => error.code === "permission-denied");
try {
  const h = await fixture("runtime-main");
  const original = (await getDocFromServer(doc(h.db, "users", h.uid, "programs", "p"))).data();
  assert.equal((await h.store.load()).mode, "legacy");
  assert.equal((await h.stage()).ok, true);
  assert.equal((await h.store.load()).mode, "legacy", "verified staging never automatically activates runtime");
  await assert.rejects(h.adapter.activateStage({ attemptId: h.attemptId, confirmation: `STAGE ${h.uid}` }), /activation_confirmation_required/);
  const activations = await Promise.allSettled([h.activate(), h.activate()]);
  assert.ok(activations.some((result) => result.status === "fulfilled"));
  let runtime = await h.store.load();
  assert.equal(runtime.mode, "v2");
  assert.equal(runtime.marker.revision, 0);
  assert.equal((await h.activate()).reused, true);
  assert.ok(runtime.library.programs[0].createdAt instanceof Timestamp);
  assert.equal(runtime.library.programs[0].archived, true);
  const projection = projectTrainingPrograms(runtime.library).map((program) => ({ ...program, archived: false, days: program.days.map((workout) => ({ ...workout, name: "Edited through existing UI", exercises: workout.exercises.map((row) => ({ ...row, note: "Edited note", sets: 4 })) })) }));
  runtime = await h.store.saveProjectedPrograms(runtime, projection);
  assert.equal(runtime.library.workouts[0].name, "Edited through existing UI");
  assert.equal(runtime.library.workouts[0].exercises[0].note, "Edited note");
  same((await getDocFromServer(doc(h.db, "users", h.uid, "programs", "p"))).data(), original);
  await denied(writeProgram(h.context, { ...original, name: "Forbidden legacy fork" }));
  await denied(setDoc(doc(h.db, "users", h.uid, "workouts", "rogue"), { id: "rogue", name: "Uncoordinated", archived: false, programId: null, exercises: [] }));
  runtime = await h.store.operate(runtime, { type: "createWorkout", workout: { id: "standalone", name: "Standalone", exercises: [] } });
  runtime = await h.store.operate(runtime, { type: "moveWorkout", id: "standalone", programId: "p", index: 0 });
  assert.deepEqual(runtime.library.programs[0].workoutIds, ["standalone", "r"]);
  runtime = await h.store.operate(runtime, { type: "archiveWorkout", id: "standalone", archived: true });
  runtime = await h.store.operate(runtime, { type: "archiveWorkout", id: "standalone", archived: false });
  const stale = runtime;
  runtime = await h.store.operate(runtime, { type: "saveProgram", id: "p", program: { name: "Later edit" } });
  await assert.rejects(h.store.saveProjectedPrograms(stale, projectTrainingPrograms(stale.library)), /training_changed_refresh_required/);
  const session = createSavedWorkoutSession(runtime.library.workouts.find((workout) => workout.id === "r"), { id: "mon" }, () => "Synthetic exercise");
  await setDoc(doc(h.db, "users", h.uid, "appState", "activeWorkout"), { activeWorkoutSession: session });
  await denied(setDoc(doc(h.db, "users", h.uid, "appState", "activeWorkout"), { activeWorkoutSession: { routineDayId: "r", exercises: [] } }));
  runtime = await h.store.operate(runtime, { type: "deleteProgram", id: "p" });
  assert.deepEqual(runtime.library.programs, []);
  assert.ok(runtime.library.workouts.every((workout) => workout.programId === null));
  assert.deepEqual(projectTrainingPrograms(runtime.library), []);
  runtime = await h.store.operate(runtime, { type: "deleteWorkout", id: "r" });
  assert.equal((await getDocFromServer(doc(h.db, "users", h.uid, "appState", "planning"))).data().schedule[0].routineDayId, null);
  same((await getDocFromServer(doc(h.db, "users", h.uid, "appState", "activeWorkout"))).data().activeWorkoutSession, session);
  same((await getDocFromServer(doc(h.db, "users", h.uid, "completedWorkouts", "history"))).data(), h.history);
  same((await getDocFromServer(doc(h.db, "users", h.uid, "programs", "p"))).data(), original);
  assert.equal((await h.store.load()).library.workouts[0].id, "standalone");
  const other = client("runtime-other");
  await denied(getDocFromServer(doc(other.firestore, "users", h.uid, "appState", "trainingModel")));
  await denied(setDoc(doc(other.firestore, "users", h.uid, "appState", "trainingModel"), runtime.marker));
  h.context.auth.currentUser = null;
  await assert.rejects(h.store.load(), /account_changed/);
  process.stdout.write("PASS explicit activation, competing/repeated activation, v2 UI projection/CRUD, ownership/order, source/history immutability and account guards\n");

  const drift = await fixture("runtime-drift");
  assert.equal((await drift.stage()).ok, true);
  const source = (await getDocFromServer(doc(drift.db, "users", drift.uid, "programs", "p"))).data();
  await writeProgram(drift.context, { ...source, name: "Other device edit" });
  await assert.rejects(drift.activate(), /source_drift/);
  assert.equal((await drift.store.load()).mode, "legacy");
  assert.equal((await getDocFromServer(doc(drift.db, "users", drift.uid, "appState", "trainingModel"))).exists(), false);
  const active = await fixture("runtime-active");
  assert.equal((await active.stage()).ok, true);
  await setDoc(doc(active.db, "users", active.uid, "appState", "activeWorkout"), { activeWorkoutSession: { sessionKind: "quick", exercises: [] } });
  await assert.rejects(active.activate(), /active_session_present/);
  assert.equal((await active.store.load()).mode, "legacy");
  const empty = await fixture("runtime-empty", true);
  await assert.rejects(empty.activate(), /verified_stage_required/);
  assert.equal((await empty.stage()).ok, true);
  await empty.activate();
  let emptyRuntime = await empty.store.load();
  assert.deepEqual(emptyRuntime.library, { version: 1, programs: [], workouts: [] });
  emptyRuntime = await empty.store.operate(emptyRuntime, { type: "createWorkout", workout: { id: "solo", name: "Only standalone", exercises: [] } });
  assert.equal(emptyRuntime.library.programs.length, 0);
  assert.equal(emptyRuntime.library.workouts[0].programId, null);
  assert.equal((await getDocsFromServer(collection(empty.db, "users", empty.uid, "programs"))).size, 0);
  process.stdout.write("PASS drift/active-session activation rejection, verified-stage gate and zero-program/standalone runtime\n");
} finally { await Promise.all(apps.map((app) => deleteApp(app))); }
