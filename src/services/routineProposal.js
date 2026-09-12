export const ROUTINE_PROPOSAL_VERSION = 1;

export const ROUTINE_PROPOSAL_TYPES = Object.freeze({
  CREATE: "create_routine",
  MODIFY: "modify_routine",
});

export const ROUTINE_PROPOSAL_OPERATIONS = Object.freeze([
  "add_exercise", "remove_exercise", "replace_exercise", "move_exercise",
  "update_exercise", "set_superset", "clear_superset", "rename_routine",
]);

const operationTypes = new Set(ROUTINE_PROPOSAL_OPERATIONS);
const identityPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const exerciseIdPattern = /^[a-z][a-z0-9_-]*-[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const cleanText = (value) => typeof value === "string" ? value.trim() : "";
const validIdentity = (value) => typeof value === "string" && identityPattern.test(value.trim());
const validExerciseId = (value) => typeof value === "string" && exerciseIdPattern.test(value.trim());

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function normalizeRepRange(value) {
  const match = typeof value === "string"
    ? value.trim().match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/)
    : null;
  if (!match) return null;
  const minimum = Number(match[1]);
  const maximum = Number(match[2] ?? match[1]);
  if (minimum < 1 || maximum > 100 || minimum > maximum) return null;
  return minimum === maximum ? `${minimum}` : `${minimum}-${maximum}`;
}

function normalizeOptionalText(value) {
  if (value === null || value === "" || typeof value === "undefined") return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validatePrescription(value, path, errors, requireIdentity = true) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(errors, "invalid_exercise", path, "Exercise configuration must be an object.");
    return null;
  }
  const routineExerciseId = cleanText(value.routineExerciseId);
  const exerciseId = cleanText(value.exerciseId);
  const sets = Number(value.sets);
  const repRange = normalizeRepRange(value.repRange);
  const restSeconds = value.restSeconds === null ? null : Number(value.restSeconds);
  const displayNameOverride = normalizeOptionalText(value.displayNameOverride);
  const note = normalizeOptionalText(value.note);

  if (requireIdentity && !validIdentity(routineExerciseId)) addError(errors, "invalid_routine_exercise_id", `${path}.routineExerciseId`, "A stable routine exercise ID is required.");
  if (!validExerciseId(exerciseId)) addError(errors, "invalid_exercise_id", `${path}.exerciseId`, "Exercise ID must be a stable provider-backed ID.");
  if (!Number.isInteger(sets) || sets < 1 || sets > 12) addError(errors, "invalid_sets", `${path}.sets`, "Sets must be an integer from 1 to 12.");
  if (!repRange) addError(errors, "invalid_rep_range", `${path}.repRange`, "Rep range must be a value such as 8 or 8-12.");
  if (restSeconds !== null && (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600)) addError(errors, "invalid_rest_seconds", `${path}.restSeconds`, "Rest must be null or an integer from 0 to 600 seconds.");
  if (displayNameOverride === undefined) addError(errors, "invalid_display_name", `${path}.displayNameOverride`, "Display name must be text, null, or omitted.");
  if (note === undefined) addError(errors, "invalid_note", `${path}.note`, "Note must be text, null, or omitted.");

  return {
    ...(requireIdentity ? { routineExerciseId } : {}), exerciseId, sets,
    repRange: repRange ?? cleanText(value.repRange), restSeconds,
    ...(displayNameOverride ? { displayNameOverride } : {}),
    ...(note ? { note } : {}), supersetGroupId: null,
  };
}

function getRoutines(program) {
  if (!program || typeof program !== "object") return [];
  return Array.isArray(program.days) ? program.days : Array.isArray(program.routines) ? program.routines : [];
}

