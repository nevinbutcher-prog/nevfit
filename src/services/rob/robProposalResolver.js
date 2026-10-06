import { searchExercises } from "../exerciseProvider.js";
import { ROUTINE_PROPOSAL_TYPES, validateRoutineProposal } from "../routineProposal.js";
import { RobClientError } from "./robClientError.js";

const normalize = (value) => typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "";
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const routinesFor = (program) => Array.isArray(program?.days) ? program.days : program?.routines ?? [];
async function resolveExercise(ref, search, exerciseNames) { const results = await search(ref.query); const exact = results.filter((exercise) => normalize(exercise.name) === normalize(ref.name)); if (exact.length !== 1 || !/^wger-[A-Za-z0-9._:-]+$/.test(exact[0].id)) throw new RobClientError({ code: "proposal_exercise_unresolved", message: "One or more suggested exercises couldn't be matched to Fitbot's exercise library." }); exerciseNames[exact[0].id] = exact[0].name; return exact[0].id; }
async function materializeExercise(candidate, { search, exerciseNames, includeRowId = true }) { const { exerciseRef, proposalGroupKey, ...untrustedPrescription } = candidate; const prescription = { ...untrustedPrescription }; delete prescription.exerciseId; delete prescription.routineExerciseId; return { ...(includeRowId ? { routineExerciseId: id("ri-rob") } : {}), ...prescription, exerciseId: await resolveExercise(exerciseRef, search, exerciseNames), ...(proposalGroupKey ? { proposalGroupKey } : {}) }; }
export async function resolveRobProposalCandidate({ candidate, currentProgram, searchExercises: search = searchExercises }) {
  const exerciseNames = {};
  const proposal = { id: id("proposal"), version: 1, proposalType: candidate.proposalType, targetProgramId: currentProgram.id, title: candidate.title, summary: candidate.summary };
  if (candidate.proposalType === ROUTINE_PROPOSAL_TYPES.CREATE) proposal.routine = { id: id("routine-rob"), name: candidate.routine.name, exercises: await Promise.all(candidate.routine.exercises.map((exercise) => materializeExercise(exercise, { search, exerciseNames }))) };
  else if (candidate.proposalType === ROUTINE_PROPOSAL_TYPES.MODIFY) { proposal.targetRoutineId = candidate.targetRoutineId; if (!routinesFor(currentProgram).some((item) => item.id === proposal.targetRoutineId)) return { proposal: null, validation: { valid: false, errors: [{ code: "missing_target_routine" }] } }; proposal.changes = []; for (const candidateChange of candidate.changes) { const change = { ...candidateChange }; if (change.type === "add_exercise") change.exercise = await materializeExercise(change.exercise, { search, exerciseNames }); if (change.type === "replace_exercise") change.exercise = await materializeExercise(change.exercise, { search, exerciseNames, includeRowId: false }); proposal.changes.push(change); } }
  else return { proposal: null, validation: { valid: false, errors: [{ code: "unknown_proposal_type" }] } };
  const validation = validateRoutineProposal(proposal, currentProgram);
  return { proposal: validation.valid ? validation.normalizedProposal : null, validation, exerciseNames };
}
