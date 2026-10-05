import { robTrainingProfile } from "./robTrainingProfile.js";

export const ROB_CONTEXT_TYPES = Object.freeze({
  ADVICE: "advice",
  ROUTINE_REVIEW: "routine_review",
  PROGRAM_REVIEW: "program_review",
});

export const ROB_CONTEXT_LIMITS = Object.freeze({
  routines: 12,
  exercisesPerRoutine: 30,
  historyWorkouts: 8,
  exercisesPerWorkout: 20,
  setsPerExercise: 12,
  text: 500,
  name: 160,
  id: 200,
});

export class RobContextError extends Error {
  constructor(code) {
    super(code);
    this.name = "RobContextError";
    this.code = code;
  }
}

const validTypes = new Set(Object.values(ROB_CONTEXT_TYPES));
const text = (value, limit = ROB_CONTEXT_LIMITS.text) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null;
const id = (value) => {
  const normalized = text(value, ROB_CONTEXT_LIMITS.id);
  return normalized && normalized.length === String(value).trim().length ? normalized : null;
};
const routinesFor = (program) => Array.isArray(program?.days) ? program.days : Array.isArray(program?.routines) ? program.routines : null;
const meaningfulSet = (set) => Number(set?.reps) > 0 || Number(set?.weight) > 0;

function isoDate(value) {
  const date = value && typeof value.toDate === "function" ? value.toDate() : value;
  if (date instanceof Date) return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  if (typeof date === "string" && !Number.isNaN(Date.parse(date))) return new Date(date).toISOString();
  return null;
}

function serializeExercise(exercise) {
  const routineExerciseId = id(exercise?.routineExerciseId);
  const exerciseId = id(exercise?.exerciseId);
  if (!routineExerciseId || !exerciseId) return null;
  return {
    routineExerciseId,
    exerciseId,
    name: text(exercise.displayNameOverride, ROB_CONTEXT_LIMITS.name) ?? text(exercise.name ?? exercise.exerciseName, ROB_CONTEXT_LIMITS.name),
    sets: Number.isInteger(Number(exercise.sets)) ? Number(exercise.sets) : null,
    repRange: text(exercise.repRange, ROB_CONTEXT_LIMITS.name),
    restSeconds: Number.isFinite(Number(exercise.restSeconds)) ? Number(exercise.restSeconds) : null,
    note: text(exercise.note),
    supersetGroupId: id(exercise.supersetGroupId),
  };
}

function serializeRoutine(routine) {
  const routineId = id(routine?.id);
  if (!routineId) return null;
  return {
    id: routineId,
    name: text(routine.name, ROB_CONTEXT_LIMITS.name),
    exercises: (Array.isArray(routine.exercises) ? routine.exercises : [])
      .slice(0, ROB_CONTEXT_LIMITS.exercisesPerRoutine)
      .map(serializeExercise)
      .filter(Boolean),
  };
}

function serializeProgram(program, { routineId = null, allRoutines = true } = {}) {
  const programId = id(program?.id);
  const routines = routinesFor(program);
  if (!programId || !routines) throw new RobContextError("rob_context_invalid_program");
  const active = routines.filter((routine) => routine?.archived !== true);
  const selected = allRoutines ? active : active.filter((routine) => routine.id === routineId);
  return {
    id: programId,
    name: text(program.name, ROB_CONTEXT_LIMITS.name),
    description: text(program.description),
    routines: selected.slice(0, ROB_CONTEXT_LIMITS.routines).map(serializeRoutine).filter(Boolean),
  };
}

