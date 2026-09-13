export function isValidSetNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

// A blank weight is valid for bodyweight exercises. When a weight is supplied,
// it must be a valid non-negative number; reps are always required.
export function isSetEligibleForCompletion(set, { allowsBlankWeight = false } = {}) {
  const hasValidReps = isValidSetNumber(set?.reps);
  const weight = set?.weight?.trim?.() ?? "";
  const hasValidWeight =
    (allowsBlankWeight && weight === "") ||
    (weight !== "" && Number.isFinite(Number(weight)) && Number(weight) >= 0);

  return hasValidReps && hasValidWeight;
}

export function isWorkoutSetComplete(set) {
  return set?.completed === true;
}

export function updateWorkoutSetDraft(
  workout,
  exerciseIndex,
  setNumber,
  field,
  value,
  completionOptions,
) {
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
                : {
                    ...set,
                    [field]: value,
                    ...(set.completed &&
                    !isSetEligibleForCompletion(
                      { ...set, [field]: value },
                      completionOptions,
                    )
                      ? { completed: false }
                      : {}),
                  },
            ),
          },
    ),
  };
}

export function toggleWorkoutSetCompletion(
  workout,
  exerciseIndex,
  setNumber,
  completionOptions,
) {
  const set = workout?.exercises?.[exerciseIndex]?.sets.find(
    (candidate) => candidate.setNumber === setNumber,
  );
  if (!set) {
    return { changed: false, completed: false, workout };
  }

  if (set.completed) {
    return {
      changed: true,
      completed: false,
      workout: {
        ...workout,
        exercises: workout.exercises.map((exercise, index) =>
          index !== exerciseIndex
            ? exercise
            : {
                ...exercise,
                sets: exercise.sets.map((candidate) =>
                  candidate.setNumber === setNumber
                    ? { ...candidate, completed: false }
                    : candidate,
                ),
              },
        ),
      },
    };
  }

  if (!isSetEligibleForCompletion(set, completionOptions)) {
    return { changed: false, completed: false, reason: "invalid", workout };
  }

  return {
    changed: true,
    completed: true,
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
