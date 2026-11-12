import { isValidWorkoutSession } from "./workoutSnapshots.js";
import { isSupportedExerciseId } from "./nevfitCatalogue.js";

// Rendering requires more than a truthy session. Keep orphaned snapshots intact
// until the user chooses recovery; never invent replacement templates/assignments.
export function getWorkoutPresentation({ session, mode, programs = [], workouts = [], schedule = [], loading = false, restoreIssue = null }) {
  if (loading) return { status: "loading" };
  if (restoreIssue) return { status: "recovery", reason: restoreIssue };
  if (session == null) return { status: "none" };
  if (!isValidWorkoutSession(session, isSupportedExerciseId)) return { status: "recovery", reason: "invalid-session" };
  if (session.sessionKind === "quick") return { status: "ready", name: "Quick Workout", routine: null, day: null };
  if (!session.routineDayId.trim()) return { status: "recovery", reason: "invalid-session" };
  if (!session.exercises.length || session.exercises.some((exercise) => !exercise.sets.length)) return { status: "recovery", reason: "empty-session" };
  if ((mode === "legacy" && (session.sessionKind === "saved" || (session.trainingModelVersion ?? 1) !== 1)) ||
      (mode === "v2" && session.trainingModelVersion !== 2)) return { status: "recovery", reason: "model-mismatch" };
  const day = schedule.find((entry) => entry.id === session.scheduleDayId);
  const snapshotName = typeof session.routineDayName === "string" && session.routineDayName.trim() ? session.routineDayName : null;
  if (mode === "v2") {
    // Saved v2 snapshots deliberately survive template deletion and detachment.
    const template = workouts.find((entry) => entry.id === session.routineDayId);
    const name = snapshotName || template?.name || "Saved Workout";
    return { status: "ready", name, routine: { name }, day };
  }
  const routine = programs.flatMap((program) => Array.isArray(program.days) ? program.days : []).find((entry) => entry.id === session.routineDayId);
  if (!routine || !day) return { status: "recovery", reason: "missing-reference" };
  return { status: "ready", name: snapshotName || routine.name, routine, day };
}

export function invalidActiveWorkoutError() {
  const error = new Error("The stored active workout cannot be displayed safely.");
  error.code = "invalid-active-workout";
  return error;
}
