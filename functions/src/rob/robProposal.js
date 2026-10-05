import { AiError } from "../ai/aiErrors.js";

const LIMITS = { context: 12000, response: 18000, explanation: 1000, title: 160, summary: 600, changes: 12, exercises: 20, query: 160, name: 160, note: 500, reviewFindings: 8, findingTitle: 160, findingExplanation: 600, reviewRoutineRefs: 6, reviewExerciseRefs: 12 };
const TYPES = new Set(["modify_routine", "create_routine"]);
const OPERATIONS = new Set(["add_exercise", "remove_exercise", "replace_exercise", "move_exercise", "update_exercise", "set_superset", "clear_superset", "rename_routine"]);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const fail = (category, data = {}) => { const error = new AiError("ai_invalid_response", { retryable: true }); error.validationDiagnostic = { category, ...data }; throw error; };
const invalid = (reason) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = { reason }; throw error; };
const hasOnly = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));

function reviewRefs(value, valid, limit) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit || value.some((id) => !text(id, LIMITS.name))) invalid("review_shape");
  return [...new Set(value.map((id) => id.trim()).filter((id) => valid.has(id)))].slice(0, limit);
}
function reviewFinding(value, ids, { priority = false } = {}) {
  const keys = priority ? ["title", "explanation", "priority", "routineIds", "routineExerciseIds"] : ["title", "explanation", "routineIds", "routineExerciseIds"];
  if (!hasOnly(value, keys) || !text(value.title, LIMITS.findingTitle) || !text(value.explanation, LIMITS.findingExplanation) || (priority && !["low", "medium", "high"].includes(value.priority))) invalid("review_shape");
  const references = { routineIds: reviewRefs(value.routineIds, ids.routines, LIMITS.reviewRoutineRefs), routineExerciseIds: reviewRefs(value.routineExerciseIds, ids.exercises, LIMITS.reviewExerciseRefs) };
  return priority ? { title: value.title.trim(), explanation: value.explanation.trim(), priority: value.priority, ...references } : { title: value.title.trim(), explanation: value.explanation.trim(), ...references };
}
function reviewInput(value, context) {
  if (!hasOnly(value, ["summary", "concerns", "suggestedChanges"]) || !text(value.summary, LIMITS.summary) || !Array.isArray(value.concerns) || !Array.isArray(value.suggestedChanges) || value.concerns.length > LIMITS.reviewFindings || value.suggestedChanges.length > LIMITS.reviewFindings) invalid("review_shape");
  const ids = { routines: new Set(context.program.routines.map((routine) => routine.id)), exercises: new Set(context.program.routines.flatMap((routine) => routine.exercises.map((exercise) => exercise.routineExerciseId))) };
  return { summary: value.summary.trim(), concerns: value.concerns.map((finding) => reviewFinding(finding, ids)), suggestedChanges: value.suggestedChanges.map((finding) => reviewFinding(finding, ids, { priority: true })) };
}

export function validateRobProposalRequest(data) {
  if (!object(data) || !object(data.context) || !object(data.request) || Object.keys(data).some((key) => key !== "context" && key !== "request" && key !== "review")) invalid("shape");
  const { context, request, review } = data;
  if (!TYPES.has(request.type) || !text(request.instruction, 600) || context.version !== 1 || !object(context.target) || !object(context.program)) invalid("metadata");
  const expectedContext = request.type === "modify_routine" ? "routine_review" : "program_review";
  if (context.requestType !== expectedContext || context.target.programId !== context.program.id || (request.type === "modify_routine" && (!context.target.routineId || !Array.isArray(context.program.routines) || context.program.routines.length !== 1))) invalid("target");
  const contextLength = JSON.stringify(context).length;
  if (contextLength > LIMITS.context) invalid("context_size");
  if (request.type === "modify_routine" && !object(review)) invalid("review_required");
  return { context, request: { type: request.type, instruction: request.instruction.trim() }, review: request.type === "modify_routine" ? reviewInput(review, context) : null };
}

