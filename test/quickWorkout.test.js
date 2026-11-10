import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuickWorkoutSession, addQuickWorkoutExercise, addQuickWorkoutSet,
  createCompletedWorkoutSnapshot, normalizeCompletedWorkout,
  isValidWorkoutSession, hasWorkoutLoggedEffort, getPreviousExercisePerformance,
} from "../src/services/workoutSnapshots.js";
import { createWorkoutSessionSnapshot } from "../src/services/routineBuilder.js";
import { updateWorkoutSetDraft, toggleWorkoutSetCompletion } from "../src/services/workoutSetLifecycle.js";
import { hasMeaningfulWorkoutSet } from "../src/services/activeWorkoutSwap.js";
import { isSupportedExerciseId } from "../src/services/nevfitCatalogue.js";
import { createBackup, validateBackup } from "../src/services/backupPayload.js";
import { buildRobContext, ROB_CONTEXT_TYPES } from "../src/services/rob/robContext.js";
import { calculateMuscleWorkload } from "../src/services/muscleWorkload.js";
import { buildRobWeeklyContext } from "../src/services/rob/robWeeklyContext.js";

const bench = { id: "nevfit-flat-barbell-bench-press", name: "Bench Press" };
const curl = { id: "nevfit-lying-dumbbell-curl", name: "Lying Dumbbell Curl" };
const roundTrip = (value) => JSON.parse(JSON.stringify(value));
function logSet(session, exerciseIndex, setNumber, weight = "40", reps = "8") {
  session = updateWorkoutSetDraft(session, exerciseIndex, setNumber, "weight", weight);
  session = updateWorkoutSetDraft(session, exerciseIndex, setNumber, "reps", reps);
  return toggleWorkoutSetCompletion(session, exerciseIndex, setNumber).workout;
}

test("quick sessions start empty and resume with exercises, drafts and confirmed sets intact", () => {
  let session = createQuickWorkoutSession();
  assert.deepEqual(session, { sessionKind: "quick", exercises: [] });
  assert.equal(hasWorkoutLoggedEffort(session), false);
  assert.ok(isValidWorkoutSession(roundTrip(session), isSupportedExerciseId));
  session = addQuickWorkoutExercise(session, bench);
  session = addQuickWorkoutExercise(session, curl);
  assert.equal(addQuickWorkoutExercise(session, bench), session);
  assert.equal(hasWorkoutLoggedEffort(session), false);
  assert.deepEqual(session.exercises[0].sets, [{ setNumber: 1, weight: "", reps: "", completed: false }]);
  session = addQuickWorkoutSet(session, 0);
  session = logSet(session, 0, 1);
  assert.equal(session.exercises[0].sets[1].weight, "40");
  session = logSet(session, 0, 2);
  session = addQuickWorkoutSet(session, 0);
  assert.equal(session.exercises[0].sets[2].weight, "40");
  assert.equal(session.exercises[0].sets[2].reps, "");
  const restored = roundTrip(session);
  assert.ok(isValidWorkoutSession(restored, isSupportedExerciseId));
  assert.deepEqual(restored, session);
  assert.equal(hasWorkoutLoggedEffort(restored), true);
  assert.equal(isValidWorkoutSession({ ...restored, routineDayId: "fake" }, isSupportedExerciseId), false);
  assert.equal(isValidWorkoutSession({ ...restored, exercises: [{ ...restored.exercises[0], exerciseId: "unknown" }] }, isSupportedExerciseId), false);
});

test("quick history retains identities and metric sets through reload and backup, and feeds existing readers", () => {
  let session = addQuickWorkoutExercise(createQuickWorkoutSession(), bench);
  session = logSet(session, 0, 1);
  session = addQuickWorkoutExercise(session, curl);
  session = logSet(session, 1, 1, "10", "12");
  const now = new Date(2026, 10, 10, 12);
  const record = createCompletedWorkoutSnapshot(session, "Quick Workout", now, "quick-1");
  const history = [normalizeCompletedWorkout(roundTrip(record))];
  assert.deepEqual(history[0], record);
  assert.equal(Object.hasOwn(record, "routineDayId"), false);
  assert.equal(Object.hasOwn(record, "scheduleDayId"), false);
  assert.equal(record.sessionKind, "quick");
  assert.equal(getPreviousExercisePerformance(bench.id, history, hasMeaningfulWorkoutSet).sets[0].weight, "40");
  const backup = roundTrip(createBackup({ programs: [], planning: {}, activeWorkout: session, completedWorkouts: history, health: {}, exerciseNotes: {} }));
  assert.ok(validateBackup(backup).valid);
  assert.ok(isValidWorkoutSession(backup.activeWorkout, isSupportedExerciseId));
  assert.deepEqual(normalizeCompletedWorkout(backup.completedWorkouts[0]), record);
  assert.equal(calculateMuscleWorkload(history, "last-seven-days", now).totalWorkingSets, 2);
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, completedWorkouts: history });
  assert.equal(context.history.workouts[0].routineId, null);
  assert.equal(context.history.workouts[0].routineName, "Quick Workout");
  assert.equal(context.history.workouts[0].exercises[0].sets[0].unit, "kg");
  const weekly = buildRobWeeklyContext({ selectedDate: "2026-11-10", now, completedWorkouts: history });
  assert.equal(weekly.current.strength.sessions[0].routine, "Quick Workout");
});

test("planned snapshots retain associations and blank-session guards", () => {
  const routine = { id: "routine-a", name: "Upper", exercises: [{ exerciseId: bench.id, sets: 2, repRange: "8-12", restSeconds: 120 }] };
  const session = createWorkoutSessionSnapshot({ id: "mon" }, routine, () => bench.name);
  assert.ok(isValidWorkoutSession(roundTrip(session), isSupportedExerciseId));
  assert.equal(hasWorkoutLoggedEffort(session), false);
  assert.equal(addQuickWorkoutExercise(session, curl), session);
  assert.equal(addQuickWorkoutSet(session, 0), session);
  const logged = logSet(session, 0, 1);
  const record = createCompletedWorkoutSnapshot(logged, routine.name, new Date(), "planned-1");
  assert.equal(record.scheduleDayId, "mon");
  assert.equal(record.routineDayId, "routine-a");
  assert.equal(record.sessionKind, undefined);
  assert.deepEqual(normalizeCompletedWorkout(roundTrip(record)), record);
  assert.equal(normalizeCompletedWorkout({ ...record, routineDayId: undefined }), null);
});