function cleanOrphanedGroups(exercises) {
  const counts = exercises.reduce((result, exercise) => {
    if (exercise.supersetGroupId) result.set(exercise.supersetGroupId, (result.get(exercise.supersetGroupId) ?? 0) + 1);
    return result;
  }, new Map());
  return exercises.map((exercise) => exercise.supersetGroupId && (counts.get(exercise.supersetGroupId) ?? 0) < 2
    ? { ...exercise, supersetGroupId: null }
    : exercise);
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createGroupId(proposal, routineId, groupKey, usedIds) {
  const base = `ss-proposal-${stableHash(`${proposal.id ?? "proposal"}:${routineId}:${groupKey}`)}`;
  let result = base;
  let suffix = 2;
  while (usedIds.has(result)) result = `${base}-${suffix++}`;
  usedIds.add(result);
  return result;
}

function validateHeader(proposal, program, errors) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    addError(errors, "invalid_proposal", "proposal", "Proposal must be an object.");
    return;
  }
  if (proposal.version !== ROUTINE_PROPOSAL_VERSION) addError(errors, "unsupported_version", "version", `Only proposal version ${ROUTINE_PROPOSAL_VERSION} is supported.`);
  if (!Object.values(ROUTINE_PROPOSAL_TYPES).includes(proposal.proposalType)) addError(errors, "unknown_proposal_type", "proposalType", "Proposal type must be create_routine or modify_routine.");
  if (proposal.id !== undefined && proposal.id !== null && !validIdentity(proposal.id)) addError(errors, "invalid_proposal_id", "id", "Proposal ID must be a stable text identifier.");
  ["title", "summary"].forEach((field) => {
    if (proposal[field] !== undefined && proposal[field] !== null && typeof proposal[field] !== "string") addError(errors, `invalid_${field}`, field, `${field} must be text when supplied.`);
  });
  if (!validIdentity(proposal.targetProgramId)) addError(errors, "missing_target_program", "targetProgramId", "A valid target program ID is required.");
  else if (!program || proposal.targetProgramId !== program.id) addError(errors, "unexpected_target_program", "targetProgramId", "Proposal does not target the supplied program.");
}

function validateCreate(proposal, program, errors) {
  const routine = proposal.routine;
  if (!routine || typeof routine !== "object" || Array.isArray(routine)) {
    addError(errors, "invalid_routine", "routine", "Create proposals require a routine definition.");
    return null;
  }
  const id = cleanText(routine.id);
  const name = cleanText(routine.name);
  if (!validIdentity(id)) addError(errors, "invalid_routine_id", "routine.id", "A stable routine ID is required.");
  else if (getRoutines(program).some((item) => item.id === id)) addError(errors, "duplicate_routine_id", "routine.id", "A routine with this ID already exists.");
  if (!name) addError(errors, "invalid_routine_name", "routine.name", "Routine name is required.");
  if (!Array.isArray(routine.exercises)) {
    addError(errors, "invalid_exercises", "routine.exercises", "Routine exercises must be an ordered array.");
    return null;
  }

  const seenIds = new Set();
  const groups = new Map();
  const exercises = routine.exercises.map((exercise, index) => {
    const path = `routine.exercises[${index}]`;
    const normalized = validatePrescription(exercise, path, errors);
    if (normalized && seenIds.has(normalized.routineExerciseId)) addError(errors, "duplicate_routine_exercise_id", `${path}.routineExerciseId`, "Routine exercise IDs must be unique within a routine.");
    if (normalized) seenIds.add(normalized.routineExerciseId);
    const groupKey = normalizeOptionalText(exercise?.proposalGroupKey);
    if (groupKey === undefined || (groupKey && !validIdentity(groupKey))) addError(errors, "invalid_proposal_group", `${path}.proposalGroupKey`, "Proposal group key must be a stable text identifier.");
    else if (groupKey) groups.set(groupKey, [...(groups.get(groupKey) ?? []), index]);
    return normalized ? { ...normalized, proposalGroupKey: groupKey || null } : null;
  });
  groups.forEach((members, key) => {
    if (members.length < 2) addError(errors, "invalid_superset_group", "routine.exercises", `Proposal group ${key} must contain at least two exercises.`);
  });
  return { id, name, archived: false, exercises };
}

