import test, { after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, doc, Timestamp, Bytes, GeoPoint, vector } from "firebase/firestore";
import { encodeFirestoreValue, decodeFirestoreValue } from "../src/services/firestoreValueCodec.js";
import { createTrainingReadinessExport, verifyTrainingReadinessExport, captureTrainingReadiness } from "../src/services/trainingReadinessBackup.js";
import { createTrainingReadinessReport } from "../src/services/trainingReadinessReport.js";

// Creates only local SDK value/reference objects; no SDK reads, auth or writes.
const app = initializeApp({ projectId: "demo-training-readiness" }, "training-readiness-values");
const firestore = getFirestore(app);
after(() => deleteApp(app));
const uid = "fixture-user";
const projectId = "demo-training-readiness";
const capturedAt = "2026-11-11T03:00:00.000Z";
const document = (relative, data, exists = true) => ({ path: `users/${uid}${relative ? `/${relative}` : ""}`, exists, data });
const routine = (id) => ({ id, name: id, archived: true, exercises: [{
  exerciseId: "wger-1", routineExerciseId: "row-1", sets: 3, repRange: "8-12", note: "Preserved", restSeconds: 90,
}] });
const fixtures = () => [
  document("", { uid, timestamp: new Timestamp(12345, 987654321) }),
  document("programs/p", { id: "p", name: "Program", archived: true, days: [routine("r")], routines: [routine("r")], createdAt: new Timestamp(12000, 123) }),
  document("appState/planning", { schedule: [{ id: "mon", routineDayId: "r" }, { id: "tue", routineDayId: null }], activeProgramId: "p" }),
  document("appState/activeWorkout", { activeWorkoutSession: { routineDayId: "r", exercises: [] } }),
  document("appState/robCoaching", { goals: ["Preserved"] }),
  document("appState/weeklyCheckIn-2026-11-09", { review: "Preserved review" }),
  document("appState/health", { bytes: Bytes.fromUint8Array(new Uint8Array([0, 255, 12])), position: new GeoPoint(12.5, -40.25), values: vector([1, 2]), reference: doc(firestore, "users", uid), special: [NaN, Infinity, -Infinity, -0] }),
  document("completedWorkouts/history-id", { id: "stored-history-id", exercises: [], completedAt: "2026-11-10", extra: { type: "timestamp", value: "ordinary map" } }),
];
const options = (sourceDocuments) => ({ uid, projectId, sourceDocuments, firestore });

test("known-document export preserves typed raw values, paths and aliases and verifies actual JSON against sources", async () => {
  const sources = fixtures();
  const before = encodeFirestoreValue(sources);
  const exported = await createTrainingReadinessExport({ uid, projectId, capturedAt, documents: sources }, firestore);
  const json = JSON.parse(JSON.stringify(exported));
  const result = await verifyTrainingReadinessExport(json, options(sources));
  assert.deepEqual(result.counts, { user: 1, programs: 1, completedWorkouts: 1, appState: 5 });
  assert.equal(result.sha256.length, 64);
  assert.equal(result.typedRoundTrip, true);
  assert.equal(result.matchesFetchedSources, true);
  assert.equal(json.coverage.exhaustiveAccountBackup, false);
  assert.equal(json.coverage.testedDestructiveRestore, false);
  assert.equal(json.preflight.cutoverAllowed, false);
  assert.equal(json.preflight.legacyValidationPassed, true);
  assert.equal(json.preflight.plan.summary.archivedWorkouts, 1);
  assert.equal(json.preflight.plan.target.programs[0].createdAt.nanoseconds, 123);
  for (const source of sources) {
    const saved = json.documents.find((entry) => entry.path === source.path);
    const decoded = decodeFirestoreValue(saved.value, firestore);
    assert.deepEqual(encodeFirestoreValue(decoded), encodeFirestoreValue(source.data));
  }
  assert.deepEqual(encodeFirestoreValue(sources), before);
  assert.deepEqual(await createTrainingReadinessExport({ uid, projectId, capturedAt, documents: [...sources].reverse() }, firestore), exported);
});