function serializeWorkout(workout) {
  const workoutId = id(workout?.id);
  if (!workoutId || !Array.isArray(workout.exercises) || !workout.exercises.some((exercise) => Array.isArray(exercise?.sets) && exercise.sets.some(meaningfulSet))) return null;
  return {
    id: workoutId,
    completedAt: isoDate(workout.completedAt),
    routineId: id(workout.routineId ?? workout.routineDayId),
    routineName: text(workout.routineName ?? workout.routineDayName, ROB_CONTEXT_LIMITS.name),
    exercises: workout.exercises.slice(0, ROB_CONTEXT_LIMITS.exercisesPerWorkout).map((exercise) => {
      const exerciseId = id(exercise?.exerciseId);
      if (!exerciseId) return null;
      const sets = (Array.isArray(exercise.sets) ? exercise.sets : []).filter(meaningfulSet).slice(0, ROB_CONTEXT_LIMITS.setsPerExercise).map((set) => ({
        weight: text(set.weight, ROB_CONTEXT_LIMITS.name),
        reps: text(set.reps, ROB_CONTEXT_LIMITS.name),
      }));
      return sets.length ? { exerciseId, exerciseName: text(exercise.exerciseName, ROB_CONTEXT_LIMITS.name), originalExerciseId: id(exercise.originalExerciseId), sets } : null;
    }).filter(Boolean),
  };
}

function relevantHistory(completedWorkouts, { routineIds, exerciseIds }) {
  return (Array.isArray(completedWorkouts) ? completedWorkouts : [])
    .map((workout, index) => ({ workout: serializeWorkout(workout), index }))
    .filter(({ workout }) => workout)
    .filter(({ workout }) => {
      if (!routineIds.size && !exerciseIds.size) return true;
      if (!workout.routineId) return true; // conservative legacy fallback
      return routineIds.has(workout.routineId) || workout.exercises.some((exercise) => exerciseIds.has(exercise.exerciseId));
    })
    .sort((a, b) => (Date.parse(b.workout.completedAt ?? "") || -Infinity) - (Date.parse(a.workout.completedAt ?? "") || -Infinity) || a.index - b.index)
    .slice(0, ROB_CONTEXT_LIMITS.historyWorkouts)
    .map(({ workout }) => workout);
}

function profile() {
  return { goals: [...robTrainingProfile.goals], equipment: [...robTrainingProfile.equipment], constraints: [...robTrainingProfile.constraints], trainingStyle: { ...robTrainingProfile.trainingStyle } };
}

export function buildRobContext({ requestType, program, routineId = null, completedWorkouts = [] } = {}) {
  if (!validTypes.has(requestType)) throw new RobContextError("rob_context_invalid_request_type");
  const requiresProgram = requestType !== ROB_CONTEXT_TYPES.ADVICE;
  if (requiresProgram && !program) throw new RobContextError("rob_context_missing_program");
  let serializedProgram = null;
  let selectedRoutineId = null;
  if (program) {
    if (requestType === ROB_CONTEXT_TYPES.ROUTINE_REVIEW) {
      if (!id(routineId)) throw new RobContextError("rob_context_missing_routine");
      const available = routinesFor(program);
      if (!available?.some((routine) => routine?.id === routineId && routine.archived !== true)) throw new RobContextError("rob_context_missing_routine");
      selectedRoutineId = routineId;
      serializedProgram = serializeProgram(program, { routineId, allRoutines: false });
    } else {
      selectedRoutineId = id(routineId);
      serializedProgram = serializeProgram(program);
      if (selectedRoutineId && !serializedProgram.routines.some((routine) => routine.id === selectedRoutineId)) selectedRoutineId = null;
    }
  }
  const relevantRoutines = selectedRoutineId ? serializedProgram?.routines.filter((routine) => routine.id === selectedRoutineId) : serializedProgram?.routines ?? [];
  const routineIds = new Set(relevantRoutines.map((routine) => routine.id));
  const exerciseIds = new Set(relevantRoutines.flatMap((routine) => routine.exercises.map((exercise) => exercise.exerciseId)));
  return {
    version: 1,
    requestType,
    target: { programId: serializedProgram?.id ?? null, routineId: requestType === ROB_CONTEXT_TYPES.PROGRAM_REVIEW ? null : selectedRoutineId },
    profile: profile(),
    program: serializedProgram,
    history: { workouts: relevantHistory(completedWorkouts, { routineIds, exerciseIds }) },
  };
}