function validateModify(proposal, program, errors) {
  const targetRoutineId = cleanText(proposal.targetRoutineId);
  if (!validIdentity(targetRoutineId)) {
    addError(errors, "missing_target_routine", "targetRoutineId", "A valid target routine ID is required.");
    return null;
  }
  const routine = getRoutines(program).find((item) => item.id === targetRoutineId);
  if (!routine) {
    addError(errors, "missing_target_routine", "targetRoutineId", "Target routine does not exist in the supplied program.");
    return null;
  }
  if (!Array.isArray(proposal.changes)) {
    addError(errors, "invalid_changes", "changes", "Modification changes must be an ordered array.");
    return null;
  }

  const availableIds = new Set();
  routine.exercises.forEach((exercise, index) => {
    if (!validIdentity(exercise.routineExerciseId)) addError(errors, "missing_routine_exercise_identity", `context.routine.exercises[${index}]`, "Routine exercises must have stable IDs before proposal use.");
    else if (availableIds.has(exercise.routineExerciseId)) addError(errors, "duplicate_routine_exercise_id", `context.routine.exercises[${index}]`, "Routine exercise IDs must be unique within a routine.");
    else availableIds.add(exercise.routineExerciseId);
  });

  const removedIds = new Set();
  const mutationTargets = new Set();
  const moveTargets = new Set();
  const groupTargets = new Set();
  const proposalGroupKeys = new Set();
  let hasRename = false;
  const changes = proposal.changes.map((change, index) => {
    const path = `changes[${index}]`;
    if (!change || typeof change !== "object" || Array.isArray(change) || !operationTypes.has(change.type)) {
      addError(errors, "invalid_operation", `${path}.type`, `Unsupported operation: ${String(change?.type)}.`);
      return null;
    }
    const result = { type: change.type };
    if (change.type === "rename_routine") {
      result.name = cleanText(change.name);
      if (!result.name) addError(errors, "invalid_routine_name", `${path}.name`, "Routine name is required.");
      if (hasRename) addError(errors, "conflicting_operation", path, "A proposal can rename a routine only once.");
      hasRename = true;
      return result;
    }
    if (change.type === "add_exercise") {
      result.exercise = validatePrescription(change.exercise, `${path}.exercise`, errors);
      result.afterRoutineExerciseId = change.afterRoutineExerciseId === null ? null : cleanText(change.afterRoutineExerciseId);
      const newId = result.exercise?.routineExerciseId;
      if (newId && availableIds.has(newId)) addError(errors, "duplicate_routine_exercise_id", `${path}.exercise.routineExerciseId`, "Added routine exercise ID already exists.");
      if (newId) availableIds.add(newId);
      if (result.afterRoutineExerciseId === newId) addError(errors, "invalid_reorder_target", `${path}.afterRoutineExerciseId`, "An exercise cannot be inserted after itself.");
      if (result.afterRoutineExerciseId !== null && !availableIds.has(result.afterRoutineExerciseId)) addError(errors, "invalid_reorder_target", `${path}.afterRoutineExerciseId`, "Insertion anchor does not exist.");
      return result;
    }
    if (change.type === "set_superset") {
      result.proposalGroupKey = cleanText(change.proposalGroupKey);
      result.memberRoutineExerciseIds = Array.isArray(change.memberRoutineExerciseIds) ? change.memberRoutineExerciseIds.map(cleanText) : [];
      if (!validIdentity(result.proposalGroupKey)) addError(errors, "invalid_proposal_group", `${path}.proposalGroupKey`, "A stable proposal group key is required.");
      else if (proposalGroupKeys.has(result.proposalGroupKey)) addError(errors, "conflicting_operation", `${path}.proposalGroupKey`, "Each proposal group key may be assigned only once.");
      else proposalGroupKeys.add(result.proposalGroupKey);
      if (result.memberRoutineExerciseIds.length < 2 || new Set(result.memberRoutineExerciseIds).size !== result.memberRoutineExerciseIds.length) addError(errors, "invalid_superset_group", `${path}.memberRoutineExerciseIds`, "A superset requires at least two distinct members.");
      result.memberRoutineExerciseIds.forEach((id) => {
        if (!availableIds.has(id) || removedIds.has(id)) addError(errors, "missing_target_exercise", `${path}.memberRoutineExerciseIds`, `Routine exercise ${id} does not exist.`);
        if (groupTargets.has(id)) addError(errors, "conflicting_operation", path, `Routine exercise ${id} has multiple grouping operations.`);
        groupTargets.add(id);
      });
      return result;
    }

    result.targetRoutineExerciseId = cleanText(change.targetRoutineExerciseId);
    const targetId = result.targetRoutineExerciseId;
    if (!validIdentity(targetId) || !availableIds.has(targetId) || removedIds.has(targetId)) addError(errors, "missing_target_exercise", `${path}.targetRoutineExerciseId`, "Target routine exercise does not exist.");
    if (change.type === "clear_superset") {
      if (groupTargets.has(targetId)) addError(errors, "conflicting_operation", path, "Routine exercise has multiple grouping operations.");
      groupTargets.add(targetId);
      return result;
    }
    if (change.type === "move_exercise") {
      if (moveTargets.has(targetId)) addError(errors, "conflicting_operation", path, "Routine exercise has multiple move operations.");
      moveTargets.add(targetId);
    } else {
      if (mutationTargets.has(targetId) || (change.type === "remove_exercise" && (moveTargets.has(targetId) || groupTargets.has(targetId)))) {
        addError(errors, "conflicting_operation", path, "Routine exercise has multiple conflicting operations.");
      }
      mutationTargets.add(targetId);
    }
    if (change.type === "remove_exercise") removedIds.add(targetId);
    else if (change.type === "replace_exercise") result.exercise = validatePrescription(change.exercise, `${path}.exercise`, errors, false);
    else if (change.type === "move_exercise") {
      result.afterRoutineExerciseId = change.afterRoutineExerciseId === null ? null : cleanText(change.afterRoutineExerciseId);
      if (result.afterRoutineExerciseId === targetId) addError(errors, "invalid_reorder_target", `${path}.afterRoutineExerciseId`, "An exercise cannot be moved after itself.");
      else if (result.afterRoutineExerciseId !== null && (!availableIds.has(result.afterRoutineExerciseId) || removedIds.has(result.afterRoutineExerciseId))) addError(errors, "invalid_reorder_target", `${path}.afterRoutineExerciseId`, "Move anchor does not exist.");
    } else if (change.type === "update_exercise") {
      result.updates = validateUpdates(change.updates, `${path}.updates`, errors);
    }
    return result;
  });
  return { routine, changes };
}

