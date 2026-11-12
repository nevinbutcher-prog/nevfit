import { validateSavedWorkoutLibrary } from "./savedWorkoutModel.js";

export function assertTrainingLibrary(library) {
  const result = validateSavedWorkoutLibrary(library);
  if (!result.valid) throw new Error(`invalid_training_library:${result.errors[0].code}`);
  return library;
}
export function projectTrainingPrograms(library) {
  assertTrainingLibrary(library);
  const workouts = new Map(library.workouts.map((workout) => [workout.id, workout]));
  return library.programs.map((program) => ({ ...program, days: program.workoutIds.map((id) => workouts.get(id)) }));
}
const copy = (library) => ({ ...library,
  programs: library.programs.map((program) => ({ ...program, workoutIds: [...program.workoutIds] })),
  workouts: library.workouts.map((workout) => ({ ...workout, exercises: workout.exercises.map((entry) => ({ ...entry })) })),
});
export function libraryFromProgramProjection(baseline, programs) {
  const next = copy(baseline);
  const ids = new Set(programs.map((program) => program.id));
  if (baseline.programs.some((program) => !ids.has(program.id))) throw new Error("program_deletion_requires_domain_operation");
  const seen = new Set();
  next.programs = programs.map(({ days, routines, workoutIds, ...metadata }) => { // eslint-disable-line no-unused-vars
    if (!Array.isArray(days)) throw new Error("invalid_program_projection");
    const previous = baseline.programs.find((entry) => entry.id === metadata.id);
    for (const day of days) {
      if (seen.has(day.id)) throw new Error("duplicate_workout_membership");
      seen.add(day.id);
      const old = baseline.workouts.find((entry) => entry.id === day.id);
      if (old && old.programId !== metadata.id) throw new Error("ownership_change_requires_move_operation");
      const exercises = day.exercises.map((entry) => {
        const row = { ...old?.exercises.find((candidate) => candidate.routineExerciseId === entry.routineExerciseId), ...entry };
        for (const field of ["note", "displayNameOverride"]) if (!Object.hasOwn(entry, field)) delete row[field];
        return row;
      });
      const workout = { ...old, ...day, programId: metadata.id, archived: day.archived === true, exercises };
      const index = next.workouts.findIndex((entry) => entry.id === day.id);
      if (index < 0) next.workouts.push(workout); else next.workouts[index] = workout;
    }
    const program = { ...previous, ...metadata, archived: metadata.archived === true, workoutIds: days.map((day) => day.id) };
    if (!Object.hasOwn(metadata, "description")) delete program.description;
    return program;
  });
  // Removing a template from an interim embedded projection detaches, never destroys it.
  next.workouts = next.workouts.map((workout) => workout.programId !== null && !seen.has(workout.id) ? { ...workout, programId: null } : workout);
  return assertTrainingLibrary(next);
}

export function applyTrainingOperation(library, operation) {
  const next = copy(assertTrainingLibrary(library));
  const workout = next.workouts.find((entry) => entry.id === operation.id);
  const program = next.programs.find((entry) => entry.id === operation.id);
  const move = (entry, programId, index) => {
    next.programs.forEach((item) => { item.workoutIds = item.workoutIds.filter((id) => id !== entry.id); });
    if (programId !== null) {
      const owner = next.programs.find((item) => item.id === programId);
      if (!owner) throw new Error("missing_owner_program");
      owner.workoutIds.splice(index ?? owner.workoutIds.length, 0, entry.id);
    }
    entry.programId = programId;
  };
  switch (operation.type) {
    case "createWorkout": {
      if (next.workouts.some((entry) => entry.id === operation.workout.id)) throw new Error("workout_id_conflict");
      const entry = { ...operation.workout, archived: operation.workout.archived === true, exercises: operation.workout.exercises ?? [], programId: null };
      next.workouts.push(entry);
      move(entry, operation.workout.programId ?? null, operation.index);
      break;
    }
    case "saveWorkout":
      if (!workout || (operation.workout.programId !== undefined && operation.workout.programId !== workout.programId)) throw new Error("use_move_for_ownership_changes");
      Object.assign(workout, operation.workout, { id: workout.id, programId: workout.programId });
      break;
    case "moveWorkout":
      if (!workout) throw new Error("missing_workout");
      move(workout, operation.programId, operation.index);
      break;
    case "archiveWorkout":
      if (!workout) throw new Error("missing_workout");
      workout.archived = operation.archived;
      break;
    case "duplicateWorkout": {
      if (!workout || next.workouts.some((entry) => entry.id === operation.newId) || operation.rowIds?.length !== workout.exercises.length) throw new Error("invalid_duplicate");
      const duplicate = { ...workout, id: operation.newId, name: operation.name ?? `${workout.name} Copy`, programId: null,
        exercises: workout.exercises.map((entry, index) => ({ ...entry, routineExerciseId: operation.rowIds[index] })) };
      next.workouts.push(duplicate);
      move(duplicate, operation.programId ?? null, operation.index);
      break;
    }
    case "deleteWorkout":
      if (!workout) throw new Error("missing_workout");
      move(workout, null);
      next.workouts = next.workouts.filter((entry) => entry.id !== workout.id);
      break;
    case "createProgram":
      if (next.programs.some((entry) => entry.id === operation.program.id)) throw new Error("program_id_conflict");
      next.programs.push({ ...operation.program, archived: operation.program.archived === true, workoutIds: [] });
      break;
    case "saveProgram":
      if (!program) throw new Error("missing_program");
      for (const field of ["name", "description", "archived"]) if (Object.hasOwn(operation.program, field)) program[field] = operation.program[field];
      break;
    case "duplicateProgram": {
      if (!program || next.programs.some((entry) => entry.id === operation.newId) || operation.workoutCopies?.length !== program.workoutIds.length) throw new Error("invalid_program_duplicate");
      const copies = program.workoutIds.map((id, index) => {
        const source = next.workouts.find((entry) => entry.id === id);
        const target = operation.workoutCopies[index];
        if (target.id !== id || next.workouts.some((entry) => entry.id === target.newId) || target.rowIds?.length !== source.exercises.length) throw new Error("invalid_program_duplicate");
        return { ...source, id: target.newId, archived: false, programId: operation.newId,
          exercises: source.exercises.map((entry, row) => ({ ...entry, routineExerciseId: target.rowIds[row] })) };
      });
      next.workouts.push(...copies);
      next.programs.push({ ...program, id: operation.newId, name: operation.name ?? `${program.name} Copy`, archived: false, workoutIds: copies.map((entry) => entry.id) });
      break;
    }
    case "deleteProgram":
      if (!program) throw new Error("missing_program");
      next.workouts.filter((entry) => entry.programId === program.id).forEach((entry) => move(entry, null));
      next.programs = next.programs.filter((entry) => entry.id !== program.id);
      break;
    default: throw new Error("unsupported_training_operation");
  }
  return assertTrainingLibrary(next);
}
