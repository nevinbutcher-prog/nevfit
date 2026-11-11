import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction } from "firebase/firestore";
import { captureTrainingReadinessFromFirestore } from "./trainingReadinessSource.js";
import { isIndependentWorkoutSource, prepareIndependentWorkoutStage } from "./independentWorkoutStage.js";
import { decodeFirestoreValue, encodeFirestoreValue } from "./firestoreValueCodec.js";

export const INDEPENDENT_WORKOUT_STAGE_MARKER = "independentWorkoutStage";
const same = (a, b) => JSON.stringify(encodeFirestoreValue(a)) === JSON.stringify(encodeFirestoreValue(b));
const fail = (code) => { throw new Error(code); };
const confirmed = (snapshot) => {
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) fail("unconfirmed_server_snapshot");
};

// Concrete owner-authenticated adapter; constructing it performs no reads/writes.
// No app imports or automatic invocation. Writes require BOTH opt-in and typed UID.
export function createIndependentWorkoutStageFirestore({ uid, firestore, auth, isMounted, backup, enabled = false, confirmation = "" }) {
  if (typeof uid !== "string" || !uid || uid !== uid.trim() || uid.includes("/") || typeof isMounted !== "function") fail("invalid_account_scope");
  const projectId = firestore.app.options.projectId;
  const database = firestore.toJSON().databaseId;
  if (database.projectId !== projectId || database.database !== "(default)") fail("invalid_database_scope");
  const markerRef = doc(firestore, "users", uid, "appState", INDEPENDENT_WORKOUT_STAGE_MARKER);
  let claimedLock = null;
  const guard = () => {
    if (auth.currentUser?.uid !== uid || !isMounted()) fail("account_changed");
  };
  const writeGuard = () => {
    guard();
    if (enabled !== true || confirmation !== `STAGE ${uid}`) fail("staging_activation_disabled");
  };
  async function refresh() {
    guard();
    const exported = await captureTrainingReadinessFromFirestore({ uid, firestore, isCurrent: () => auth.currentUser?.uid === uid && isMounted() });
    guard();
    const stage = await prepareIndependentWorkoutStage({ uid, projectId, backup, current: exported, firestore });
    guard();
    const sources = new Map(exported.documents.filter(isIndependentWorkoutSource).map((entry) => [entry.path, {
      path: entry.path, exists: entry.exists, data: entry.exists ? decodeFirestoreValue(entry.value, firestore) : null,
    }]));
    // Guard creation of a previously absent active/planning/note/health document too.
    for (const id of ["planning", "activeWorkout", "exerciseNotes", "health"]) {
      const path = `users/${uid}/appState/${id}`;
      if (!sources.has(path)) sources.set(path, { path, exists: false, data: null });
    }
    return { exported, stage, sources: [...sources.values()] };
  }
  async function readTargetsFromServer() {
    guard();
    const [workouts, programs, marker] = await Promise.all([
      getDocsFromServer(collection(firestore, "users", uid, "workouts")),
      getDocsFromServer(collection(firestore, "users", uid, "programsV2")),
      getDocFromServer(markerRef),
    ]);
    guard();
    [workouts, programs, marker, ...workouts.docs, ...programs.docs].forEach(confirmed);
    return { documents: [...workouts.docs, ...programs.docs].map((snapshot) => ({ path: snapshot.ref.path, exists: true, data: snapshot.data() })),
      marker: marker.exists() ? marker.data() : null, pendingWrites: false };
  }
  async function transactionRead(transaction, refs) {
    guard();
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    guard();
    snapshots.forEach(confirmed);
    return snapshots;
  }
  async function verifySourcesInTransaction(transaction, sources) {
    const snapshots = await transactionRead(transaction, sources.map((entry) => doc(firestore, entry.path)));
    snapshots.forEach((snapshot, index) => {
      const expected = sources[index];
      if (snapshot.exists() !== expected.exists || (expected.exists && !same(snapshot.data(), expected.data))) fail("source_drift_in_transaction");
    });
  }
  const validateLock = (lock, stage) => {
    if (typeof lock?.attemptId !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(lock.attemptId)) fail("invalid_stage_lock");
    const desired = { status: "staging", attemptId: lock.attemptId, sourceFingerprint: stage.sourceFingerprint,
      targetFingerprint: stage.targetFingerprint, legacyAuthoritative: true };
    if (!same(lock, desired)) fail("invalid_stage_lock");
    return desired;
  };

  return {
    readSourceFromServer: async () => ({ exported: (await refresh()).exported, pendingWrites: false }),
    readTargetsFromServer,
    async claimStage(expected, lock) {
      writeGuard();
      const { stage, sources } = await refresh();
      const desired = validateLock(lock, stage);
      if (expected !== null && !same(expected, desired)) fail("another_migration_in_progress");
      await runTransaction(firestore, async (transaction) => {
        writeGuard();
        const [marker] = await transactionRead(transaction, [markerRef]);
        await verifySourcesInTransaction(transaction, sources);
        if (!same(marker.exists() ? marker.data() : null, expected)) fail("stage_marker_changed");
        writeGuard();
        if (!marker.exists()) transaction.set(markerRef, desired);
      });
      writeGuard();
      claimedLock = desired;
    },
    async createOrVerifyDocuments(entries) {
      writeGuard();
      if (!claimedLock) fail("stage_not_claimed");
      if (!Array.isArray(entries) || entries.length > 400) fail("invalid_stage_batch");
      const { stage, sources } = await refresh();
      validateLock(claimedLock, stage);
      const planned = new Map(stage.documents.map((entry) => [entry.path, entry]));
      const seen = new Set();
      const checked = entries.map((entry) => {
        // Writes can only use exact source-derived target data, never caller payloads.
        if (!entry || seen.has(entry.path) || !planned.has(entry.path) || !same(entry, planned.get(entry.path))) fail("invalid_stage_target");
        seen.add(entry.path);
        return planned.get(entry.path);
      });
      await runTransaction(firestore, async (transaction) => {
        writeGuard();
        const [marker, ...targets] = await transactionRead(transaction, [markerRef, ...checked.map((entry) => doc(firestore, entry.path))]);
        await verifySourcesInTransaction(transaction, sources);
        if (!marker.exists() || !same(marker.data(), claimedLock)) fail("stage_marker_changed");
        targets.forEach((snapshot, index) => {
          if (snapshot.exists() && !same(snapshot.data(), checked[index].data)) fail("target_conflict");
        });
        writeGuard();
        targets.forEach((snapshot, index) => {
          // The transaction's absent read is the create precondition. Races retry.
          if (!snapshot.exists()) transaction.set(doc(firestore, checked[index].path), checked[index].data);
        });
      });
      writeGuard();
    },
    async completeStage(expected, verified) {
      writeGuard();
      if (!claimedLock || !same(expected, claimedLock) || !same(verified, { ...claimedLock, status: "verified", schemaVersion: 2, cutoverAllowed: false })) fail("invalid_verified_marker");
      // Fresh full source queries immediately before publishing, not just engine checks.
      const { stage, sources } = await refresh();
      validateLock(claimedLock, stage);
      const inventory = await readTargetsFromServer();
      const planned = new Map(stage.documents.map((entry) => [entry.path, entry]));
      if (inventory.documents.length !== planned.size || inventory.documents.some((entry) => !planned.has(entry.path) || !same(entry, planned.get(entry.path)))) fail("verification_mismatch");
      await runTransaction(firestore, async (transaction) => {
        writeGuard();
        const [marker, ...targets] = await transactionRead(transaction, [markerRef, ...stage.documents.map((entry) => doc(firestore, entry.path))]);
        await verifySourcesInTransaction(transaction, sources);
        if (!marker.exists() || !same(marker.data(), claimedLock)) fail("stage_marker_changed");
        targets.forEach((snapshot, index) => {
          if (!snapshot.exists() || !same(snapshot.data(), stage.documents[index].data)) fail("verification_mismatch");
        });
        writeGuard();
        transaction.set(markerRef, { ...claimedLock, status: "verified", schemaVersion: 2, cutoverAllowed: false });
      });
      writeGuard();
      const marker = await getDocFromServer(markerRef);
      writeGuard();
      confirmed(marker);
      if (!marker.exists() || !same(marker.data(), verified)) fail("verified_marker_readback_mismatch");
    },
  };
}