export function proposalMessages(context, request, review) {
  const example = request.type === "modify_routine"
    ? { version: 1, explanation: "A concise reason.", candidate: { proposalType: "modify_routine", targetProgramId: "program-id", targetRoutineId: "routine-id", title: "Improve order", summary: "A concise change.", changes: [{ type: "update_exercise", targetRoutineExerciseId: "routine-exercise-id", updates: { sets: 3 } }] } }
    : { version: 1, explanation: "A concise reason.", candidate: { proposalType: "create_routine", targetProgramId: "program-id", title: "Complementary routine", summary: "A concise change.", routine: { name: "New routine", exercises: [{ exerciseRef: { query: "cable lateral raise", name: "Cable Lateral Raise" }, sets: 3, repRange: "10-15", restSeconds: 90 }] } } };
  const reviewInstruction = review ? "Convert only the supplied structured review recommendations into candidate operations. Do not introduce unrelated changes that the review does not support." : "Use only the supplied Fitbot context.";
  return [{ role: "system", content: `You are Rob. Return exactly one valid JSON object using double quotes, no comments, no prose, and no markdown. Do not add fields outside the example schema. The requested proposal type is ${request.type}; do not change it. ${reviewInstruction} Existing row IDs must be copied only from context. New exercises must use exerciseRef {"query","name"}; never invent exerciseId, routineExerciseId, routine ID, or proposal ID. Explanation is separate from candidate data. Example: ${JSON.stringify(example)}` }, { role: "user", content: `REQUEST: ${request.instruction}${review ? `\nSTRUCTURED REVIEW FINDINGS:\n${JSON.stringify(review)}` : ""}\nFITBOT CONTEXT:\n${JSON.stringify(context)}` }];
}

