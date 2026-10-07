import { searchExercises } from "../exerciseProvider.js";
import { resolveProposedExercise } from "../exerciseResolution.js";
import { ROUTINE_PROPOSAL_TYPES, validateRoutineProposal } from "../routineProposal.js";
import { RobClientError } from "./robClientError.js";

const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const routinesFor = (program) => Array.isArray(program?.days) ? program.days : program?.routines ?? [];
async function resolveExercise(ref, key, search, exerciseNames, selections, pending) {
  const result = await resolveProposedExercise({ requestedName: ref?.name, query: ref?.query, exerciseProvider: search });
  if (result.status === "resolved") { exerciseNames[result.exercise.id] = result.exercise.name; return result.exercise.id; }
  const selected = result.status === "ambiguous" ? result.candidates.find((exercise) => exercise.id === selections?.[key]) : null;
  if (selected) { exerciseNames[selected.id] = selected.name; return selected.id; }
  if (result.status === "ambiguous") { pending.push({ key, requestedName: ref?.name ?? "Suggested exercise", candidates: result.candidates }); return null; }
  throw new RobClientError({ code: "proposal_exercise_unresolved", message: "One or more suggested exercises couldn't be matched to Fitbot's exercise library." });
}
async function materializeExercise(candidate, { key, search, exerciseNames, selections, pending, includeRowId = true }) { const { exerciseRef, proposalGroupKey, ...untrustedPrescription } = candidate; const prescription = { ...untrustedPrescription }; delete prescription.exerciseId; delete prescription.routineExerciseId; const exerciseId = await resolveExercise(exerciseRef, key, search, exerciseNames, selections, pending); return { ...(includeRowId ? { routineExerciseId: id("ri-rob") } : {}), ...prescription, ...(exerciseId ? { exerciseId } : {}), ...(proposalGroupKey ? { proposalGroupKey } : {}) }; }
export async function resolveRobProposalCandidate({ candidate, currentProgram, resolutionSelections = {}, searchExercises: search = searchExercises }) {
  const exerciseNames = {};
  const pending = [];
  const proposal = { id: id("proposal"), version: 1, proposalType: candidate.proposalType, targetProgramId: currentProgram.id, title: candidate.title, summary: candidate.summary };
  if (candidate.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE) proposal.routine = { id: id("routine-rob"), name: candidate.routine.name, exercises: await Promise.all(candidate.routine.exercises.map((exercise, index) => materializeExercise(exercise, { key: `routine.exercises.${index}`, search, exerciseNames, selections: resolutionSelections, pending }))) };
  else if (candidate.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY) { proposal.targetRoutineId = candidate.targetRoutineId; if (!routinesFor(currentProgram).some((item) => item.id === proposal.targetRoutineId)) return { proposal: null, validation: { valid: false, errors: [{ code: "missing_target_routine" }] } }; proposal.changes = []; for (const [index, candidateChange] of candidate.changes.entries()) { const change = { ...candidateChange }; if (change.type === "add_exercise") change.exercise = await materializeExercise(change.exercise, { key: `changes.${index}.exercise`, search, exerciseNames, selections: resolutionSelections, pending }); if (change.type === "replace_exercise") change.exercise = await materializeExercise(change.exercise, { key: `changes.${index}.exercise`, search, exerciseNames, selections: resolutionSelections, pending, includeRowId: false }); proposal.changes.push(change); } }
  else return { proposal: null, validation: { valid: false, errors: [{ code: "unknown_proposal_type" }] } };
  if (pending.length) return { status: "needs_resolution", proposal: null, validation: null, exerciseNames, pending };
  const validation = validateRoutineProposal(proposal, currentProgram);
  return { proposal: validation.valid ? validation.normalizedProposal : null, validation, exerciseNames };
}
