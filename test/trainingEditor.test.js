import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { applyTrainingOperation, projectTrainingPrograms } from "../src/services/trainingLibrary.js";
import { newWorkoutDraft, prepareWorkoutDraft, workoutExercise, savedWorkoutStartAction } from "../src/services/trainingEditor.js";
import { createSavedWorkoutSession } from "../src/services/routineBuilder.js";
import { getViewModeAfterWorkout } from "../src/utils/navigation.js";

const empty = () => ({ version: 1, programs: [], workouts: [] });
const exercise = { id: "wger-1", defaultSets: 3, defaultRepRange: "8-12", defaultRestSeconds: 120 };
function template(id = "workout", programId = null) {
  return prepareWorkoutDraft({ ...newWorkoutDraft(programId, id), name: "Upper body", exercises: [workoutExercise(exercise, "row")] });
}
test("first standalone workout saves with stable identities; editing preserves metadata and zero programs", () => {
  let library = applyTrainingOperation(empty(), { type: "createWorkout", workout: { ...template(), extra: "Preserved" } });
  const changed = prepareWorkoutDraft({ ...library.workouts[0], name: "Updated", exercises: [{ ...library.workouts[0].exercises[0], sets: "4", restSeconds: "", note: "Steady", displayNameOverride: "Custom" }] });
  library = applyTrainingOperation(library, { type: "saveWorkout", id: changed.id, workout: changed });
  assert.equal(library.programs.length, 0);
  assert.equal(library.workouts[0].id, "workout");
  assert.equal(library.workouts[0].extra, "Preserved");
  assert.equal(library.workouts[0].exercises[0].routineExerciseId, "row");
  assert.equal(library.workouts[0].exercises[0].sets, 4);
  assert.equal(library.workouts[0].exercises[0].restSeconds, null);
  assert.throws(() => prepareWorkoutDraft({ ...changed, name: " " }), /name/);
  assert.throws(() => prepareWorkoutDraft({ ...changed, exercises: [{ ...changed.exercises[0], sets: "" }] }), /sets/);
});
test("program organisation supports create-in-program, rename, ordered move/detach and archive/restore", () => {
  let library = applyTrainingOperation(empty(), { type: "createProgram", program: { id: "p", name: "Plan" } });
  library = applyTrainingOperation(library, { type: "createWorkout", workout: template("a", "p") });
  library = applyTrainingOperation(library, { type: "createWorkout", workout: template("b") });
  library = applyTrainingOperation(library, { type: "moveWorkout", id: "b", programId: "p", index: 0 });
  assert.deepEqual(library.programs[0].workoutIds, ["b", "a"]);
  library = applyTrainingOperation(library, { type: "createProgram", program: { id: "q", name: "Other" } });
  library = applyTrainingOperation(library, { type: "moveWorkout", id: "a", programId: "q" });
  assert.deepEqual(library.programs[0].workoutIds, ["b"]);
  assert.deepEqual(library.programs[1].workoutIds, ["a"]);
  library = applyTrainingOperation(library, { type: "saveProgram", id: "q", program: { name: "Renamed", archived: true } });
  library = applyTrainingOperation(library, { type: "saveProgram", id: "q", program: { archived: false } });
  library = applyTrainingOperation(library, { type: "moveWorkout", id: "a", programId: null });
  assert.equal(library.workouts[0].programId, null);
  assert.equal(library.programs[1].name, "Renamed");
});
test("program duplication creates independent workout and row IDs without changing source/archive/history", () => {
  let library = applyTrainingOperation(empty(), { type: "createProgram", program: { id: "p", name: "Plan", metadata: "Keep" } });
  library = applyTrainingOperation(library, { type: "createWorkout", workout: template("a", "p") });
  library = applyTrainingOperation(library, { type: "archiveWorkout", id: "a", archived: true });
  const before = structuredClone(library);
  const next = applyTrainingOperation(library, { type: "duplicateProgram", id: "p", newId: "copy", workoutCopies: [{ id: "a", newId: "a-copy", rowIds: ["row-copy"] }] });
  assert.deepEqual(library, before);
  assert.deepEqual(next.programs[1].workoutIds, ["a-copy"]);
  assert.equal(next.programs[1].metadata, "Keep");
  assert.equal(next.workouts[1].programId, "copy");
  assert.equal(next.workouts[1].exercises[0].routineExerciseId, "row-copy");
  assert.equal(next.workouts[1].archived, false);
  assert.equal(next.workouts[0].archived, true);
  assert.throws(() => applyTrainingOperation(library, { type: "duplicateProgram", id: "p", newId: "copy", workoutCopies: [{ id: "a", newId: "a", rowIds: ["row-copy"] }] }), /duplicate/);
});
test("saved starts without a schedule preserve session identity and use active-session safeguards", () => {
  const workout = template();
  assert.equal(savedWorkoutStartAction(null, workout), "start");
  const session = createSavedWorkoutSession(workout);
  assert.equal(session.scheduleDayId, null);
  assert.equal(session.trainingModelVersion, 2);
  assert.equal(savedWorkoutStartAction(session, workout), "resume");
  assert.equal(savedWorkoutStartAction({ ...session, routineDayId: "other" }, workout), "confirm");
  assert.equal(savedWorkoutStartAction({ sessionKind: "quick" }, workout), "confirm");
  assert.equal(getViewModeAfterWorkout({ type: "open-saved-workout" }), "workout");
});
test("committed v2 operations refresh App projection/schedule while stale failures preserve local state", async () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const start = app.indexOf("  function applyTrainingRuntime(");
  const end = app.indexOf("  async function reloadTraining(", start);
  const baseline = { mode: "v2", marker: { revision: 1 }, library: applyTrainingOperation(empty(), { type: "createWorkout", workout: template() }) };
  const state = { runtime: baseline, schedule: [{ id: "mon", routineDayId: "workout" }] };
  const context = {
    currentUser: { uid: "fixture" }, currentUserUidRef: { current: "fixture" }, trainingRuntimeRef: { current: baseline },
    programPersistQueueRef: { current: Promise.resolve() }, projectTrainingPrograms, encodeFirestoreValue: (value) => value,
    setTrainingRuntime: (value) => { state.runtime = value; }, setProgramDefinitions: (value) => { state.programs = value; },
    setProgramDrafts: (value) => { state.drafts = value; }, setProgramSyncError: () => {}, accountStorage: { setItem: () => {} },
    setSchedule: (update) => { state.schedule = update(state.schedule); },
    trainingStore: { operate: async (expected, operation) => {
      if (expected !== state.runtime) throw new Error("training_changed_refresh_required");
      return { ...expected, marker: { revision: expected.marker.revision + 1 }, library: applyTrainingOperation(expected.library, operation) };
    } },
  };
  const operate = runInNewContext(app.slice(start, end) + "; operateTraining", context);
  await operate({ type: "deleteWorkout", id: "workout" }, baseline);
  assert.equal(state.schedule[0].routineDayId, null);
  assert.deepEqual(Array.from(state.programs), []);
  assert.equal(state.drafts, state.programs);
  const confirmed = state.runtime;
  await assert.rejects(operate({ type: "createWorkout", workout: template("stale") }, baseline), /changed/);
  assert.equal(state.runtime, confirmed);
  assert.equal(state.runtime.library.workouts.length, 0);
});