function validateUpdates(updates, path, errors) {
  const result = {};
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    addError(errors, "invalid_updates", path, "Updates must be an object.");
    return result;
  }
  const allowed = new Set(["sets", "repRange", "restSeconds", "displayNameOverride", "note"]);
  Object.keys(updates).forEach((key) => {
    if (!allowed.has(key)) addError(errors, "invalid_update_field", `${path}.${key}`, `Field ${key} cannot be updated.`);
  });
  if ("sets" in updates) {
    const value = Number(updates.sets);
    if (!Number.isInteger(value) || value < 1 || value > 12) addError(errors, "invalid_sets", `${path}.sets`, "Sets must be an integer from 1 to 12.");
    else result.sets = value;
  }
  if ("repRange" in updates) {
    const value = normalizeRepRange(updates.repRange);
    if (!value) addError(errors, "invalid_rep_range", `${path}.repRange`, "Rep range must be a value such as 8 or 8-12.");
    else result.repRange = value;
  }
  if ("restSeconds" in updates) {
    const value = updates.restSeconds === null ? null : Number(updates.restSeconds);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 600)) addError(errors, "invalid_rest_seconds", `${path}.restSeconds`, "Rest must be null or an integer from 0 to 600 seconds.");
    else result.restSeconds = value;
  }
  ["displayNameOverride", "note"].forEach((field) => {
    if (field in updates) {
      const value = normalizeOptionalText(updates[field]);
      if (value === undefined) addError(errors, `invalid_${field}`, `${path}.${field}`, `${field} must be text or null.`);
      else result[field] = value;
    }
  });
  if (Object.keys(result).length === 0) addError(errors, "empty_update", path, "At least one supported field must change.");
  return result;
}

export function validateRoutineProposal(proposal, currentProgram) {
  const errors = [];
  validateHeader(proposal, currentProgram, errors);
  let payload = null;
  if (proposal?.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE) payload = validateCreate(proposal, currentProgram, errors);
  else if (proposal?.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY) payload = validateModify(proposal, currentProgram, errors);

  const normalizedProposal = proposal && typeof proposal === "object" ? {
    id: cleanText(proposal.id) || null,
    version: proposal.version,
    proposalType: proposal.proposalType,
    targetProgramId: cleanText(proposal.targetProgramId),
    ...(proposal.targetRoutineId ? { targetRoutineId: cleanText(proposal.targetRoutineId) } : {}),
    ...(cleanText(proposal.title) ? { title: cleanText(proposal.title) } : {}),
    ...(cleanText(proposal.summary) ? { summary: cleanText(proposal.summary) } : {}),
    ...(proposal.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE ? { routine: payload } : { changes: payload?.changes ?? [] }),
  } : null;
  return { valid: errors.length === 0, errors, normalizedProposal };
}

