import { hasMeaningfulWorkoutSet } from "./activeWorkoutSwap.js";

export function hasWorkoutLoggedEffort(workoutSession) {
  return workoutSession.exercises.some((exercise) =>
    exercise.sets.some(hasMeaningfulWorkoutSet),
  );
}

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
    weightUnit: "kg",
    ...workoutAssociations(workoutSession),
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
        ...(typeof set.unit === "string" ? { unit: set.unit } : {}),
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

// Quick sessions have no program, routine or schedule association.
function hasValidWorkoutAssociations(value) {
  return value.sessionKind === "quick"
    ? value.scheduleDayId == null && value.routineDayId == null
    : value.sessionKind === "saved"
      ? typeof value.routineDayId === "string" && (value.scheduleDayId == null || typeof value.scheduleDayId === "string")
    : typeof value.scheduleDayId === "string" && typeof value.routineDayId === "string";
}
function workoutAssociations(value) {
  if (value.sessionKind === "quick") return { sessionKind: "quick" };
  if (value.sessionKind === "saved") return { sessionKind: "saved", routineDayId: value.routineDayId,
    ...(typeof value.scheduleDayId === "string" ? { scheduleDayId: value.scheduleDayId } : {}) };
  return { scheduleDayId: value.scheduleDayId, routineDayId: value.routineDayId };
}

export function createQuickWorkoutSession() {
  return { sessionKind: "quick", exercises: [] };
}

export function addQuickWorkoutExercise(session, exercise, allowsBlankWeight = false) {
  if (session?.sessionKind !== "quick" || !exercise?.id || !exercise?.name ||
      session.exercises.some((entry) => entry.exerciseId === exercise.id)) return session;
  return {
    ...session,
    exercises: [...session.exercises, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      prescribedSets: 1,
      repRange: "",
      allowsBlankWeight,
      supersetGroupId: null,
      sets: [{ setNumber: 1, weight: "", reps: "", completed: false }],
    }],
  };
}

export function addQuickWorkoutSet(session, exerciseIndex) {
  if (session?.sessionKind !== "quick" || !session.exercises[exerciseIndex]) return session;
  return {
    ...session,
    exercises: session.exercises.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise;
      const lastSet = exercise.sets.at(-1);
      return {
        ...exercise,
        prescribedSets: exercise.sets.length + 1,
        sets: [...exercise.sets, {
          setNumber: (lastSet?.setNumber ?? 0) + 1,
          weight: lastSet?.completed ? lastSet.weight : "",
          reps: "",
          completed: false,
        }],
      };
    }),
  };
}

export function normalizeCompletedWorkout(value) {
  if (
    !(
      value &&
      typeof value.id === "string" &&
      typeof value.completedAt === "string" &&
      !Number.isNaN(Date.parse(value.completedAt)) &&
      hasValidWorkoutAssociations(value) &&
      typeof value.routineDayName === "string" &&
      Array.isArray(value.exercises)
    )
  ) {
    return null;
  }

  const exercises = value.exercises.map((exercise) => {
    if (
      !(
        exercise &&
        typeof exercise.exerciseId === "string" &&
        typeof exercise.exerciseName === "string" &&
        (typeof exercise.originalExerciseId === "string" ||
          typeof exercise.originalExerciseId === "undefined") &&
        (typeof exercise.originalExerciseName === "string" ||
          typeof exercise.originalExerciseName === "undefined") &&
        Array.isArray(exercise.sets)
      )
    ) {
      return null;
    }

    const sets = exercise.sets.map((set) => {
      if (
        !(
          set &&
          typeof set.setNumber === "number" &&
          typeof set.weight === "string" &&
          typeof set.reps === "string"
        )
      ) {
        return null;
      }

      return {
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
        ...(typeof set.unit === "string" ? { unit: set.unit } : {}),
      };
    });

    if (sets.some((set) => !set)) {
      return null;
    }

    return {
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      ...(typeof exercise.originalExerciseId === "string"
        ? { originalExerciseId: exercise.originalExerciseId }
        : {}),
      ...(typeof exercise.originalExerciseName === "string"
        ? { originalExerciseName: exercise.originalExerciseName }
        : {}),
      restSeconds:
        typeof exercise.restSeconds === "number" ? exercise.restSeconds : null,
      supersetGroupId:
        typeof exercise.supersetGroupId === "string"
          ? exercise.supersetGroupId
          : null,
      sets,
    };
  });

  if (exercises.some((exercise) => !exercise)) {
    return null;
  }

  return {
    id: value.id,
    completedAt: value.completedAt,
    ...(typeof value.weightUnit === "string" ? { weightUnit: value.weightUnit } : {}),
    ...workoutAssociations(value),
    routineDayName: value.routineDayName,
    exercises,
  };
}

export function isValidWorkoutSession(value, isSupportedExerciseId) {
  return (
    value &&
    hasValidWorkoutAssociations(value) &&
    Array.isArray(value.exercises) &&
    value.exercises.every(
      (exercise) =>
        exercise &&
        typeof exercise.exerciseId === "string" &&
        isSupportedExerciseId(exercise.exerciseId) &&
        (typeof exercise.exerciseName === "string" ||
          typeof exercise.exerciseName === "undefined") &&
        typeof exercise.prescribedSets === "number" &&
        typeof exercise.repRange === "string" &&
        (typeof exercise.note === "string" ||
          typeof exercise.note === "undefined") &&
        (typeof exercise.restSeconds === "number" ||
          exercise.restSeconds === null ||
          typeof exercise.restSeconds === "undefined") &&
        (typeof exercise.supersetGroupId === "string" ||
          exercise.supersetGroupId === null ||
          typeof exercise.supersetGroupId === "undefined") &&
        Array.isArray(exercise.sets) &&
        exercise.sets.every(
          (set) =>
            set &&
            typeof set.setNumber === "number" &&
            typeof set.weight === "string" &&
            typeof set.reps === "string" &&
            (typeof set.completed === "boolean" ||
              typeof set.completed === "undefined"),
        ),
    )
  );
}
