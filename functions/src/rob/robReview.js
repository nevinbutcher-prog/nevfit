import { AiError } from "../ai/aiErrors.js";

export const ROB_REVIEW_CONTEXT_MAX_CHARS = 12000;
const LIMITS = { context: ROB_REVIEW_CONTEXT_MAX_CHARS, prompt: 13000, response: 16000, summary: 600, items: 4, changes: 5, title: 120, explanation: 500, limitations: 4, limitation: 300, routines: 6, exercises: 12 };
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const invalid = (diagnostic) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = diagnostic; throw error; };
const responseError = (category, diagnostic = {}) => {
  const error = new AiError("ai_invalid_response", { retryable: true });
  error.validationDiagnostic = { category, ...diagnostic };
  return error;
};

export function validateReviewContext(data) {
  const diagnostic = { requestObject: object(data), contextObject: object(data?.context), contextLength: null, contextVersion: data?.context?.version ?? null, requestType: data?.context?.requestType ?? null };
  if (!diagnostic.requestObject || Object.keys(data).some((key) => key !== "context") || !diagnostic.contextObject) invalid({ ...diagnostic, reason: "shape" });
  const context = data.context;
  const type = context.requestType;
  if (context.version !== 1 || !["routine_review", "program_review"].includes(type) || !object(context.target) || !text(context.target.programId, 200)) invalid({ ...diagnostic, reason: "metadata" });
  if ((type === "routine_review" && (context.target.scope !== "routine" || !text(context.target.routineId, 200) || !Array.isArray(context.program?.routines) || context.program.routines.length !== 1)) || (type === "program_review" && (context.target.scope !== "program" || context.target.routineId !== null || !Array.isArray(context.program?.routines)))) invalid({ ...diagnostic, reason: "target" });
  const serialized = JSON.stringify(context);
  diagnostic.contextLength = serialized.length;
  if (serialized.length > LIMITS.context) invalid({ ...diagnostic, reason: "context_size" });
  return context;
}

export function reviewMessages(context) {
  const messages = [{ role: "system", content: `You are Rob, Fitbot's practical strength coach. Assess only supplied context. Do not diagnose, infer recovery/pain/sleep/readiness, claim clinical safety, or propose executable changes. Return exactly one valid JSON object: use double quotes only, no comments, no prose before or after, no Markdown fence, and no fields outside this schema. Arrays may be empty. Echo the target IDs exactly from the supplied context. Example shape (use facts from the supplied context, not these example values):
{"version":1,"reviewType":"routine","target":{"programId":"program-123","routineId":"routine-456"},"summary":"A concise assessment.","strengths":[{"title":"Clear exercise order","explanation":"The supplied sequence is easy to follow.","routineIds":["routine-456"],"routineExerciseIds":["routine-exercise-789"]}],"concerns":[],"suggestedChanges":[{"title":"Consider rest timing","explanation":"A small change may improve session flow.","priority":"medium","routineIds":[],"routineExerciseIds":[]}],"limitations":["Recovery information is not supplied."]}
For program reviews, set "reviewType" to "program" and "target.routineId" to null. Suggested-change priority must be "low", "medium", or "high". Keep concise.` }, { role: "user", content: `FITBOT REVIEW CONTEXT:\n${JSON.stringify(context)}` }];
  if (messages.reduce((length, message) => length + message.content.length, 0) > LIMITS.prompt) invalid({ reason: "prompt_size", contextLength: JSON.stringify(context).length, contextVersion: context.version, requestType: context.requestType });
  return messages;
}

