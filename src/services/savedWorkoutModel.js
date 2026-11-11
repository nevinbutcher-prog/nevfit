import { isSupportedExerciseId } from "./nevfitCatalogue.js";

// Unactivated in-memory contract. A saved template is not a session/history record.
export const SAVED_WORKOUT_MODEL_VERSION = 1;
export const isSavedWorkoutId = (value) => typeof value === "string" &&
  value.length > 0 && value === value.trim() && !/[\s/]/.test(value) &&
  [...value].every((character) => character.codePointAt(0) >= 32) &&
  value !== "." && value !== ".." && !/^__.*__$/.test(value);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateSavedWorkoutLibrary(library) {
  const errors = [];
  const error = (code, path) => errors.push({ code, path });
  if (!record(library) || library.version !== SAVED_WORKOUT_MODEL_VERSION ||
      !Array.isArray(library.programs) || !Array.isArray(library.workouts)) {
    return { valid: false, errors: [{ code: "invalid_library", path: "library" }] };
  }
  const programs = new Map();
  const workouts = new Map();
  const memberships = new Map();
  for (const [index, program] of library.programs.entries()) {
    const path = `programs[${index}]`;
    if (!record(program)) { error("invalid_program", path); continue; }
    if (!isSavedWorkoutId(program.id)) error("invalid_id", `${path}.id`);
    if (programs.has(program.id)) error("duplicate_program_id", `${path}.id`);
    programs.set(program.id, program);
    if (typeof program.name !== "string" || !program.name.trim()) error("invalid_name", `${path}.name`);
    if (typeof program.archived !== "boolean") error("invalid_archive_status", `${path}.archived`);
    if ("days" in program || "routines" in program) error("embedded_workouts", path);
    if (!Array.isArray(program.workoutIds)) { error("invalid_references", `${path}.workoutIds`); continue; }
    const seen = new Set();
    for (const [position, id] of program.workoutIds.entries()) {
      if (!isSavedWorkoutId(id)) error("invalid_reference", `${path}.workoutIds[${position}]`);
      if (seen.has(id)) error("duplicate_membership", `${path}.workoutIds[${position}]`);
      seen.add(id);
      memberships.set(id, [...(memberships.get(id) ?? []), program.id]);
    }
  }
  for (const [index, workout] of library.workouts.entries()) {
    const path = `workouts[${index}]`;
    if (!record(workout)) { error("invalid_workout", path); continue; }
    if (!isSavedWorkoutId(workout.id)) error("invalid_id", `${path}.id`);
    if (workouts.has(workout.id)) error("duplicate_workout_id", `${path}.id`);
    workouts.set(workout.id, workout);
    if (typeof workout.name !== "string" || !workout.name.trim()) error("invalid_name", `${path}.name`);
    if (typeof workout.archived !== "boolean") error("invalid_archive_status", `${path}.archived`);
    if (workout.programId !== null && !isSavedWorkoutId(workout.programId)) error("invalid_owner", `${path}.programId`);
    const owners = memberships.get(workout.id) ?? [];
    if (owners.length > 1) error("multiple_membership", path);
    if (workout.programId === null ? owners.length !== 0 :
      !programs.has(workout.programId) || owners.length !== 1 || owners[0] !== workout.programId) {
      error("ownership_mismatch", `${path}.programId`);
    }
    if (!Array.isArray(workout.exercises)) { error("invalid_exercises", `${path}.exercises`); continue; }
    const rows = new Set();
    for (const [position, exercise] of workout.exercises.entries()) {
      const entryPath = `${path}.exercises[${position}]`;
      if (!record(exercise)) { error("invalid_exercise", entryPath); continue; }
      if (!isSavedWorkoutId(exercise.routineExerciseId) || rows.has(exercise.routineExerciseId)) error("invalid_row_identity", `${entryPath}.routineExerciseId`);
      rows.add(exercise.routineExerciseId);
      if (!isSupportedExerciseId(exercise.exerciseId)) error("invalid_exercise_id", `${entryPath}.exerciseId`);
      if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 12) error("invalid_sets", `${entryPath}.sets`);
      if (typeof exercise.repRange !== "string" || !exercise.repRange.trim()) error("invalid_rep_range", `${entryPath}.repRange`);
      if (exercise.restSeconds != null && (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 600)) error("invalid_rest", `${entryPath}.restSeconds`);
      for (const field of ["note", "displayNameOverride"]) {
        if (exercise[field] !== undefined && typeof exercise[field] !== "string") error("invalid_text", `${entryPath}.${field}`);
      }
      if (exercise.supersetGroupId != null && !isSavedWorkoutId(exercise.supersetGroupId)) error("invalid_superset", `${entryPath}.supersetGroupId`);
      if (Object.hasOwn(exercise, "groupId") && Object.hasOwn(exercise, "supersetGroupId") &&
          exercise.groupId !== exercise.supersetGroupId) error("conflicting_superset_aliases", entryPath);
    }
  }
  for (const id of memberships.keys()) {
    if (!workouts.has(id)) error("missing_workout", `workoutIds:${id}`);
  }
  return { valid: errors.length === 0, errors };
}
