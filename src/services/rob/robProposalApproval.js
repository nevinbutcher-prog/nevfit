import {
  applyRoutineProposal,
  ROUTINE_PROPOSAL_TYPES,
  validateRoutineProposal,
} from "../routineProposal.js";

const routinesFor = (program) => Array.isArray(program?.days)
  ? program.days
  : Array.isArray(program?.routines) ? program.routines : [];

const canonicalExercise = (exercise) => ({
  routineExerciseId: exercise.routineExerciseId,
  exerciseId: exercise.exerciseId,
  sets: Number(exercise.sets),
  repRange: exercise.repRange ?? "",
  restSeconds: exercise.restSeconds ?? null,
  displayNameOverride: exercise.displayNameOverride ?? null,
  note: exercise.note ?? null,
  supersetGroupId: exercise.supersetGroupId ?? null,
});

const canonicalRoutine = (routine) => ({
  id: routine.id,
  name: routine.name ?? "",
  exercises: (routine.exercises ?? []).map(canonicalExercise),
});

const fingerprint = (value) => JSON.stringify(value);

export function createRoutineProposalBaseline(program, proposal) {
  if (!program || !proposal || proposal.targetProgramId !== program.id) return null;
  if (proposal.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY) {
    const routine = routinesFor(program).find((item) => item.id === proposal.targetRoutineId);
    if (!routine) return null;
    return { programId: program.id, routineId: routine.id, proposalType: proposal.proposalType, fingerprint: fingerprint(canonicalRoutine(routine)) };
  }
  if (proposal.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE) {
    return { programId: program.id, routineId: null, proposalType: proposal.proposalType, fingerprint: fingerprint({ id: program.id, routines: routinesFor(program).map(canonicalRoutine) }) };
  }
  return null;
}

export function isRoutineProposalFresh(program, baseline) {
  if (!program || !baseline || program.id !== baseline.programId) return false;
  if (baseline.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY) {
    const routine = routinesFor(program).find((item) => item.id === baseline.routineId);
    return Boolean(routine) && fingerprint(canonicalRoutine(routine)) === baseline.fingerprint;
  }
  if (baseline.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE) {
    return fingerprint({ id: program.id, routines: routinesFor(program).map(canonicalRoutine) }) === baseline.fingerprint;
  }
  return false;
}

const prescription = (exercise) => [
  `${exercise.sets} ${exercise.sets === 1 ? "set" : "sets"}`,
  `${exercise.repRange} reps`,
  exercise.restSeconds === null || exercise.restSeconds === undefined ? null : `${exercise.restSeconds} sec rest`,
].filter(Boolean);

const value = (item) => item === null || item === undefined || item === "" ? "None" : String(item);