function usedGroupIds(program) {
  return new Set(program.days.flatMap((day) => day.exercises.map((exercise) => exercise.supersetGroupId).filter(Boolean)));
}

function applyCreate(program, proposal) {
  const routine = clone(proposal.routine);
  const usedIds = usedGroupIds(program);
  const groupIds = new Map();
  routine.exercises = routine.exercises.map(({ proposalGroupKey, ...exercise }) => {
    if (!proposalGroupKey) return exercise;
    if (!groupIds.has(proposalGroupKey)) groupIds.set(proposalGroupKey, createGroupId(proposal, routine.id, proposalGroupKey, usedIds));
    return { ...exercise, supersetGroupId: groupIds.get(proposalGroupKey) };
  });
  program.days.push(routine);
  return routine.id;
}

function applyModify(program, proposal) {
  const routine = program.days.find((day) => day.id === proposal.targetRoutineId);
  const usedIds = usedGroupIds(program);
  proposal.changes.forEach((change) => {
    const targetIndex = routine.exercises.findIndex((exercise) => exercise.routineExerciseId === change.targetRoutineExerciseId);
    if (change.type === "rename_routine") routine.name = change.name;
    else if (change.type === "add_exercise") {
      const anchor = change.afterRoutineExerciseId === null ? -1 : routine.exercises.findIndex((exercise) => exercise.routineExerciseId === change.afterRoutineExerciseId);
      routine.exercises.splice(anchor + 1, 0, change.exercise);
    } else if (change.type === "remove_exercise") routine.exercises.splice(targetIndex, 1);
    else if (change.type === "replace_exercise") routine.exercises[targetIndex] = { ...change.exercise, routineExerciseId: change.targetRoutineExerciseId, supersetGroupId: routine.exercises[targetIndex].supersetGroupId ?? null };
    else if (change.type === "update_exercise") {
      const next = { ...routine.exercises[targetIndex] };
      Object.entries(change.updates).forEach(([key, value]) => {
        if (value === null && (key === "displayNameOverride" || key === "note")) delete next[key];
        else next[key] = value;
      });
      routine.exercises[targetIndex] = next;
    } else if (change.type === "move_exercise") {
      const [moved] = routine.exercises.splice(targetIndex, 1);
      const anchor = change.afterRoutineExerciseId === null ? -1 : routine.exercises.findIndex((exercise) => exercise.routineExerciseId === change.afterRoutineExerciseId);
      routine.exercises.splice(anchor + 1, 0, moved);
    } else if (change.type === "clear_superset") {
      const groupId = routine.exercises[targetIndex].supersetGroupId;
      routine.exercises = routine.exercises.map((exercise) => groupId && exercise.supersetGroupId === groupId ? { ...exercise, supersetGroupId: null } : exercise);
    } else if (change.type === "set_superset") {
      const members = new Set(change.memberRoutineExerciseIds);
      const groupId = createGroupId(proposal, routine.id, change.proposalGroupKey, usedIds);
      routine.exercises = routine.exercises.map((exercise) => members.has(exercise.routineExerciseId) ? { ...exercise, supersetGroupId: groupId } : exercise);
    }
    routine.exercises = cleanOrphanedGroups(routine.exercises);
  });
  return routine.id;
}

export function applyRoutineProposal(currentProgram, proposal) {
  const validation = validateRoutineProposal(proposal, currentProgram);
  if (!validation.valid) return { applied: false, errors: validation.errors, program: null, review: null };
  const program = clone(currentProgram);
  if (!Array.isArray(program.days) && Array.isArray(program.routines)) program.days = clone(program.routines);
  const normalized = validation.normalizedProposal;
  const routineId = normalized.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE ? applyCreate(program, normalized) : applyModify(program, normalized);
  return {
    applied: true, errors: [], program, routineId,
    review: {
      title: normalized.title ?? null,
      summary: normalized.summary ?? null,
      changes: clone(normalized.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE ? normalized.routine.exercises : normalized.changes),
    },
  };
}
