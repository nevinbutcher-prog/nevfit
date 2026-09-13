export function isValidSetNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

// A blank weight is valid for bodyweight exercises. When a weight is supplied,
// it must be a valid non-negative number; reps are always required.
export function isSetEligibleForCompletion(set) {
  const hasValidReps = isValidSetNumber(set?.reps);
  const weight = set?.weight?.trim?.() ?? "";
  const hasValidWeight = weight === "" || (Number.isFinite(Number(weight)) && Number(weight) >= 0);

  return hasValidReps && hasValidWeight;
}

export function isWorkoutSetComplete(set) {
  return set?.completed === true;
}

export function updateWorkoutSetDraft(workout, exerciseIndex, setNumber, field, value) {
  if (!workout || (field !== "weight" && field !== "reps")) return workout;

  return {
    ...workout,
    exercises: workout.exercises.map((exercise, index) =>
      index !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.setNumber !== setNumber
                ? set
                : { ...set, [field]: value, ...(set.completed && !isSetEligibleForCompletion({ ...set, [field]: value }) ? { completed: false } : {}) },
            ),
          },
    ),
  };
}

export function finalizeWorkoutSet(workout, exerciseIndex, setNumber) {
  const set = workout?.exercises?.[exerciseIndex]?.sets.find(
    (candidate) => candidate.setNumber === setNumber,
  );
  if (!set || !isSetEligibleForCompletion(set)) {
    return { finalized: false, workout };
  }

  return {
    finalized: true,
    workout: {
      ...workout,
      exercises: workout.exercises.map((exercise, index) =>
        index !== exerciseIndex
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((candidate) =>
                candidate.setNumber === setNumber
                  ? { ...candidate, completed: true }
                  : candidate,
              ),
            },
      ),
    },
  };
}