export function buildRoutineProposalPreview(program, proposal, { getExerciseName } = {}) {
  const routine = proposal?.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY
    ? routinesFor(program).find((item) => item.id === proposal.targetRoutineId)
    : null;
  if (proposal?.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY && !routine) return { valid: false, code: "rob_proposal_target_missing", items: [] };
  const entries = new Map((routine?.exercises ?? []).map((entry) => [entry.routineExerciseId, entry]));
  const nameOf = (entry) => {
    const name = entry?.displayNameOverride?.trim() || getExerciseName?.(entry?.exerciseId);
    return typeof name === "string" && name.trim() ? name.trim() : null;
  };
  const named = (entry) => {
    const name = nameOf(entry);
    if (!name) throw new Error("unresolved_exercise_name");
    return name;
  };
  try {
    if (proposal?.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE) {
      const newRoutine = proposal.routine;
      const items = newRoutine.exercises.map((entry) => ({ type: "add_exercise", title: `Add ${named(entry)}`, details: [...prescription(entry), "In new routine"] }));
      return { valid: true, routineName: newRoutine.name, items };
    }
    if (proposal?.proposalType !== ROUTINE_PROPOSAL_TYPES.MODIFY) return { valid: false, code: "rob_proposal_invalidated", items: [] };
    const items = proposal.changes.map((change) => {
      const target = entries.get(change.targetRoutineExerciseId);
      if (change.type === "rename_routine") return { type: change.type, title: "Routine name", details: [`${routine.name} → ${change.name}`] };
      if (change.type === "add_exercise") {
        const anchor = change.afterRoutineExerciseId === null ? null : entries.get(change.afterRoutineExerciseId);
        if (change.afterRoutineExerciseId !== null && !anchor) throw new Error("missing_anchor");
        entries.set(change.exercise.routineExerciseId, change.exercise);
        return { type: change.type, title: `Add ${named(change.exercise)}`, details: [...prescription(change.exercise), anchor ? `After ${named(anchor)}` : "At start of routine"] };
      }
      if (change.type === "set_superset") {
        const members = change.memberRoutineExerciseIds.map((id) => entries.get(id));
        if (members.some((entry) => !entry)) throw new Error("missing_member");
        return { type: change.type, title: "Create superset", details: members.map(named) };
      }
      if (!target) throw new Error("missing_target");
      if (change.type === "remove_exercise") return { type: change.type, title: `Remove ${named(target)}`, details: [] };
      if (change.type === "replace_exercise") return { type: change.type, title: `Replace ${named(target)}`, details: [`With ${named(change.exercise)}`, ...prescription(change.exercise)] };
      if (change.type === "move_exercise") {
        const anchor = change.afterRoutineExerciseId === null ? null : entries.get(change.afterRoutineExerciseId);
        if (change.afterRoutineExerciseId !== null && !anchor) throw new Error("missing_anchor");
        return { type: change.type, title: `Move ${named(target)}`, details: [anchor ? `After ${named(anchor)}` : "To start of routine"] };
      }
      if (change.type === "update_exercise") {
        const labels = { sets: "Sets", repRange: "Reps", restSeconds: "Rest", displayNameOverride: "Name", note: "Note" };
        const details = Object.entries(change.updates).filter(([key, next]) => (target[key] ?? null) !== next).map(([key, next]) => {
          const restValue = (rest) => rest === null || rest === undefined ? "None" : `${rest} sec`;
          const before = key === "restSeconds" ? restValue(target[key]) : value(target[key]);
          const after = key === "restSeconds" ? restValue(next) : value(next);
          return `${labels[key]}: ${before} → ${after}`;
        });
        return { type: change.type, title: `Update ${named(target)}`, details };
      }
      if (change.type === "clear_superset") {
        const members = (routine.exercises ?? []).filter((entry) => entry.supersetGroupId && entry.supersetGroupId === target.supersetGroupId);
        return { type: change.type, title: `Remove superset containing ${named(target)}`, details: members.length > 1 ? members.map(named) : [] };
      }
      throw new Error("unknown_change");
    });
    return { valid: true, routineName: routine.name, items };
  } catch {
    return { valid: false, code: "rob_proposal_preview_unavailable", items: [] };
  }
}

export function prepareRoutineProposalApplication(program, proposal, baseline, { apply = applyRoutineProposal } = {}) {
  if (!program || program.id !== proposal?.targetProgramId) return { ok: false, code: "rob_proposal_target_missing" };
  if (!isRoutineProposalFresh(program, baseline)) return { ok: false, code: "rob_proposal_stale" };
  const validation = validateRoutineProposal(proposal, program);
  if (!validation.valid) return { ok: false, code: "rob_proposal_invalidated", errors: validation.errors };
  try {
    const result = apply(program, validation.normalizedProposal);
    if (!result?.applied || !result.program) return { ok: false, code: "rob_proposal_apply_failed", errors: result?.errors ?? [] };
    return { ok: true, result, normalizedProposal: validation.normalizedProposal };
  } catch {
    return { ok: false, code: "rob_proposal_apply_failed" };
  }
}
