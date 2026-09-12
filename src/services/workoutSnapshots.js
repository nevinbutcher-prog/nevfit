export function createCompletedWorkoutSnapshot(
  workoutSession,
  routineDayName,
  completedAt,
  workoutId,
  resolveExerciseName = (exercise) => exercise.exerciseName ?? "Unknown exercise",
) {
  return {
    id: workoutId,
    completedAt: completedAt.toISOString(),
    scheduleDayId: workoutSession.scheduleDayId,
    routineDayId: workoutSession.routineDayId,
    routineDayName,
    exercises: workoutSession.exercises.map((sessionExercise) => ({
      exerciseId: sessionExercise.exerciseId,
      exerciseName: resolveExerciseName(sessionExercise),
      ...(typeof sessionExercise.originalExerciseId === "string"
        ? { originalExerciseId: sessionExercise.originalExerciseId }
        : {}),
      ...(typeof sessionExercise.originalExerciseName === "string"
        ? { originalExerciseName: sessionExercise.originalExerciseName }
        : {}),
      restSeconds: sessionExercise.restSeconds ?? null,
      supersetGroupId: sessionExercise.supersetGroupId ?? null,
      sets: sessionExercise.sets.map((set) => ({
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
      })),
    })),
  };
}

export function getPreviousExercisePerformance(
  exerciseId,
  completedWorkouts,
  hasMeaningfulLoggedEffort,
) {
  return completedWorkouts.reduce((latestPerformance, completedWorkout) => {
    const exercisePerformance = completedWorkout.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId,
    );

    if (
      !exercisePerformance ||
      !exercisePerformance.sets.some(hasMeaningfulLoggedEffort)
    ) {
      return latestPerformance;
    }

    if (
      !latestPerformance ||
      Date.parse(completedWorkout.completedAt) >
        Date.parse(latestPerformance.completedAt)
    ) {
      return {
        completedAt: completedWorkout.completedAt,
        sets: exercisePerformance.sets,
      };
    }

    return latestPerformance;
  }, null);
}
