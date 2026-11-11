import test from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase/firestore";
import { encodeFirestoreValue, decodeFirestoreValue } from "../src/services/firestoreValueCodec.js";
import { createTrainingReadinessExport } from "../src/services/trainingReadinessBackup.js";
import { prepareIndependentWorkoutStage, stageIndependentWorkouts } from "../src/services/independentWorkoutStage.js";

const uid = "synthetic-stage-user", projectId = "demo-stage", capturedAt = "2026-11-11T01:00:00Z";
const clone = (value) => decodeFirestoreValue(encodeFirestoreValue(value));
const same = (a, b) => JSON.stringify(encodeFirestoreValue(a)) === JSON.stringify(encodeFirestoreValue(b));
const row = (relative, data) => ({ path: `users/${uid}/${relative}`, exists: true, data });
async function harness() {
  const source = [
    { path: `users/${uid}`, exists: true, data: { uid } },
    row("programs/p", { id: "p", name: "Real saved program", archived: true, createdAt: new Timestamp(10, 123456789), days: [
      { id: "r", name: "Saved workout", archived: false, exercises: [{ routineExerciseId: "row-1", exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: 120, note: "Keep", supersetGroupId: null }] },
    ] }),
    row("appState/planning", { activeProgramId: "p", schedule: [{ id: "mon", routineDayId: "r" }] }),
    row("appState/activeWorkout", { activeWorkoutSession: null }),
    row("appState/exerciseNotes", { notes: { "wger-1": "Unchanged" } }),
    row("completedWorkouts/history", { id: "history", exercises: [], extra: "Never rewritten" }),
  ];
  const read = () => createTrainingReadinessExport({ uid, projectId, capturedAt, documents: source });
  const backup = await read();
  const targets = new Map();
  const writes = [];
  let marker = null, batches = 0;
  const controls = { failBatch: null, corrupt: false, pending: false };
  const adapter = {
    readSourceFromServer: async () => ({ exported: await read(), pendingWrites: controls.pending }),
    readTargetsFromServer: async () => ({ documents: clone([...targets.values()]), marker: clone(marker), pendingWrites: false }),
    claimStage: async (expected, next) => { assert.ok(same(marker, expected)); marker = clone(next); writes.push("claim"); },
    createOrVerifyDocuments: async (entries) => {
      if (++batches === controls.failBatch) throw new Error("synthetic_interruption");
      for (const entry of entries) {
        assert.match(entry.path, /\/(workouts|programsV2)\//);
        if (targets.has(entry.path) && !same(targets.get(entry.path), entry)) throw new Error("target_conflict");
      }
      entries.forEach((entry) => { targets.set(entry.path, clone(entry)); writes.push(entry.path); });
      if (controls.corrupt) targets.get(entries[0].path).data.name = "Mismatch";
    },
    completeStage: async (expected, next) => { assert.ok(same(marker, expected)); marker = clone(next); writes.push("verified"); },
  };
  const options = { uid, projectId, backup, attemptId: "fixture-attempt", adapter, isCurrent: () => true };
  return { source, backup, read, targets, writes, controls, adapter, options, marker: () => marker, setMarker: (next) => { marker = next; } };
}

test("stage serialization retains typed metadata, IDs/prescriptions/ownership and leaves source/history unchanged; repeats verify without writes", async () => {
  const h = await harness();
  h.source[0].data.updatedAt = new Timestamp(20, 0);
  h.source.push(row("appState/robCoaching", { experimental: "Not a migration gate" }));
  const before = clone(h.source);
  const prepared = await prepareIndependentWorkoutStage({ uid, projectId, backup: h.backup, current: await h.read() });
  const program = prepared.documents.find((entry) => entry.path.includes("programsV2"));
  assert.ok(program.data.createdAt instanceof Timestamp);
  assert.equal(program.data.createdAt.nanoseconds, 123456789);
  assert.deepEqual(program.data.workoutIds, ["r"]);
  const workout = prepared.documents.find((entry) => entry.path.includes("workouts"));
  assert.equal(workout.data.programId, "p");
  assert.deepEqual(workout.data.exercises, h.source[1].data.days[0].exercises);
  const first = await stageIndependentWorkouts(h.options);
  assert.equal(first.ok, true);
  assert.equal(h.marker().status, "verified");
  assert.equal(h.marker().cutoverAllowed, false);
  const writeCount = h.writes.length;
  const retry = await stageIndependentWorkouts(h.options);
  assert.equal(retry.reused, true);
  assert.equal(h.writes.length, writeCount);
  assert.ok(same(h.source, before));
});

test("interrupted staging reports the exact matching subset and retries the same attempt without deleting or replacing originals", async () => {
  const h = await harness();
  h.controls.failBatch = 2;
  const interrupted = await stageIndependentWorkouts({ ...h.options, batchSize: 1 });
  assert.equal(interrupted.ok, false);
  assert.equal(interrupted.stagedPaths.length, 1);
  assert.equal(h.marker().status, "staging");
  h.controls.failBatch = null;
  const retry = await stageIndependentWorkouts({ ...h.options, batchSize: 1 });
  assert.equal(retry.ok, true);
  assert.equal(retry.stagedPaths.length, 2);
});

test("source drift, pending writes and any active session reject before staging", async () => {
  const h = await harness();
  h.source[1].data.name = "Changed";
  assert.equal((await stageIndependentWorkouts(h.options)).error, "source_drift");
  h.source[1].data.name = "Real saved program";
  h.controls.pending = true;
  assert.equal((await stageIndependentWorkouts(h.options)).error, "pending_source_writes");
  h.controls.pending = false;
  h.source[3].data.activeWorkoutSession = { sessionKind: "quick", exercises: [] };
  assert.equal((await stageIndependentWorkouts(h.options)).error, "active_session_present");
  assert.deepEqual(h.writes, []);
});

test("conflicting targets, competing attempts and verification mismatches never publish a verified marker", async () => {
  const h = await harness();
  h.targets.set(`users/${uid}/workouts/r`, row("workouts/r", { name: "Conflict" }));
  const conflict = await stageIndependentWorkouts(h.options);
  assert.equal(conflict.error, "target_conflict");
  assert.deepEqual(conflict.stagedPaths, []);
  h.targets.clear();
  const prepared = await prepareIndependentWorkoutStage({ uid, projectId, backup: h.backup, current: await h.read() });
  h.setMarker({ status: "staging", attemptId: "other-attempt", sourceFingerprint: prepared.sourceFingerprint, targetFingerprint: prepared.targetFingerprint });
  assert.equal((await stageIndependentWorkouts(h.options)).error, "another_migration_in_progress");
  h.setMarker(null);
  h.controls.corrupt = true;
  assert.equal((await stageIndependentWorkouts(h.options)).error, "target_conflict");
  assert.equal(h.marker().status, "staging");
  assert.ok(!h.writes.includes("verified"));
});

test("account changes and edits after a verified stage require fresh reconciliation", async () => {
  const h = await harness();
  const cancelled = await stageIndependentWorkouts({ ...h.options, isCurrent: () => false });
  assert.equal(cancelled.error, "account_changed");
  assert.deepEqual(h.writes, []);
  assert.equal((await stageIndependentWorkouts(h.options)).ok, true);
  h.source[1].data.name = "Later edit";
  assert.equal((await stageIndependentWorkouts(h.options)).error, "source_drift");
  assert.equal(h.marker().status, "verified", "marker is an old fingerprint, never a runtime authority switch");
});
