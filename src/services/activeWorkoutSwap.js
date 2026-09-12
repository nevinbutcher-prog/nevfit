function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function hasMeaningfulWorkoutSet(set) {
  const reps = Number(set?.reps);
  const weight = Number(set?.weight);

  return (
    (Number.isFinite(reps) && reps > 0) ||
    (Number.isFinite(weight) && weight > 0)
  );
}

export function swapActiveWorkoutExercise(
  workout,
  workoutExerciseIndex,
  replacementExercise,
) {
  const currentExercise = workout?.exercises?.[workoutExerciseIndex];
  const replacementId = replacementExercise?.id ?? replacementExercise?.exerciseId;
  const replacementName = replacementExercise?.name ?? replacementExercise?.exerciseName;

  if (!currentExercise || !replacementId || !replacementName) {
    return {
      swapped: false,
      code: "invalid_replacement",
      message: "Choose a valid replacement exercise.",
    };
  }

  if (currentExercise.exerciseId === replacementId) {
    return {
      swapped: false,
      code: "same_exercise",
      message: "Choose a different exercise to swap.",
    };
  }

  if (currentExercise.sets.some(hasMeaningfulWorkoutSet)) {
    return {
      swapped: false,
      code: "logged_sets",
      message: "You’ve already logged sets for this exercise. Clear those sets before swapping.",
    };
  }

  const nextWorkout = clone(workout);
  const nextExercise = nextWorkout.exercises[workoutExerciseIndex];
  nextExercise.originalExerciseId ??= nextExercise.exerciseId;
  nextExercise.originalExerciseName ??= nextExercise.exerciseName;
  nextExercise.exerciseId = replacementId;
  nextExercise.exerciseName = replacementName;

  return { swapped: true, workout: nextWorkout };
}

export function restoreSwappedWorkoutExercise(workout, workoutExerciseIndex) {
  const currentExercise = workout?.exercises?.[workoutExerciseIndex];

  if (!currentExercise?.originalExerciseId || !currentExercise.originalExerciseName) {
    return { restored: false, code: "not_swapped" };
  }

  if (currentExercise.sets.some(hasMeaningfulWorkoutSet)) {
    return {
      restored: false,
      code: "logged_sets",
      message: "Clear logged sets before restoring the original exercise.",
    };
  }

  const nextWorkout = clone(workout);
  const nextExercise = nextWorkout.exercises[workoutExerciseIndex];
  nextExercise.exerciseId = nextExercise.originalExerciseId;
  nextExercise.exerciseName = nextExercise.originalExerciseName;
  delete nextExercise.originalExerciseId;
  delete nextExercise.originalExerciseName;

  return { restored: true, workout: nextWorkout };
}
