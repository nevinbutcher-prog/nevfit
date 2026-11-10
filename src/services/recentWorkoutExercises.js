import { hasMeaningfulWorkoutSet } from "./activeWorkoutSwap.js";
import { getNevfitExerciseById, isSupportedExerciseId } from "./nevfitCatalogue.js";

export function getRecentWorkoutExercises(completedWorkouts, limit = 24) {
  const recent = new Map();
  const workouts = [...completedWorkouts]
    .filter((workout) => Number.isFinite(Date.parse(workout.completedAt)))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  for (const workout of workouts) {
    for (const exercise of workout.exercises ?? []) {
      if (!isSupportedExerciseId(exercise.exerciseId) || recent.has(exercise.exerciseId) ||
          !exercise.sets?.some(hasMeaningfulWorkoutSet)) continue;
      recent.set(exercise.exerciseId, {
        id: exercise.exerciseId,
        name: exercise.exerciseName || "Unknown exercise",
      });
      if (recent.size >= limit) return [...recent.values()];
    }
  }
  return [...recent.values()];
}

export function groupRecentWorkoutExercises(recentExercises, resolveExercise = () => null) {
  const groups = new Map();
  for (const recent of recentExercises) {
    const exercise = getNevfitExerciseById(recent.id) ?? resolveExercise(recent.id) ?? recent;
    const muscle = exercise.primaryMuscle?.trim() || "Other / Uncategorised";
    if (!groups.has(muscle)) groups.set(muscle, []);
    // Only identity and provider metadata reach the picker, never historical sets.
    groups.get(muscle).push({ ...exercise, id: recent.id, name: exercise.name || recent.name });
  }
  return [...groups].map(([muscle, exercises]) => ({ muscle, exercises }));
}
