export function normalizeRoutineExercise(
  value,
  fallbackRoutineExerciseId,
  isValidExerciseId,
) {
  if (
    !value ||
    typeof value.exerciseId !== "string" ||
    !value.exerciseId.trim() ||
    !isValidExerciseId(value.exerciseId.trim())
  ) {
    return null;
  }

  const sets = Number(value.sets);
  const restSeconds =
    value.restSeconds === null ||
    value.restSeconds === "" ||
    typeof value.restSeconds === "undefined"
      ? null
      : Number(value.restSeconds);

  if (!Number.isInteger(sets) || sets < 1 || sets > 12) return null;
  if (
    restSeconds !== null &&
    (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600)
  ) {
    return null;
  }

  const supersetGroupId =
    typeof value.supersetGroupId === "string" && value.supersetGroupId.trim()
      ? value.supersetGroupId.trim()
      : typeof value.groupId === "string" && value.groupId.trim()
        ? value.groupId.trim()
        : null;

  return {
    routineExerciseId:
      typeof value.routineExerciseId === "string" &&
      value.routineExerciseId.trim()
        ? value.routineExerciseId.trim()
        : fallbackRoutineExerciseId,
    exerciseId: value.exerciseId.trim(),
    sets,
    repRange:
      typeof value.repRange === "string" && value.repRange.trim()
        ? value.repRange.trim()
        : "8-12",
    restSeconds,
    ...(typeof value.displayNameOverride === "string" &&
    value.displayNameOverride.trim()
      ? { displayNameOverride: value.displayNameOverride.trim() }
      : {}),
    ...(typeof value.note === "string" && value.note.trim()
      ? { note: value.note.trim() }
      : {}),
    supersetGroupId,
  };
}

export function normalizeRoutineDay(value, fallbackDay, isValidExerciseId) {
  if (
    !value ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    !Array.isArray(value.exercises)
  ) {
    return null;
  }

  const exercises = cleanOrphanedSupersetGroups(
    value.exercises
      .map((exercise, index) =>
        normalizeRoutineExercise(
          exercise,
          `ri-${value.id.trim()}-${index + 1}`,
          isValidExerciseId,
        ),
      )
      .filter(Boolean),
  );

  return {
    id: fallbackDay?.id ?? value.id.trim(),
    name: fallbackDay?.name ?? value.name.trim(),
    exercises,
    ...(fallbackDay ? {} : { archived: value.archived === true }),
  };
}

export function hasRoutineExercise(exercises, exerciseId) {
  return exercises.some((exercise) => exercise.exerciseId === exerciseId);
}

export function addRoutineExercise(exercises, exercise) {
  if (hasRoutineExercise(exercises, exercise.exerciseId)) {
    return { added: false, exercises };
  }

  return { added: true, exercises: [...exercises, exercise] };
}

export function moveRoutineExercise(exercises, exerciseIndex, direction) {
  const nextIndex = exerciseIndex + direction;
  if (exerciseIndex < 0 || nextIndex < 0 || nextIndex >= exercises.length) {
    return exercises;
  }

  const nextExercises = [...exercises];
  const [movedExercise] = nextExercises.splice(exerciseIndex, 1);
  nextExercises.splice(nextIndex, 0, movedExercise);
  return nextExercises;
}

export function cleanOrphanedSupersetGroups(exercises) {
  const groupCounts = exercises.reduce((counts, exercise) => {
    if (exercise.supersetGroupId) {
      counts.set(
        exercise.supersetGroupId,
        (counts.get(exercise.supersetGroupId) ?? 0) + 1,
      );
    }
    return counts;
  }, new Map());

  return exercises.map((exercise) =>
    exercise.supersetGroupId &&
    (groupCounts.get(exercise.supersetGroupId) ?? 0) < 2
      ? { ...exercise, supersetGroupId: null }
      : exercise,
  );
}

export function removeRoutineExercise(exercises, exerciseIndex) {
  if (exerciseIndex < 0 || exerciseIndex >= exercises.length) {
    return exercises;
  }

  return cleanOrphanedSupersetGroups(
    exercises.filter((_, index) => index !== exerciseIndex),
  );
}

export function replaceRoutineExercise(exercises, exerciseIndex, exerciseId) {
  if (exerciseIndex < 0 || exerciseIndex >= exercises.length) {
    return exercises;
  }

  return exercises.map((exercise, index) =>
    index === exerciseIndex
      ? { ...exercise, exerciseId, displayNameOverride: "" }
      : exercise,
  );
}

export function updateRoutineExerciseSuperset(
  exercises,
  exerciseIndex,
  pairedIndex,
  createGroupId,
) {
  if (!exercises[exerciseIndex]) {
    return exercises;
  }

  const nextExercises = exercises.map((exercise) => ({ ...exercise }));
  if (pairedIndex === null) {
    nextExercises[exerciseIndex].supersetGroupId = null;
    return cleanOrphanedSupersetGroups(nextExercises);
  }
  if (pairedIndex === exerciseIndex || !nextExercises[pairedIndex]) {
    return exercises;
  }

  const pairedGroupId = nextExercises[pairedIndex].supersetGroupId;
  nextExercises[exerciseIndex].supersetGroupId = null;
  const cleanedExercises = cleanOrphanedSupersetGroups(nextExercises);
  const nextGroupId = pairedGroupId ?? createGroupId();
  cleanedExercises[exerciseIndex].supersetGroupId = nextGroupId;
  cleanedExercises[pairedIndex].supersetGroupId = nextGroupId;
  return cleanOrphanedSupersetGroups(cleanedExercises);
}

export function duplicateRoutineExercises(exercises, createEntryId) {
  return exercises.map((exercise) => ({
    ...exercise,
    routineExerciseId: createEntryId(),
  }));
}

export function createWorkoutSessionSnapshot(
  scheduleDay,
  routineDay,
  getExerciseName,
) {
  return {
    scheduleDayId: scheduleDay.id,
    routineDayId: routineDay.id,
    exercises: routineDay.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: getExerciseName(exercise),
      prescribedSets: exercise.sets,
      repRange: exercise.repRange,
      note: exercise.note,
      restSeconds: exercise.restSeconds,
      supersetGroupId: exercise.supersetGroupId ?? null,
      sets: Array.from({ length: exercise.sets }, (_, index) => ({
        setNumber: index + 1,
        weight: "",
        reps: "",
      })),
    })),
  };
}
