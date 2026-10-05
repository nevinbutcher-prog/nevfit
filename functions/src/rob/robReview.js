import { AiError } from "../ai/aiErrors.js";

export const ROB_REVIEW_CONTEXT_MAX_CHARS = 12000;
const LIMITS = { context: ROB_REVIEW_CONTEXT_MAX_CHARS, prompt: 13000, summary: 600, items: 4, changes: 5, title: 120, explanation: 500, limitations: 4, limitation: 300, routines: 6, exercises: 12 };
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const invalid = (diagnostic) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = diagnostic; throw error; };
const responseError = () => new AiError("ai_invalid_response", { retryable: true });

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
  const messages = [{ role: "system", content: "You are Rob, Fitbot's practical strength coach. Return exactly one JSON object, no markdown. Assess only supplied context. Do not diagnose, infer recovery/pain/sleep/readiness, claim clinical safety, or propose executable changes. Schema: {version:1,reviewType:'routine'|'program',target:{programId,routineId},summary,strengths:[{title,explanation,routineIds,routineExerciseIds}],concerns:[...],suggestedChanges:[{title,explanation,priority:'low'|'medium'|'high',routineIds,routineExerciseIds}],limitations:[string]}. Keep concise." }, { role: "user", content: `FITBOT REVIEW CONTEXT:\n${JSON.stringify(context)}` }];
  if (messages.reduce((length, message) => length + message.content.length, 0) > LIMITS.prompt) invalid({ reason: "prompt_size", contextLength: JSON.stringify(context).length, contextVersion: context.version, requestType: context.requestType });
  return messages;
}

function parseJson(textValue) {
  if (typeof textValue !== "string" || !textValue.trim()) throw responseError();
  const trimmed = textValue.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const json = fenced ? fenced[1] : trimmed;
  try { return JSON.parse(json); } catch { throw responseError(); }
}
function refs(values, valid, limit) { return Array.isArray(values) ? values.filter((value) => typeof value === "string" && valid.has(value)).slice(0, limit) : []; }
function finding(value, ids) {
  if (!object(value) || !text(value.title, LIMITS.title) || !text(value.explanation, LIMITS.explanation)) throw responseError();
  if (Object.keys(value).some((key) => !["title", "explanation", "priority", "routineIds", "routineExerciseIds"].includes(key))) throw responseError();
  return { title: value.title.trim(), explanation: value.explanation.trim(), routineIds: refs(value.routineIds, ids.routines, LIMITS.routines), routineExerciseIds: refs(value.routineExerciseIds, ids.exercises, LIMITS.exercises), ...(value.priority ? { priority: ["low", "medium", "high"].includes(value.priority) ? value.priority : (() => { throw responseError(); })() } : {}) };
}
export function parseReview(textValue, context) {
  const value = parseJson(textValue);
  const reviewType = context.requestType === "routine_review" ? "routine" : "program";
  if (!object(value) || Object.keys(value).some((key) => !["version", "reviewType", "target", "summary", "strengths", "concerns", "suggestedChanges", "limitations"].includes(key)) || value.version !== 1 || value.reviewType !== reviewType || !object(value.target) || value.target.programId !== context.target.programId || value.target.routineId !== context.target.routineId || !text(value.summary, LIMITS.summary)) throw responseError();
  const ids = { routines: new Set(context.program.routines.map((routine) => routine.id)), exercises: new Set(context.program.routines.flatMap((routine) => routine.exercises.map((exercise) => exercise.routineExerciseId))) };
  const list = (name, max, changes = false) => { if (!Array.isArray(value[name]) || value[name].length > max) throw responseError(); return value[name].map((item) => finding(changes ? item : { ...item, priority: undefined }, ids)); };
  const limitations = typeof value.limitations === "undefined" ? [] : value.limitations;
  if (!Array.isArray(limitations) || limitations.length > LIMITS.limitations || limitations.some((item) => !text(item, LIMITS.limitation))) throw responseError();
  return { version: 1, reviewType, target: { programId: context.target.programId, routineId: context.target.routineId }, summary: value.summary.trim(), strengths: list("strengths", LIMITS.items), concerns: list("concerns", LIMITS.items), suggestedChanges: list("suggestedChanges", LIMITS.changes, true), limitations: limitations.map((item) => item.trim()) };
}
export async function generateRobReview(data, { provider }) { const context = validateReviewContext(data); const result = await provider.generate({ messages: reviewMessages(context) }); return { model: result.model, usage: result.usage, review: parseReview(result.text, context) }; }