function parseJson(textValue) {
  const responseLength = typeof textValue === "string" ? textValue.length : 0;
  if (!responseLength) fail("empty_response", { responseLength });
  if (responseLength > LIMITS.response) fail("output_limit", { responseLength });
  const trimmed = textValue.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try { return { value: JSON.parse(fence ? fence[1] : trimmed), responseLength }; } catch { fail("json_parse", { responseLength }); }
}
function exerciseRef(value, responseLength) {
  if (!object(value) || Object.keys(value).some((key) => key !== "query" && key !== "name") || !text(value.query, LIMITS.query) || !text(value.name, LIMITS.name)) fail("exercise_ref_shape", { responseLength });
  return { query: value.query.trim(), name: value.name.trim() };
}
function candidateExercise(value, responseLength) {
  if (!object(value) || Object.keys(value).some((key) => !["exerciseRef", "sets", "repRange", "restSeconds", "displayNameOverride", "note", "proposalGroupKey"].includes(key))) fail("unexpected_field", { responseLength });
  const ref = exerciseRef(value.exerciseRef, responseLength);
  if (!Number.isInteger(Number(value.sets)) || !text(value.repRange, 20) || (value.restSeconds !== null && !Number.isInteger(Number(value.restSeconds))) || (value.note !== undefined && value.note !== null && !text(value.note, LIMITS.note))) fail("candidate_shape", { responseLength });
  return { ...value, exerciseRef: ref };
}
function candidateChange(change, responseLength) {
  if (!object(change) || !OPERATIONS.has(change.type)) fail("unsupported_operation", { responseLength });
  const schemas = {
    add_exercise: ["type", "afterRoutineExerciseId", "exercise"],
    remove_exercise: ["type", "targetRoutineExerciseId"],
    replace_exercise: ["type", "targetRoutineExerciseId", "exercise"],
    move_exercise: ["type", "targetRoutineExerciseId", "afterRoutineExerciseId"],
    update_exercise: ["type", "targetRoutineExerciseId", "updates"],
    set_superset: ["type", "proposalGroupKey", "memberRoutineExerciseIds"],
    clear_superset: ["type", "targetRoutineExerciseId"],
    rename_routine: ["type", "name"]
  };
  if (!hasOnly(change, schemas[change.type])) fail("unexpected_field", { responseLength });
  if (change.type === "add_exercise") return { type: change.type, afterRoutineExerciseId: change.afterRoutineExerciseId ?? null, exercise: candidateExercise(change.exercise, responseLength) };
  if (change.type === "replace_exercise") return { type: change.type, targetRoutineExerciseId: text(change.targetRoutineExerciseId, LIMITS.name), exercise: candidateExercise(change.exercise, responseLength) };
  if (["remove_exercise", "clear_superset"].includes(change.type)) return { type: change.type, targetRoutineExerciseId: text(change.targetRoutineExerciseId, LIMITS.name) };
  if (change.type === "move_exercise") return { type: change.type, targetRoutineExerciseId: text(change.targetRoutineExerciseId, LIMITS.name), afterRoutineExerciseId: change.afterRoutineExerciseId ?? null };
  if (change.type === "update_exercise") {
    if (!hasOnly(change.updates, ["sets", "repRange", "restSeconds", "displayNameOverride", "note"])) fail("candidate_shape", { responseLength });
    return { type: change.type, targetRoutineExerciseId: text(change.targetRoutineExerciseId, LIMITS.name), updates: change.updates };
  }
  if (change.type === "set_superset") return { type: change.type, proposalGroupKey: text(change.proposalGroupKey, LIMITS.name), memberRoutineExerciseIds: Array.isArray(change.memberRoutineExerciseIds) ? change.memberRoutineExerciseIds.map((id) => text(id, LIMITS.name)) : null };
  return { type: change.type, name: text(change.name, LIMITS.name) };
}
export function parseRobProposal(textValue, request) {
  const { value, responseLength } = parseJson(textValue);
  if (!object(value) || Object.keys(value).some((key) => key !== "version" && key !== "explanation" && key !== "candidate")) fail(!object(value) ? "response_shape" : "unexpected_field", { responseLength });
  if (value.version !== 1 || !text(value.explanation, LIMITS.explanation) || !object(value.candidate)) fail("candidate_shape", { responseLength });
  const candidate = value.candidate;
  if (candidate.proposalType !== request.type) fail("proposal_type", { responseLength });
  if (!text(candidate.title, LIMITS.title) || !text(candidate.summary, LIMITS.summary)) fail("candidate_shape", { responseLength });
  if (request.type === "modify_routine") {
    if (!hasOnly(candidate, ["proposalType", "targetProgramId", "targetRoutineId", "title", "summary", "changes"])) fail("unexpected_field", { responseLength });
    if (!Array.isArray(candidate.changes) || candidate.changes.length > LIMITS.changes) fail("candidate_shape", { responseLength });
    return { explanation: value.explanation.trim(), candidate: { ...candidate, changes: candidate.changes.map((change) => candidateChange(change, responseLength)) } };
  }
  if (!hasOnly(candidate, ["proposalType", "targetProgramId", "title", "summary", "routine"]) || !hasOnly(candidate.routine, ["name", "exercises"])) fail("unexpected_field", { responseLength });
  if (!object(candidate.routine) || !text(candidate.routine.name, LIMITS.name) || !Array.isArray(candidate.routine.exercises) || candidate.routine.exercises.length > LIMITS.exercises) fail("candidate_shape", { responseLength });
  return { explanation: value.explanation.trim(), candidate: { ...candidate, routine: { ...candidate.routine, exercises: candidate.routine.exercises.map((exercise) => candidateExercise(exercise, responseLength)) } } };
}
export async function generateRobProposal(data, { provider }) {
  const { context, request, review } = validateRobProposalRequest(data);
  const result = await provider.generate({ messages: proposalMessages(context, request, review) });
  const parsed = parseRobProposal(result.text, request);
  if (parsed.candidate.targetProgramId !== context.target.programId || (request.type === "modify_routine" && parsed.candidate.targetRoutineId !== context.target.routineId)) fail("candidate_shape", { reviewType: context.requestType, responseLength: typeof result.text === "string" ? result.text.length : 0 });
  return { model: result.model, usage: result.usage, ...parsed };
}
