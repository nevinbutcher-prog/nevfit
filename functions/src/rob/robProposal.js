import { AiError } from "../ai/aiErrors.js";

const LIMITS = { context: 12000, response: 18000, explanation: 1000, title: 160, summary: 600, changes: 12, exercises: 20, query: 160, name: 160, note: 500 };
const TYPES = new Set(["modify_routine", "create_routine"]);
const OPERATIONS = new Set(["add_exercise", "remove_exercise", "replace_exercise", "move_exercise", "update_exercise", "set_superset", "clear_superset", "rename_routine"]);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const fail = (category, data = {}) => { const error = new AiError("ai_invalid_response", { retryable: true }); error.validationDiagnostic = { category, ...data }; throw error; };
const invalid = (reason) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = { reason }; throw error; };

export function validateRobProposalRequest(data) {
  if (!object(data) || !object(data.context) || !object(data.request) || Object.keys(data).some((key) => key !== "context" && key !== "request")) invalid("shape");
  const { context, request } = data;
  if (!TYPES.has(request.type) || !text(request.instruction, 600) || context.version !== 1 || !object(context.target) || !object(context.program)) invalid("metadata");
  const expectedContext = request.type === "modify_routine" ? "routine_review" : "program_review";
  if (context.requestType !== expectedContext || context.target.programId !== context.program.id || (request.type === "modify_routine" && (!context.target.routineId || context.program.routines?.length !== 1))) invalid("target");
  const contextLength = JSON.stringify(context).length;
  if (contextLength > LIMITS.context) invalid("context_size");
  return { context, request: { type: request.type, instruction: request.instruction.trim() } };
}

export function proposalMessages(context, request) {
  const example = request.type === "modify_routine"
    ? { version: 1, explanation: "A concise reason.", candidate: { proposalType: "modify_routine", targetProgramId: "program-id", targetRoutineId: "routine-id", title: "Improve order", summary: "A concise change.", changes: [{ type: "update_exercise", targetRoutineExerciseId: "routine-exercise-id", updates: { sets: 3 } }] } }
    : { version: 1, explanation: "A concise reason.", candidate: { proposalType: "create_routine", targetProgramId: "program-id", title: "Complementary routine", summary: "A concise change.", routine: { name: "New routine", exercises: [{ exerciseRef: { query: "cable lateral raise", name: "Cable Lateral Raise" }, sets: 3, repRange: "10-15", restSeconds: 90 }] } } };
  return [{ role: "system", content: `You are Rob. Return exactly one valid JSON object using double quotes, no comments, no prose, and no markdown. Do not add fields outside the example schema. The requested proposal type is ${request.type}; do not change it. Existing row IDs must be copied only from context. New exercises must use exerciseRef {"query","name"}; never invent exerciseId, routineExerciseId, routine ID, or proposal ID. Example: ${JSON.stringify(example)}` }, { role: "user", content: `REQUEST: ${request.instruction}\nFITBOT CONTEXT:\n${JSON.stringify(context)}` }];
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
  if (change.type === "add_exercise" || change.type === "replace_exercise") return { ...change, exercise: candidateExercise(change.exercise, responseLength) };
  if (change.type === "update_exercise" && (!object(change.updates) || Object.keys(change.updates).some((key) => !["sets", "repRange", "restSeconds", "displayNameOverride", "note"].includes(key)))) fail("candidate_shape", { responseLength });
  return change;
}
export function parseRobProposal(textValue, request) {
  const { value, responseLength } = parseJson(textValue);
  if (!object(value) || Object.keys(value).some((key) => key !== "version" && key !== "explanation" && key !== "candidate")) fail(!object(value) ? "response_shape" : "unexpected_field", { responseLength });
  if (value.version !== 1 || !text(value.explanation, LIMITS.explanation) || !object(value.candidate)) fail("candidate_shape", { responseLength });
  const candidate = value.candidate;
  if (candidate.proposalType !== request.type) fail("proposal_type", { responseLength });
  if (!text(candidate.title, LIMITS.title) || !text(candidate.summary, LIMITS.summary)) fail("candidate_shape", { responseLength });
  if (request.type === "modify_routine") {
    if (!Array.isArray(candidate.changes) || candidate.changes.length > LIMITS.changes) fail("candidate_shape", { responseLength });
    return { explanation: value.explanation.trim(), candidate: { ...candidate, changes: candidate.changes.map((change) => candidateChange(change, responseLength)) } };
  }
  if (!object(candidate.routine) || !text(candidate.routine.name, LIMITS.name) || !Array.isArray(candidate.routine.exercises) || candidate.routine.exercises.length > LIMITS.exercises) fail("candidate_shape", { responseLength });
  return { explanation: value.explanation.trim(), candidate: { ...candidate, routine: { ...candidate.routine, exercises: candidate.routine.exercises.map((exercise) => candidateExercise(exercise, responseLength)) } } };
}
export async function generateRobProposal(data, { provider }) {
  const { context, request } = validateRobProposalRequest(data);
  const result = await provider.generate({ messages: proposalMessages(context, request) });
  const parsed = parseRobProposal(result.text, request);
  if (parsed.candidate.targetProgramId !== context.target.programId || (request.type === "modify_routine" && parsed.candidate.targetRoutineId !== context.target.routineId)) fail("candidate_shape", { reviewType: context.requestType, responseLength: typeof result.text === "string" ? result.text.length : 0 });
  return { model: result.model, usage: result.usage, ...parsed };
}
