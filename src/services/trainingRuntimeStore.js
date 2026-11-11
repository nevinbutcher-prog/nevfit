import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, onSnapshot, Timestamp } from "firebase/firestore";
import { encodeFirestoreValue } from "./firestoreValueCodec.js";
import { applyTrainingOperation, assertTrainingLibrary, libraryFromProgramProjection } from "./trainingLibrary.js";

export const TRAINING_MODEL_MARKER = "trainingModel";
const same = (a, b) => JSON.stringify(encodeFirestoreValue(a)) === JSON.stringify(encodeFirestoreValue(b));
const fail = (code) => { throw new Error(code); };
const confirmed = (snapshot) => { if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) fail("unconfirmed_training_snapshot"); };
const sortLibrary = (library) => ({ ...library, programs: [...library.programs].sort((a, b) => a.id < b.id ? -1 : 1), workouts: [...library.workouts].sort((a, b) => a.id < b.id ? -1 : 1) });
export function isActivatedTrainingMarker(marker, stage) {
  return marker?.version === 2 && marker.status === "activated" && marker.verified === true &&
    Number.isSafeInteger(marker.revision) && marker.revision >= 0 && marker.activatedAt instanceof Timestamp &&
    typeof marker.stageAttemptId === "string" && marker.stageAttemptId.length > 0 &&
    /^[a-f0-9]{64}$/.test(marker.sourceFingerprint ?? "") && /^[a-f0-9]{64}$/.test(marker.targetFingerprint ?? "") &&
    stage?.status === "verified" && stage.schemaVersion === 2 && stage.cutoverAllowed === false && stage.legacyAuthoritative === true &&
    marker.stageAttemptId === stage.attemptId && marker.sourceFingerprint === stage.sourceFingerprint && marker.targetFingerprint === stage.targetFingerprint;
}

export function createTrainingRuntimeStore({ uid, firestore, auth, isMounted }) {
  if (typeof uid !== "string" || !uid || uid.includes("/")) fail("invalid_account_scope");
  const guard = () => { if (auth.currentUser?.uid !== uid || !isMounted()) fail("account_changed"); };
  const markerRef = doc(firestore, "users", uid, "appState", TRAINING_MODEL_MARKER);
  const stageRef = doc(firestore, "users", uid, "appState", "independentWorkoutStage");
  const entries = (library) => [
    ...library.programs.map((data) => ({ path: `users/${uid}/programsV2/${data.id}`, data })),
    ...library.workouts.map((data) => ({ path: `users/${uid}/workouts/${data.id}`, data })),
  ];
  async function load() {
    guard();
    const marker = await getDocFromServer(markerRef);
    guard(); confirmed(marker);
    if (!marker.exists()) return { mode: "legacy" };
    const [programs, workouts, stage, latest] = await Promise.all([
      getDocsFromServer(collection(firestore, "users", uid, "programsV2")),
      getDocsFromServer(collection(firestore, "users", uid, "workouts")),
      getDocFromServer(stageRef), getDocFromServer(markerRef),
    ]);
    guard();
    [programs, workouts, stage, latest, ...programs.docs, ...workouts.docs].forEach(confirmed);
    if (!same(marker.data(), latest.data())) fail("training_changed_refresh_required");
    if (!isActivatedTrainingMarker(marker.data(), stage.data())) fail("invalid_training_activation_marker");
    const data = (snapshots) => snapshots.map((snapshot) => {
      if (snapshot.data().id !== snapshot.id) fail("stored_training_id_mismatch");
      return snapshot.data();
    });
    const library = sortLibrary(assertTrainingLibrary({ version: 1, programs: data(programs.docs), workouts: data(workouts.docs) }));
    return { mode: "v2", marker: marker.data(), library };
  }
  async function commit(baseline, transform) {
    guard();
    if (baseline.mode !== "v2") fail("independent_mode_required");
    const current = await load();
    guard();
    if (current.mode !== "v2" || !same(current.marker, baseline.marker) || !same(current.library, sortLibrary(baseline.library))) fail("training_changed_refresh_required");
    const next = sortLibrary(assertTrainingLibrary(transform(baseline.library)));
    const oldRows = new Map(entries(baseline.library).map((entry) => [entry.path, entry.data]));
    const newRows = new Map(entries(next).map((entry) => [entry.path, entry.data]));
    const paths = [...new Set([...oldRows.keys(), ...newRows.keys()])];
    const changed = paths.filter((path) => !oldRows.has(path) || !newRows.has(path) || !same(oldRows.get(path), newRows.get(path)));
    if (!changed.length) return current;
    if (changed.length > 399) fail("training_change_too_large");
    const removedWorkouts = baseline.library.workouts.filter((workout) => !next.workouts.some((entry) => entry.id === workout.id)).map((workout) => workout.id);
    const removedPrograms = baseline.library.programs.filter((program) => !next.programs.some((entry) => entry.id === program.id)).map((program) => program.id);
    const planningRef = doc(firestore, "users", uid, "appState", "planning");
    const nextMarker = { ...baseline.marker, revision: baseline.marker.revision + 1 };
    await runTransaction(firestore, async (transaction) => {
      guard();
      const [marker, stage, ...snapshots] = await Promise.all([transaction.get(markerRef), transaction.get(stageRef), ...paths.map((path) => transaction.get(doc(firestore, path)))]);
      guard();
      [marker, stage, ...snapshots].forEach(confirmed);
      if (!isActivatedTrainingMarker(marker.data(), stage.data()) || !same(marker.data(), baseline.marker)) fail("training_changed_refresh_required");
      snapshots.forEach((snapshot, index) => {
        const old = oldRows.get(paths[index]);
        if (snapshot.exists() !== Boolean(old) || (old && !same(snapshot.data(), old))) fail("training_changed_refresh_required");
      });
      let planning;
      if (removedWorkouts.length || removedPrograms.length) {
        planning = await transaction.get(planningRef); guard(); confirmed(planning);
      }
      guard();
      for (const path of changed) {
        if (newRows.has(path)) transaction.set(doc(firestore, path), newRows.get(path));
        else transaction.delete(doc(firestore, path));
      }
      if (planning?.exists()) {
        const data = planning.data();
        transaction.set(planningRef, { ...data,
          ...(Array.isArray(data.schedule) ? { schedule: data.schedule.map((day) => removedWorkouts.includes(day.routineDayId) ? { ...day, routineDayId: null } : day) } : {}),
          ...(removedPrograms.includes(data.activeProgramId) ? { activeProgramId: null } : {}),
        });
      }
      transaction.set(markerRef, nextMarker);
    });
    guard();
    return { mode: "v2", marker: nextMarker, library: next };
  }
  return { load,
    watchActivation: (notify) => onSnapshot(markerRef, (snapshot) => {
      if (auth.currentUser?.uid === uid && isMounted() && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites && snapshot.exists()) notify();
    }, () => {}),
    saveProjectedPrograms: (baseline, programs) => commit(baseline, (library) => libraryFromProgramProjection(library, programs)),
    operate: (baseline, operation) => commit(baseline, (library) => applyTrainingOperation(library, operation)),
  };
}
