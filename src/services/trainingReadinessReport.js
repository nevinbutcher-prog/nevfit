import { planLegacyWorkoutMigration } from "./savedWorkoutMigration.js";
import { projectFirestoreValue } from "./firestoreValueCodec.js";

export function createTrainingReadinessReport(uid, documents) {
  documents = [...documents].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const prefix = `users/${uid}/`;
  const programs = documents.filter((entry) => entry.path.startsWith(`${prefix}programs/`) && entry.exists);
  const errors = [];
  const legacyPrograms = [];
  const occurrences = new Map();
  let sourceRoutineCount = 0;
  for (const entry of programs) {
    const programId = entry.path.split("/").at(-1);
    if (entry.data.id !== undefined && entry.data.id !== programId) errors.push({ code: "stored_program_id_mismatch", path: entry.path });
    try {
      legacyPrograms.push({ ...projectFirestoreValue(entry.data), id: programId });
    } catch {
      errors.push({ code: "noncanonical_planner_value", path: entry.path });
    }
    const routines = entry.data.days ?? entry.data.routines;
    if (!Array.isArray(routines)) continue;
    sourceRoutineCount += routines.length;
    routines.forEach((routine, index) => {
      if (typeof routine?.id !== "string") return;
      occurrences.set(routine.id, [...(occurrences.get(routine.id) ?? []), { programId, index }]);
    });
  }
  const plan = planLegacyWorkoutMigration({ accountId: uid, legacyPrograms });
  // Never present a partial projection as a valid transformation.
  if (errors.length) {
    plan.ok = false;
    plan.target = null;
    plan.mappings = [];
    plan.adjustments = [];
    plan.summary = null;
  }
  errors.push(...plan.errors);
  if (!plan.ok) plan.errors = [...errors];
  const user = documents.find((entry) => entry.path === `users/${uid}` && entry.exists)?.data;
  if (user?.uid !== undefined && user.uid !== uid) errors.push({ code: "stored_account_uid_mismatch", path: `users/${uid}` });
  const collisions = [...occurrences].filter(([, entries]) => entries.length > 1)
    .map(([legacyRoutineId, entries]) => ({ legacyRoutineId, occurrences: entries }));
  const linkage = [];
  const resolve = (kind, path, routineId) => {
    const candidates = occurrences.get(routineId) ?? [];
    const mapping = plan.mappings.find((entry) => entry.legacyRoutineId === routineId);
    const status = routineId === null && kind === "schedule" ? "unassigned" : typeof routineId !== "string" ? "invalid" :
      candidates.length === 0 ? "missing" : candidates.length > 1 ? "ambiguous" : mapping ? "resolved" : "plan_invalid";
    linkage.push({ kind, path, legacyRoutineId: routineId ?? null, status, workoutId: status === "resolved" ? mapping.workoutId : null });
    if (!["unassigned", "resolved"].includes(status)) errors.push({ code: `${kind}_linkage_${status}`, path });
  };
  const planning = documents.find((entry) => entry.path === `${prefix}appState/planning` && entry.exists)?.data;
  if (planning) {
    if (!Array.isArray(planning.schedule)) errors.push({ code: "invalid_schedule", path: "appState/planning.schedule" });
    else planning.schedule.forEach((day, index) => resolve("schedule", `appState/planning.schedule[${index}]`, day?.routineDayId));
    if (planning.activeProgramId != null && !programs.some((entry) => entry.path === `${prefix}programs/${planning.activeProgramId}`)) {
      errors.push({ code: "selected_program_missing", path: "appState/planning.activeProgramId" });
    }
  }
  const active = documents.find((entry) => entry.path === `${prefix}appState/activeWorkout` && entry.exists)?.data.activeWorkoutSession;
  if (active != null) {
    if (active.sessionKind === "quick") linkage.push({ kind: "active", path: "appState/activeWorkout", status: "quick_no_association" });
    else resolve("active", "appState/activeWorkout.activeWorkoutSession.routineDayId", active.routineDayId);
  }
  if (plan.target) {
    const ids = [...plan.target.programs.map((entry) => entry.id), ...plan.target.workouts.flatMap((entry) => [entry.id, ...entry.exercises.map((exercise) => exercise.routineExerciseId)])];
    ids.forEach((id) => {
      if (id.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id) || new TextEncoder().encode(id).length > 1500) {
        errors.push({ code: "target_id_compatibility_review", path: `identity:${id}` });
      }
    });
  }
  return {
    legacyValidationPassed: errors.length === 0,
    sourceProgramCount: programs.length,
    sourceRoutineCount,
    collisions, linkage, errors, plan,
    cutoverAllowed: false,
    blockers: ["unknown_subcollections_not_enumerated", "full_account_backup_not_verified", "destructive_restore_not_tested", "cutover_not_authorized"],
  };
}
