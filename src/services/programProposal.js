import {
  ROUTINE_PROPOSAL_VERSION,
  ROUTINE_PROPOSAL_TYPES,
  applyRoutineProposal,
  validateRoutineProposal,
} from "./routineProposal.js";

export const PROGRAM_PROPOSAL_VERSION = 1;

export const PROGRAM_PROPOSAL_TYPES = Object.freeze({
  CREATE: "create_program",
  MODIFY: "modify_program",
});

export const PROGRAM_PROPOSAL_LIMITS = Object.freeze({
  routines: 6,
  exercisesPerRoutine: 12,
  totalExercises: 50,
});

const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const clone = (value) => structuredClone(value);
const cleanText = (value) => typeof value === "string" ? value.trim() : "";
const validIdentity = (value) => typeof value === "string" && identityPattern.test(value.trim());

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function getDays(program) {
  return Array.isArray(program?.days) ? program.days : Array.isArray(program?.routines) ? program.routines : [];
}

function rejectUnexpectedFields(value, allowed, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) addError(errors, "unsupported_field", `${path}.${key}`, `Field ${key} is not supported in an executable program proposal.`);
  });
}

function validateHeader(proposal, errors) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    addError(errors, "invalid_proposal", "proposal", "Proposal must be an object.");
    return;
  }
  rejectUnexpectedFields(proposal, new Set([
    "id", "version", "proposalType", "title", "summary", "program", "targetProgramId", "routineChanges",
  ]), "proposal", errors);
  if (proposal.version !== PROGRAM_PROPOSAL_VERSION) addError(errors, "unsupported_version", "version", `Only proposal version ${PROGRAM_PROPOSAL_VERSION} is supported.`);
  if (!Object.values(PROGRAM_PROPOSAL_TYPES).includes(proposal.proposalType)) addError(errors, "unknown_proposal_type", "proposalType", "Proposal type must be create_program or modify_program.");
  if (!validIdentity(proposal.id)) addError(errors, "invalid_proposal_id", "id", "A stable proposal ID is required.");
  ["title", "summary"].forEach((field) => {
    if (!cleanText(proposal[field])) addError(errors, `invalid_${field}`, field, `${field} is required and must be readable text.`);
  });
}

function copyRoutineErrors(errors, routineErrors, prefix) {
  routineErrors.forEach((error) => addError(errors, error.code, `${prefix}.${error.path}`, error.message));
}

