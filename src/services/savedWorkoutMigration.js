import { isSavedWorkoutId, SAVED_WORKOUT_MODEL_VERSION, validateSavedWorkoutLibrary } from "./savedWorkoutModel.js";

// Offline planning only: no app import, Firebase dependency, clock, UID lookup or writes.
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value) && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return value;
  throw new Error("Expected plain JSON data; serialize timestamps before planning.");
}
function allocateId(base, reserved) {
  let id = base;
  let suffix = 2;
  while (reserved.has(id)) id = `${base}:${suffix++}`;
  reserved.add(id);
  return id;
}
// Escape the escape marker too; generated IDs remain in the existing Rob ID alphabet.
const encodeIdentity = (value) => [...value].map((character) => /^[A-Za-z0-9.-]$/.test(character)
  ? character : `_${character.codePointAt(0).toString(16)}_`).join("");

export function planLegacyWorkoutMigration({ accountId, legacyPrograms } = {}) {
  const errors = [];
  const adjustments = [];
  const error = (code, path) => errors.push({ code, path });
  const report = (target = null, mappings = []) => ({
    migrationVersion: 1,
    accountId: typeof accountId === "string" ? accountId : null,
    ok: errors.length === 0,
    errors,
    summary: {
      sourcePrograms: Array.isArray(legacyPrograms) ? legacyPrograms.length : null,
      targetPrograms: target?.programs.length ?? null,
      targetWorkouts: target?.workouts.length ?? null,
      archivedPrograms: target?.programs.filter((program) => program.archived).length ?? null,
      archivedWorkouts: target?.workouts.filter((workout) => workout.archived).length ?? null,
      remappedWorkoutIds: target ? mappings.filter((entry) => entry.legacyRoutineId !== entry.workoutId).length : null,
      addedRowIds: target ? adjustments.filter((entry) => entry.code === "added_row_id").length : null,
      addedSupersetAliases: target ? adjustments.filter((entry) => entry.code === "added_superset_alias").length : null,
    },
    mappings,
    adjustments: target ? adjustments : [],
    target,
  });
  if (!isSavedWorkoutId(accountId)) error("explicit_account_id_required", "accountId");
  if (!Array.isArray(legacyPrograms)) error("invalid_legacy_programs", "legacyPrograms");
  if (errors.length) return report();
  let source;
  try {
    // Canonical JSON comparison treats object key order as immaterial, array order as significant.
    source = canonical(legacyPrograms);
  } catch {
    error("non_json_source", "legacyPrograms");
    return report();
  }
  const programIds = new Set();
  const routineCounts = new Map();
  const sources = source.map((program, index) => {
    const path = `legacyPrograms[${index}]`;
    if (!record(program)) { error("invalid_program", path); return null; }
    if (!isSavedWorkoutId(program.id)) error("invalid_program_id", `${path}.id`);
    if (programIds.has(program.id)) error("duplicate_program_id", `${path}.id`);
    programIds.add(program.id);
    if ("workoutIds" in program) error("already_independent_program", path);
    if ("days" in program && !Array.isArray(program.days)) error("invalid_days", `${path}.days`);
    if ("routines" in program && !Array.isArray(program.routines)) error("invalid_routines", `${path}.routines`);
    if (Array.isArray(program.days) && Array.isArray(program.routines) &&
        JSON.stringify(program.days) !== JSON.stringify(program.routines)) error("conflicting_legacy_aliases", path);
    const routines = program.days ?? program.routines;
    if (!Array.isArray(routines)) { error("missing_routines", path); return null; }
    const seen = new Set();
    routines.forEach((routine, position) => {
      const routinePath = `${path}.routines[${position}]`;
      if (!record(routine) || !isSavedWorkoutId(routine.id)) { error("invalid_routine_id", routinePath); return; }
      if (seen.has(routine.id)) error("duplicate_routine_in_program", routinePath);
      seen.add(routine.id);
      routineCounts.set(routine.id, (routineCounts.get(routine.id) ?? 0) + 1);
      if ("programId" in routine && routine.programId !== program.id) error("conflicting_legacy_owner", routinePath);
    });
    return { program, routines };
  });
  if (errors.length) return report();
  // Reserve even colliding legacy IDs so generated IDs cannot steal a preserved identity.
  const reserved = new Set(routineCounts.keys());
  const target = { version: SAVED_WORKOUT_MODEL_VERSION, programs: [], workouts: [] };
  const mappings = [];
  for (const { program, routines } of sources) {
    const metadata = Object.fromEntries(Object.entries(program).filter(([key]) => !["days", "routines"].includes(key)));
    const workoutIds = [];
    for (const routine of routines) {
      const workoutId = routineCounts.get(routine.id) === 1 ? routine.id : allocateId(
        `legacy-workout:${encodeIdentity(program.id)}:${encodeIdentity(routine.id)}`, reserved,
      );
      const rowIds = new Set((Array.isArray(routine.exercises) ? routine.exercises : []).map((entry) => entry?.routineExerciseId));
      const exercises = Array.isArray(routine.exercises) ? routine.exercises.map((exercise, index) => {
        if (!record(exercise)) return exercise;
        const additions = {};
        const path = { programId: program.id, legacyRoutineId: routine.id, exerciseIndex: index };
        if (!Object.hasOwn(exercise, "routineExerciseId")) {
          additions.routineExerciseId = allocateId(`legacy-row:${encodeIdentity(workoutId)}:${index + 1}`, rowIds);
          adjustments.push({ code: "added_row_id", ...path, routineExerciseId: additions.routineExerciseId });
        }
        if (!Object.hasOwn(exercise, "supersetGroupId") && Object.hasOwn(exercise, "groupId")) {
          additions.supersetGroupId = exercise.groupId;
          adjustments.push({ code: "added_superset_alias", ...path, supersetGroupId: exercise.groupId });
        }
        return {
          ...exercise,
          // Missing old row IDs are added, existing row identities are never replaced.
          ...additions,
        };
      }) : routine.exercises;
      target.workouts.push({ ...routine, id: workoutId, programId: program.id,
        archived: Object.hasOwn(routine, "archived") ? routine.archived : false, exercises });
      workoutIds.push(workoutId);
      mappings.push({ programId: program.id, legacyRoutineId: routine.id, workoutId });
    }
    target.programs.push({ ...metadata, archived: Object.hasOwn(program, "archived") ? program.archived : false, workoutIds });
  }
  errors.push(...validateSavedWorkoutLibrary(target).errors);
  return errors.length ? report() : report(target, mappings);
}
