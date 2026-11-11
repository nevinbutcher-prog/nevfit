import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { applyTrainingOperation, libraryFromProgramProjection, projectTrainingPrograms } from "../src/services/trainingLibrary.js";
import { createSavedWorkoutSession } from "../src/services/routineBuilder.js";
import { createCompletedWorkoutSnapshot, normalizeCompletedWorkout, isValidWorkoutSession } from "../src/services/workoutSnapshots.js";
import { isSupportedExerciseId } from "../src/services/nevfitCatalogue.js";
import { createIndependentBackup } from "../src/services/independentBackup.js";
import { decodeFirestoreValue } from "../src/services/firestoreValueCodec.js";
import { validateBackup } from "../src/services/backupPayload.js";

const row = { routineExerciseId: "row-a", exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: null, note: "Keep", supersetGroupId: null, extra: "Retained metadata" };
const library = () => ({ version: 1, programs: [{ id: "p", name: "Program", archived: true, workoutIds: ["r"], extra: "Preserved" }], workouts: [
  { id: "r", name: "Workout", archived: false, programId: "p", exercises: [{ ...row }] },
  { id: "standalone", name: "Standalone", archived: false, programId: null, exercises: [] },
] });

test("interim editor projection edits independent templates without dropping standalone or metadata", () => {
  const source = library(), before = structuredClone(source);
  const projection = structuredClone(projectTrainingPrograms(source));
  projection[0].days[0].exercises[0].sets = 4;
  projection[0].days[0].name = "Edited";
  const next = libraryFromProgramProjection(source, projection);
  assert.equal(next.workouts[0].exercises[0].sets, 4);
  assert.equal(next.workouts[0].name, "Edited");
  assert.equal(next.programs[0].extra, "Preserved");
  assert.equal(next.workouts[1].programId, null);
  assert.equal(next.workouts[0].exercises[0].extra, "Retained metadata");
  assert.deepEqual(source, before);
  const cleared = projectTrainingPrograms(source).map((program) => ({ ...program, days: program.days.map((day) => ({ ...day, exercises: day.exercises.map(({ note, displayNameOverride, ...entry }) => entry) })) })); // eslint-disable-line no-unused-vars
  assert.equal(Object.hasOwn(libraryFromProgramProjection(source, cleared).workouts[0].exercises[0], "note"), false);
});

test("ownership/order, duplicate/archive/restore and deletions preserve independent data without fake programs", () => {
  let next = applyTrainingOperation(library(), { type: "moveWorkout", id: "standalone", programId: "p", index: 0 });
  assert.deepEqual(next.programs[0].workoutIds, ["standalone", "r"]);
  next = applyTrainingOperation(next, { type: "duplicateWorkout", id: "r", newId: "copy", rowIds: ["row-copy"] });
  assert.equal(next.workouts[2].exercises[0].exerciseId, row.exerciseId);
  assert.equal(next.workouts[2].exercises[0].routineExerciseId, "row-copy");
  next = applyTrainingOperation(next, { type: "archiveWorkout", id: "copy", archived: true });
  next = applyTrainingOperation(next, { type: "archiveWorkout", id: "copy", archived: false });
  next = applyTrainingOperation(next, { type: "deleteProgram", id: "p" });
  assert.deepEqual(next.programs, []);
  assert.ok(next.workouts.every((workout) => workout.programId === null));
  assert.deepEqual(projectTrainingPrograms(next), []);
  const empty = { version: 1, programs: [], workouts: [] };
  assert.equal(applyTrainingOperation(empty, { type: "createWorkout", workout: { id: "new", name: "New", exercises: [] } }).workouts[0].programId, null);
});

test("standalone sessions resume and finish without schedule/program inventions; snapshots remain self-contained", () => {
  const workout = { ...library().workouts[0], programId: null };
  const session = createSavedWorkoutSession(workout, null, () => "Saved exercise name");
  session.exercises[0].sets[0] = { setNumber: 1, weight: "20", reps: "8", completed: true };
  assert.equal(isValidWorkoutSession(JSON.parse(JSON.stringify(session)), isSupportedExerciseId), true);
  assert.equal(session.routineDayName, "Workout");
  assert.equal(session.scheduleDayId, null);
  const history = createCompletedWorkoutSnapshot(session, session.routineDayName, new Date("2026-11-11T00:00:00Z"), "history");
  assert.deepEqual(normalizeCompletedWorkout(history), history);
  assert.equal(Object.hasOwn(history, "scheduleDayId"), false);
  assert.equal(history.routineDayId, "r");
});

test("independent backup includes standalone definitions and legacy import refuses v3; restore guard stops before writes", async () => {
  const exported = createIndependentBackup({ uid: "fixture", projectId: "demo", runtime: { mode: "v2", marker: { revision: 0 }, library: library() }, planning: {}, activeWorkout: { exercises: [{ note: undefined }] }, completedWorkouts: [], health: {}, exerciseNotes: {} });
  assert.equal(decodeFirestoreValue(exported.data).library.workouts.length, 2);
  assert.equal(exported.restoreSupported, false);
  assert.equal(Object.hasOwn(decodeFirestoreValue(exported.data).activeWorkout.exercises[0], "note"), false);
  assert.equal(validateBackup(exported).valid, false);
  const source = readFileSync(new URL("../src/services/backupService.js", import.meta.url), "utf8");
  const start = source.indexOf("async function writeLegacyState");
  const fn = runInNewContext(`${source.slice(start, source.indexOf("\n}\n", start) + 2)}; writeLegacyState`, {
    db: {}, doc: () => ({}), runTransaction: (db, callback) => callback({ get: async () => ({ exists: () => true }), set: () => assert.fail("must not overwrite activated state") }),
  });
  await assert.rejects(fn("fixture", "planning", {}), /blocked/);
});