function validateCreate(proposal, programs, errors) {
  const program = proposal.program;
  if (!program || typeof program !== "object" || Array.isArray(program)) {
    addError(errors, "invalid_program", "program", "Create proposals require a program definition.");
    return null;
  }
  rejectUnexpectedFields(program, new Set(["id", "name", "days"]), "program", errors);
  const id = cleanText(program.id);
  const name = cleanText(program.name);
  if (!validIdentity(id)) addError(errors, "invalid_program_id", "program.id", "A stable program ID is required.");
  else if (programs.some((item) => item?.id === id)) addError(errors, "duplicate_program_id", "program.id", "A program with this ID already exists.");
  if (!name) addError(errors, "invalid_program_name", "program.name", "Program name is required.");
  if (!Array.isArray(program.days)) {
    addError(errors, "invalid_routines", "program.days", "Program days must be an ordered array.");
    return null;
  }
  if (program.days.length === 0 || program.days.length > PROGRAM_PROPOSAL_LIMITS.routines) {
    addError(errors, "invalid_routine_count", "program.days", `Programs must contain 1 to ${PROGRAM_PROPOSAL_LIMITS.routines} routines.`);
  }

  const routineIds = new Set();
  const rowIds = new Set();
  let totalExercises = 0;
  const normalizedDays = program.days.map((routine, index) => {
    const path = `program.days[${index}]`;
    rejectUnexpectedFields(routine, new Set(["id", "name", "exercises"]), path, errors);
    const routineId = cleanText(routine?.id);
    if (!validIdentity(routineId)) addError(errors, "invalid_routine_id", `${path}.id`, "A stable routine ID is required.");
    else if (routineIds.has(routineId)) addError(errors, "duplicate_routine_id", `${path}.id`, "Routine IDs must be unique within a program.");
    else routineIds.add(routineId);
    if (Array.isArray(routine?.exercises)) {
      if (routine.exercises.length > PROGRAM_PROPOSAL_LIMITS.exercisesPerRoutine) addError(errors, "oversized_routine", `${path}.exercises`, `Routines may contain at most ${PROGRAM_PROPOSAL_LIMITS.exercisesPerRoutine} exercises.`);
      totalExercises += routine.exercises.length;
      routine.exercises.forEach((exercise, exerciseIndex) => {
        rejectUnexpectedFields(exercise, new Set(["routineExerciseId", "exerciseId", "sets", "repRange", "restSeconds", "displayNameOverride", "note", "proposalGroupKey"]), `${path}.exercises[${exerciseIndex}]`, errors);
        const rowId = cleanText(exercise?.routineExerciseId);
        if (validIdentity(rowId) && rowIds.has(rowId)) addError(errors, "duplicate_routine_exercise_id", `${path}.exercises[${exerciseIndex}].routineExerciseId`, "Routine exercise IDs must be unique within a program.");
        if (validIdentity(rowId)) rowIds.add(rowId);
      });
    }
    const routineProposal = {
      id: `${cleanText(proposal.id)}:${routineId || index}`,
      version: ROUTINE_PROPOSAL_VERSION,
      proposalType: ROUTINE_PROPOSAL_TYPES.CREATE,
      targetProgramId: id,
      routine,
    };
    const validation = validateRoutineProposal(routineProposal, { id, days: [] });
    copyRoutineErrors(errors, validation.errors, path);
    return validation.normalizedProposal?.routine ?? null;
  });
  if (totalExercises > PROGRAM_PROPOSAL_LIMITS.totalExercises) addError(errors, "oversized_program", "program.days", `Programs may contain at most ${PROGRAM_PROPOSAL_LIMITS.totalExercises} exercises.`);
  return { id, name, days: normalizedDays };
}

function validateModify(proposal, programs, errors) {
  const targetProgramId = cleanText(proposal.targetProgramId);
  const program = programs.find((item) => item?.id === targetProgramId);
  if (!validIdentity(targetProgramId)) addError(errors, "missing_target_program", "targetProgramId", "A valid target program ID is required.");
  else if (!program) addError(errors, "missing_target_program", "targetProgramId", "Target program does not exist.");
  if (!Array.isArray(proposal.routineChanges) || proposal.routineChanges.length === 0) {
    addError(errors, "invalid_routine_changes", "routineChanges", "At least one routine change is required.");
    return { targetProgramId, changes: [] };
  }
  if (proposal.routineChanges.length > PROGRAM_PROPOSAL_LIMITS.routines) addError(errors, "oversized_routine_changes", "routineChanges", `A proposal may change at most ${PROGRAM_PROPOSAL_LIMITS.routines} routines.`);
  const targetIds = new Set();
  const changes = proposal.routineChanges.map((entry, index) => {
    const path = `routineChanges[${index}]`;
    rejectUnexpectedFields(entry, new Set(["targetRoutineId", "changes"]), path, errors);
    const targetRoutineId = cleanText(entry?.targetRoutineId);
    if (!validIdentity(targetRoutineId)) addError(errors, "missing_target_routine", `${path}.targetRoutineId`, "A valid target routine ID is required.");
    else if (targetIds.has(targetRoutineId)) addError(errors, "duplicate_routine_change", `${path}.targetRoutineId`, "Each routine may appear only once in a program proposal.");
    else targetIds.add(targetRoutineId);
    const routineProposal = {
      id: `${cleanText(proposal.id)}:${targetRoutineId || index}`,
      version: ROUTINE_PROPOSAL_VERSION,
      proposalType: ROUTINE_PROPOSAL_TYPES.MODIFY,
      targetProgramId,
      targetRoutineId,
      changes: entry?.changes,
    };
    const routine = getDays(program).find((item) => item.id === targetRoutineId);
    if (routine?.archived || routine?.deleted) addError(errors, "unavailable_target_routine", `${path}.targetRoutineId`, "Archived or deleted routines cannot be changed.");
    const validation = validateRoutineProposal(routineProposal, program);
    copyRoutineErrors(errors, validation.errors, path);
    return { targetRoutineId, changes: validation.normalizedProposal?.changes ?? [] };
  });
  return { targetProgramId, changes };
}