function parseJson(textValue) {
  const responseLength = typeof textValue === "string" ? textValue.length : 0;
  if (typeof textValue !== "string" || !textValue.trim()) throw responseError("empty_response", { responseLength });
  if (responseLength > LIMITS.response) throw responseError("output_limit", { responseLength });
  const trimmed = textValue.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const json = fenced ? fenced[1] : trimmed;
  try { return { value: JSON.parse(json), responseLength }; } catch { throw responseError("json_parse", { responseLength }); }
}
function refs(values, valid, limit) { return Array.isArray(values) ? values.filter((value) => typeof value === "string" && valid.has(value)).slice(0, limit) : []; }
function finding(value, ids, section, responseLength) {
  if (!object(value)) throw responseError(`${section}_shape`, { responseLength });
  if (Object.keys(value).some((key) => !["title", "explanation", "priority", "routineIds", "routineExerciseIds"].includes(key))) throw responseError("unexpected_field", { responseLength });
  if (!text(value.title, LIMITS.title) || !text(value.explanation, LIMITS.explanation)) throw responseError(typeof value.title === "string" && value.title.length > LIMITS.title || typeof value.explanation === "string" && value.explanation.length > LIMITS.explanation ? "output_limit" : `${section}_shape`, { responseLength });
  if (value.priority && !["low", "medium", "high"].includes(value.priority)) throw responseError("invalid_priority", { responseLength });
  return { title: value.title.trim(), explanation: value.explanation.trim(), routineIds: refs(value.routineIds, ids.routines, LIMITS.routines), routineExerciseIds: refs(value.routineExerciseIds, ids.exercises, LIMITS.exercises), ...(value.priority ? { priority: value.priority } : {}) };
}
export function parseReview(textValue, context) {
  const { value, responseLength } = parseJson(textValue);
  const reviewType = context.requestType === "routine_review" ? "routine" : "program";
  const counts = Object.fromEntries(["strengths", "concerns", "suggestedChanges", "limitations"].map((name) => [name, Array.isArray(value?.[name]) ? value[name].length : null]));
  const diagnostic = { reviewType, responseLength, counts };
  if (!object(value) || Array.isArray(value)) throw responseError("response_shape", diagnostic);
  if (Object.keys(value).some((key) => !["version", "reviewType", "target", "summary", "strengths", "concerns", "suggestedChanges", "limitations"].includes(key))) throw responseError("unexpected_field", diagnostic);
  if (value.version !== 1) throw responseError("version", diagnostic);
  if (value.reviewType !== reviewType) throw responseError("review_type", diagnostic);
  if (!object(value.target) || value.target.programId !== context.target.programId || value.target.routineId !== context.target.routineId) throw responseError("target", diagnostic);
  if (!text(value.summary, LIMITS.summary)) throw responseError(typeof value.summary === "string" && value.summary.length > LIMITS.summary ? "output_limit" : "summary", diagnostic);
  const ids = { routines: new Set(context.program.routines.map((routine) => routine.id)), exercises: new Set(context.program.routines.flatMap((routine) => routine.exercises.map((exercise) => exercise.routineExerciseId))) };
  const list = (name, max, changes = false) => {
    const items = typeof value[name] === "undefined" ? [] : value[name];
    if (!Array.isArray(items)) throw responseError(`${name === "suggestedChanges" ? "suggested_changes" : name}_shape`, diagnostic);
    if (items.length > max) throw responseError("output_limit", diagnostic);
    return items.map((item) => {
      const parsed = finding(changes ? item : { ...item, priority: undefined }, ids, name === "suggestedChanges" ? "suggested_changes" : name, responseLength);
      return changes ? { ...parsed, priority: parsed.priority ?? "medium" } : parsed;
    });
  };
  const limitations = typeof value.limitations === "undefined" ? [] : value.limitations;
  if (!Array.isArray(limitations)) throw responseError("limitations_shape", diagnostic);
  if (limitations.length > LIMITS.limitations || limitations.some((item) => !text(item, LIMITS.limitation))) throw responseError(limitations.some((item) => typeof item === "string" && item.length > LIMITS.limitation) ? "output_limit" : "limitations_shape", diagnostic);
  return { version: 1, reviewType, target: { programId: context.target.programId, routineId: context.target.routineId }, summary: value.summary.trim(), strengths: list("strengths", LIMITS.items), concerns: list("concerns", LIMITS.items), suggestedChanges: list("suggestedChanges", LIMITS.changes, true), limitations: limitations.map((item) => item.trim()) };
}
export async function generateRobReview(data, { provider }) { const context = validateReviewContext(data); const result = await provider.generate({ messages: reviewMessages(context) }); return { model: result.model, usage: result.usage, review: parseReview(result.text, context) }; }
