import { cleanOrphanedSupersetGroups } from "./routineBuilder.js";

export const trainingId = () => crypto.randomUUID();
export function newWorkoutDraft(programId = null, id = trainingId()) {
  return { id, name: "", description: "", archived: false, programId, exercises: [] };
}
export function workoutExercise(exercise, id = trainingId()) {
  return { routineExerciseId: id, exerciseId: exercise.id, sets: exercise.defaultSets ?? 3,
    repRange: exercise.defaultRepRange ?? "8-12", restSeconds: exercise.defaultRestSeconds ?? 120, supersetGroupId: null };
}
export function prepareWorkoutDraft(draft) {
  if (!draft.name.trim()) throw new Error("Give your workout a name.");
  const exercises = cleanOrphanedSupersetGroups(draft.exercises).map((entry) => {
    const sets = Number(entry.sets);
    const restSeconds = entry.restSeconds === "" || entry.restSeconds == null ? null : Number(entry.restSeconds);
    if (!Number.isInteger(sets) || sets < 1 || sets > 12) throw new Error("Each exercise needs 1–12 sets.");
    if (restSeconds !== null && (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600)) throw new Error("Rest must be blank or 0–600 seconds.");
    if (!entry.repRange.trim()) throw new Error("Each exercise needs a rep range.");
    return { ...entry, sets, restSeconds, repRange: entry.repRange.trim(),
      ...(Object.hasOwn(entry, "groupId") ? { groupId: entry.supersetGroupId } : {}) };
  });
  return { ...draft, name: draft.name.trim(), description: draft.description?.trim() ?? "", exercises };
}
export function workoutTotals(workout) {
  return { exercises: workout.exercises.length, sets: workout.exercises.reduce((count, row) => count + Number(row.sets), 0) };
}
export function savedWorkoutStartAction(session, workout) {
  if (!session) return "start";
  return session.sessionKind !== "quick" && session.routineDayId === workout.id ? "resume" : "confirm";
}