export function validateProgramProposal(proposal, programs) {
  const errors = [];
  const programList = Array.isArray(programs) ? programs : [];
  if (!Array.isArray(programs)) addError(errors, "invalid_programs", "programs", "Programs must be an array.");
  validateHeader(proposal, errors);
  let payload = null;
  if (proposal?.proposalType === PROGRAM_PROPOSAL_TYPES.CREATE) payload = validateCreate(proposal, programList, errors);
  else if (proposal?.proposalType === PROGRAM_PROPOSAL_TYPES.MODIFY) payload = validateModify(proposal, programList, errors);
  const normalizedProposal = proposal && typeof proposal === "object" ? {
    id: cleanText(proposal.id), version: proposal.version, proposalType: proposal.proposalType,
    title: cleanText(proposal.title), summary: cleanText(proposal.summary),
    ...(proposal.proposalType === PROGRAM_PROPOSAL_TYPES.CREATE ? { program: payload } : { targetProgramId: payload?.targetProgramId ?? cleanText(proposal.targetProgramId), routineChanges: payload?.changes ?? [] }),
  } : null;
  return { valid: errors.length === 0, errors, normalizedProposal };
}

function routineCreateProposal(programId, proposalId, routine) {
  return {
    id: `${proposalId}:${routine.id}`, version: ROUTINE_PROPOSAL_VERSION,
    proposalType: ROUTINE_PROPOSAL_TYPES.CREATE, targetProgramId: programId, routine,
  };
}

function routineModifyProposal(programId, proposalId, routineChange) {
  return {
    id: `${proposalId}:${routineChange.targetRoutineId}`, version: ROUTINE_PROPOSAL_VERSION,
    proposalType: ROUTINE_PROPOSAL_TYPES.MODIFY, targetProgramId: programId,
    targetRoutineId: routineChange.targetRoutineId, changes: routineChange.changes,
  };
}

function createReview(normalized) {
  return {
    title: normalized.title,
    summary: normalized.summary,
    program: clone(normalized.program),
    routines: normalized.program.days.map((routine) => ({
      routineId: routine.id, routineName: routine.name, exercises: clone(routine.exercises),
    })),
  };
}

function modifyReview(program, normalized) {
  return {
    title: normalized.title,
    summary: normalized.summary,
    routines: normalized.routineChanges.map((change) => ({
      routineId: change.targetRoutineId,
      routineName: getDays(program).find((routine) => routine.id === change.targetRoutineId)?.name ?? null,
      changes: clone(change.changes),
    })),
  };
}

export function applyProgramProposal(programs, proposal) {
  const validation = validateProgramProposal(proposal, programs);
  if (!validation.valid) return { applied: false, programs: null, programId: null, review: null, errors: validation.errors };
  const normalized = validation.normalizedProposal;
  let nextPrograms = clone(programs);
  if (normalized.proposalType === PROGRAM_PROPOSAL_TYPES.CREATE) {
    let nextProgram = { id: normalized.program.id, name: normalized.program.name, days: [] };
    normalized.program.days.forEach((routine) => {
      const result = applyRoutineProposal(nextProgram, routineCreateProposal(nextProgram.id, normalized.id, routine));
      nextProgram = result.program;
    });
    nextPrograms = [...nextPrograms, nextProgram];
    return { applied: true, programs: nextPrograms, programId: nextProgram.id, review: createReview(normalized), errors: [] };
  }
  const index = nextPrograms.findIndex((program) => program.id === normalized.targetProgramId);
  let nextProgram = nextPrograms[index];
  normalized.routineChanges.forEach((routineChange) => {
    const result = applyRoutineProposal(nextProgram, routineModifyProposal(nextProgram.id, normalized.id, routineChange));
    nextProgram = result.program;
  });
  nextPrograms[index] = nextProgram;
  return { applied: true, programs: nextPrograms, programId: nextProgram.id, review: modifyReview(programs[index], normalized), errors: [] };
}
