import { decodeFirestoreValue } from "./firestoreValueCodec.js";
import { fingerprintTrainingDocuments, verifyTrainingReadinessExport } from "./trainingReadinessBackup.js";

export const isIndependentWorkoutSource = (entry) => ["programs", "completedWorkouts"].includes(entry.path.split("/")[2]) ||
  /^users\/[^/]+\/appState\/(planning|activeWorkout|exerciseNotes|health|trainingLegacyRevision)$/.test(entry.path);
const decode = (exported, firestore) => exported.documents.map((entry) => ({ path: entry.path, exists: entry.exists,
  data: entry.exists ? decodeFirestoreValue(entry.value, firestore) : null,
}));
const fail = (code) => { throw new Error(code); };

export async function prepareIndependentWorkoutStage({ uid, projectId, backup, current, firestore }) {
  await verifyTrainingReadinessExport(backup, { uid, projectId, firestore });
  await verifyTrainingReadinessExport(current, { uid, projectId, firestore });
  const sources = decode(current, firestore);
  const active = sources.find((entry) => entry.path === `users/${uid}/appState/activeWorkout` && entry.exists)?.data.activeWorkoutSession;
  if (active != null) fail("active_session_present");
  if (!backup.preflight.legacyValidationPassed || !current.preflight.legacyValidationPassed) fail("unresolved_preflight");
  const sourceFingerprint = await fingerprintTrainingDocuments(sources.filter(isIndependentWorkoutSource));
  if (sourceFingerprint !== await fingerprintTrainingDocuments(decode(backup, firestore).filter(isIndependentWorkoutSource))) fail("source_drift");
  const plan = current.preflight.plan;
  if (!plan.ok || !plan.target) fail("invalid_migration_plan");
  const rawPrograms = new Map(sources.filter((entry) => entry.path.split("/")[2] === "programs").map((entry) => [entry.path.split("/").at(-1), entry.data]));
  const documents = [];
  for (const program of plan.target.programs) {
    const metadata = Object.fromEntries(Object.entries(rawPrograms.get(program.id)).filter(([key]) => !["days", "routines"].includes(key)));
    documents.push({ path: `users/${uid}/programsV2/${program.id}`, exists: true,
      data: { ...metadata, id: program.id, archived: program.archived, workoutIds: program.workoutIds } });
  }
  for (const workout of plan.target.workouts) {
    const mapping = plan.mappings.find((entry) => entry.workoutId === workout.id);
    const program = rawPrograms.get(mapping.programId);
    const raw = (program.days ?? program.routines).find((entry) => entry.id === mapping.legacyRoutineId);
    documents.push({ path: `users/${uid}/workouts/${workout.id}`, exists: true, data: {
      ...raw, id: workout.id, programId: workout.programId, archived: workout.archived,
      exercises: raw.exercises.map((entry, index) => ({ ...entry,
        routineExerciseId: workout.exercises[index].routineExerciseId,
        ...(!Object.hasOwn(entry, "supersetGroupId") && Object.hasOwn(entry, "groupId") ? { supersetGroupId: entry.groupId } : {}),
      })),
    } });
  }
  return { uid, sourceFingerprint, targetFingerprint: await fingerprintTrainingDocuments(documents), documents,
    counts: current.manifest.counts, mappings: plan.mappings, cutoverAllowed: false };
}

async function inspectTargets(stage, state, requireComplete = false) {
  if (state.pendingWrites !== false) fail("pending_target_writes");
  const expected = new Map(stage.documents.map((entry) => [entry.path, entry]));
  const seen = new Set();
  for (const entry of state.documents) {
    if (seen.has(entry.path) || !expected.has(entry.path) || !entry.exists ||
        await fingerprintTrainingDocuments([entry]) !== await fingerprintTrainingDocuments([expected.get(entry.path)])) fail("target_conflict");
    seen.add(entry.path);
  }
  if (requireComplete && seen.size !== expected.size) fail("verification_mismatch");
  return [...seen].sort();
}

// 069 supplies a separately gated Firestore adapter. No startup/UI activation.
export async function stageIndependentWorkouts({ uid, projectId, backup, firestore, attemptId, adapter, isCurrent, batchSize = 400 }) {
  let stage;
  let phase = "source_validation";
  const guard = () => { if (!isCurrent()) fail("account_changed"); };
  const refresh = async () => {
    guard();
    const source = await adapter.readSourceFromServer();
    guard();
    if (source.pendingWrites !== false) fail("pending_source_writes");
    const prepared = await prepareIndependentWorkoutStage({ uid, projectId, backup, current: source.exported, firestore });
    guard();
    return prepared;
  };
  try {
    if (typeof attemptId !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(attemptId)) fail("explicit_attempt_id_required");
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 400) fail("invalid_batch_size");
    stage = await refresh();
    phase = "target_validation";
    let state = await adapter.readTargetsFromServer();
    guard();
    await inspectTargets(stage, state);
    guard();
    const marker = state.marker;
    if (marker && (marker.sourceFingerprint !== stage.sourceFingerprint || marker.targetFingerprint !== stage.targetFingerprint)) fail("stale_stage_marker");
    if (marker?.status === "verified") {
      const stagedPaths = await inspectTargets(stage, state, true);
      await refresh();
      guard();
      return { ok: true, reused: true, stagedPaths, sourceCounts: stage.counts, sourceFingerprint: stage.sourceFingerprint, cutoverAllowed: false };
    }
    if (marker && (marker.status !== "staging" || marker.attemptId !== attemptId)) fail("another_migration_in_progress");
    const lock = { status: "staging", attemptId, sourceFingerprint: stage.sourceFingerprint, targetFingerprint: stage.targetFingerprint, legacyAuthoritative: true };
    phase = "claim";
    guard();
    await adapter.claimStage(marker ?? null, lock);
    guard();
    phase = "staging";
    for (let index = 0; index < stage.documents.length; index += batchSize) {
      await refresh();
      guard();
      await adapter.createOrVerifyDocuments(stage.documents.slice(index, index + batchSize));
      guard();
    }
    phase = "verification";
    await refresh();
    state = await adapter.readTargetsFromServer();
    guard();
    const stagedPaths = await inspectTargets(stage, state, true);
    phase = "verification_marker";
    guard();
    await adapter.completeStage(lock, { ...lock, status: "verified", schemaVersion: 2, cutoverAllowed: false });
    guard();
    return { ok: true, reused: false, stagedPaths, sourceCounts: stage.counts, sourceFingerprint: stage.sourceFingerprint, cutoverAllowed: false };
  } catch (error) {
    let stagedPaths = null;
    let observedTargetPaths = null;
    if (stage && isCurrent()) {
      try {
        const state = await adapter.readTargetsFromServer();
        guard();
        const matching = [];
        for (const entry of state.documents) {
          const expected = stage.documents.find((candidate) => candidate.path === entry.path);
          if (expected && await fingerprintTrainingDocuments([entry]) === await fingerprintTrainingDocuments([expected])) matching.push(entry.path);
        }
        guard();
        stagedPaths = matching.sort();
        observedTargetPaths = state.documents.map((entry) => entry.path).sort();
      } catch { /* Unknown inventory stays null; never claim an empty stage. */ }
    }
    return { ok: false, phase, error: error.message, stagedPaths, observedTargetPaths, sourceCounts: stage?.counts ?? null, cutoverAllowed: false };
  }
}
