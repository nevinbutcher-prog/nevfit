import test from "node:test";
import assert from "node:assert/strict";
import { migrationDocumentUpdates } from "../src/services/exerciseMigrationDocument.js";

const change = (kind, docId, path, historicalWgerId = "wger-364", proposedNevfitId = "nevfit-seated-leg-curl") =>
  ({ kind, docId, path, historicalWgerId, proposedNevfitId });
const backup = () => ({
  completedWorkouts: [{ id: "w1", completedAt: "2026-10-19T00:00:00Z", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", supersetGroupId: "pair-1", sets: [{ setNumber: 1, weight: "45", reps: "10" }] }] }],
  programs: [{ id: "p1", days: [{ exercises: [{ exerciseId: "wger-364", routineExerciseId: "ri-1", supersetGroupId: "pair-1" }] }] }],
  activeWorkout: { exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ weight: "50", reps: "8" }] }] },
  exerciseNotes: { "wger-364": "Seat 3" },
});

test("transaction patch preserves historical names, sets, dates and unrelated document fields", () => {
  const source = backup();
  const document = { ...source.completedWorkouts[0], unrelated: { retained: true } };
  const changes = [change("completedWorkout", "w1", "exercises.0.exerciseId")];
  const updates = migrationDocumentUpdates({ kind: "completedWorkout", id: "w1", document, changes, backup: source });
  assert.deepEqual(Object.keys(updates), ["exercises"]);
  assert.equal(updates.exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(updates.exercises[0].exerciseName, "Leg Curl");
  assert.deepEqual(updates.exercises[0].sets, document.exercises[0].sets);
  assert.equal(updates.exercises[0].supersetGroupId, "pair-1");
  assert.equal(document.exercises[0].exerciseId, "wger-364");
  const migrated = { ...document, ...updates };
  assert.equal(migrationDocumentUpdates({ kind: "completedWorkout", id: "w1", document: migrated, changes, backup: source }), null);
  const rollback = migrationDocumentUpdates({ kind: "completedWorkout", id: "w1", document: migrated, changes, backup: source, direction: "rollback" });
  assert.deepEqual({ ...migrated, ...rollback }, document);
});

test("transaction patch rejects concurrent set and name edits against the backup", () => {
  const source = backup(), changes = [change("completedWorkout", "w1", "exercises.0.exerciseId")];
  const concurrent = structuredClone(source.completedWorkouts[0]);
  concurrent.exercises[0].sets[0].weight = "55";
  assert.throws(() => migrationDocumentUpdates({ kind: "completedWorkout", id: "w1", document: concurrent, changes, backup: source }), /changed since backup/);
  concurrent.exercises[0].sets[0].weight = "45";
  concurrent.exercises[0].exerciseName = "Different movement";
  assert.throws(() => migrationDocumentUpdates({ kind: "completedWorkout", id: "w1", document: concurrent, changes, backup: source }), /changed since backup/);
});

test("program patch updates both representations but keeps row identity and superset", () => {
  const source = backup();
  const document = { ...source.programs[0], routines: structuredClone(source.programs[0].days), metadata: "keep" };
  const changes = [change("program", "p1", "days.0.exercises.0.exerciseId")];
  const updates = migrationDocumentUpdates({ kind: "program", id: "p1", document, changes, backup: source });
  assert.equal(updates.days[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(updates.routines[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(updates.days[0].exercises[0].routineExerciseId, "ri-1");
  assert.equal(updates.days[0].exercises[0].supersetGroupId, "pair-1");
  const migrated = { ...document, ...updates };
  assert.deepEqual({ ...migrated, ...migrationDocumentUpdates({ kind: "program", id: "p1", document: migrated, changes, backup: source, direction: "rollback" }) }, document);
  const divergent = structuredClone(document);
  divergent.routines[0].exercises[0].exerciseId = "wger-999";
  assert.throws(() => migrationDocumentUpdates({ kind: "program", id: "p1", document: divergent, changes, backup: source }), /routines changed|mirror/);
  divergent.routines[0].exercises[0].exerciseId = "wger-364";
  divergent.routines[0].exercises[0].supersetGroupId = "changed";
  assert.throws(() => migrationDocumentUpdates({ kind: "program", id: "p1", document: divergent, changes, backup: source }), /routines changed/);
});

test("active workout and notes patch safely; note collisions reject", () => {
  const source = backup();
  const active = { activeWorkoutSession: source.activeWorkout, updatedAt: "untouched" };
  const activeChange = [change("activeWorkout", "activeWorkout", "activeWorkoutSession.exercises.0.exerciseId")];
  const activeUpdates = migrationDocumentUpdates({ kind: "activeWorkout", id: "activeWorkout", document: active, changes: activeChange, backup: source });
  assert.equal(activeUpdates.activeWorkoutSession.exercises[0].exerciseId, "nevfit-seated-leg-curl");
  const noteChange = [change("exerciseNotes", "exerciseNotes", "notes.wger-364")];
  const notes = { notes: source.exerciseNotes };
  const updates = migrationDocumentUpdates({ kind: "exerciseNotes", id: "exerciseNotes", document: notes, changes: noteChange, backup: source });
  assert.deepEqual(updates.notes, { "nevfit-seated-leg-curl": "Seat 3" });
  assert.deepEqual(migrationDocumentUpdates({ kind: "exerciseNotes", id: "exerciseNotes", document: { ...notes, ...updates }, changes: noteChange, backup: source, direction: "rollback" }).notes, source.exerciseNotes);
  assert.throws(() => migrationDocumentUpdates({ kind: "exerciseNotes", id: "exerciseNotes", document: { notes: { ...source.exerciseNotes, "nevfit-seated-leg-curl": "Other" } }, changes: noteChange, backup: source }), /collision/);
});