test("collisions, alias conflicts, noncanonical prescriptions and ambiguous/missing linkage are explicit", () => {
  const sources = fixtures();
  sources.push(document("programs/other", { name: "Other", routines: [routine("r")] }));
  sources.find((entry) => entry.path.endsWith("appState/planning")).data.schedule.push({ id: "wed", routineDayId: "missing" });
  let report = createTrainingReadinessReport(uid, sources);
  assert.equal(report.collisions[0].occurrences.length, 2);
  assert.equal(report.plan.mappings.length, 2);
  assert.ok(report.linkage.some((entry) => entry.status === "ambiguous" && entry.kind === "active"));
  assert.ok(report.errors.some((entry) => entry.code === "schedule_linkage_missing"));
  const program = sources.find((entry) => entry.path.endsWith("programs/p"));
  program.data.routines = [];
  program.data.days[0].exercises[0].sets = "3";
  report = createTrainingReadinessReport(uid, sources);
  assert.equal(report.plan.target, null);
  assert.ok(report.errors.some((entry) => entry.code === "conflicting_legacy_aliases"));
  program.data.routines = program.data.days;
  report = createTrainingReadinessReport(uid, sources);
  assert.ok(report.errors.some((entry) => entry.code === "invalid_sets"));
  program.data.days.push(routine("r"));
  report = createTrainingReadinessReport(uid, sources);
  assert.ok(report.errors.some((entry) => entry.code === "duplicate_routine_in_program"));
  program.data.extraTypedMetadata = Bytes.fromUint8Array(new Uint8Array([1]));
  report = createTrainingReadinessReport(uid, sources);
  assert.ok(report.errors.some((entry) => entry.code === "noncanonical_planner_value"));
  assert.equal(report.plan.target, null, "unsupported planner projection cannot create a partial candidate");
  assert.equal(report.sourceProgramCount, 2);
});

test("empty/missing-root inventories remain honest, and Quick Workout needs no routine association", async () => {
  const sources = [document("", null, false)];
  const exported = await createTrainingReadinessExport({ uid, projectId, capturedAt, documents: sources }, firestore);
  assert.equal(exported.preflight.plan.ok, true);
  assert.deepEqual(exported.preflight.plan.target.programs, []);
  assert.deepEqual(exported.manifest.counts, { user: 0, programs: 0, completedWorkouts: 0, appState: 0 });
  sources.push(document("appState/activeWorkout", { activeWorkoutSession: { sessionKind: "quick", exercises: [] } }));
  assert.equal(createTrainingReadinessReport(uid, sources).linkage[0].status, "quick_no_association");
});

test("tampering, wrong scope, unsupported values and fetched-source drift fail verification", async () => {
  const sources = fixtures();
  const exported = await createTrainingReadinessExport({ uid, projectId, capturedAt, documents: sources }, firestore);
  const changed = structuredClone(exported);
  changed.documents.pop();
  await assert.rejects(verifyTrainingReadinessExport(changed, options(sources)), /integrity_mismatch/);
  await assert.rejects(verifyTrainingReadinessExport(exported, { ...options(sources), uid: "another-user" }), /identity_or_coverage/);
  await assert.rejects(verifyTrainingReadinessExport(exported, { ...options(sources), projectId: "wrong-project" }), /identity_or_coverage/);
  sources[0].data.extra = "Changed after capture";
  await assert.rejects(verifyTrainingReadinessExport(exported, options(sources)), /fetched_source_mismatch/);
  assert.throws(() => encodeFirestoreValue({ invalid: undefined }), /unsupported_firestore_value/);
  const foreignApp = initializeApp({ projectId: "demo-foreign-reference" }, "foreign-reference-values");
  try {
    const foreignReference = encodeFirestoreValue(doc(getFirestore(foreignApp), "users", uid));
    assert.equal(foreignReference.database.projectId, "demo-foreign-reference");
    assert.throws(() => decodeFirestoreValue(foreignReference, firestore), /reference_scope_mismatch/);
  } finally {
    await deleteApp(foreignApp);
  }
  await assert.rejects(createTrainingReadinessExport({ uid, projectId, capturedAt, documents: [...fixtures(), { ...document("programs/foreign", {}), path: "users/foreign/programs/x" }] }, firestore), /document_scope/);
});

test("read failures and account changes never produce a downloadable partial package", async () => {
  const base = { uid, projectId, capturedAt, firestore, isCurrent: () => true };
  await assert.rejects(captureTrainingReadiness({ ...base, readDocuments: async () => { throw new Error("server unavailable"); } }), /server unavailable/);
  let current = true;
  await assert.rejects(captureTrainingReadiness({ ...base, isCurrent: () => current, readDocuments: async () => { current = false; return fixtures(); } }), /account_changed/);
  let checks = 0;
  await assert.rejects(captureTrainingReadiness({ ...base, isCurrent: () => ++checks < 3, readDocuments: async () => fixtures() }), /account_changed/);
  await assert.rejects(captureTrainingReadiness({ ...base, isCurrent: () => false, readDocuments: async () => { assert.fail("must not read after sign-out"); } }), /account_changed/);
});
