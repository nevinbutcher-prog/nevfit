import { AiError } from "../ai/aiErrors.js";
import { composeRobAdviceMessages } from "./robPrompt.js";

export const ROB_QUESTION_MAX_CHARS = 1500;
export const ROB_CONTEXT_MAX_CHARS = 16000;
export const ROB_PROMPT_MAX_CHARS = 12000;

function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalid(reason, diagnostic) {
  const error = new AiError("ai_invalid_request");
  error.validationDiagnostic = { reason, ...diagnostic };
  throw error;
}

export function validateRobAdviceRequest(data) {
  const requestIsObject = isJsonObject(data);
  const contextIsObject = requestIsObject && isJsonObject(data.context);
  const questionLength = typeof data?.question === "string" ? data.question.trim().length : null;
  if (!requestIsObject || Object.keys(data).some((key) => key !== "question" && key !== "context")) invalid("request_shape", { questionLength, contextIsObject });
  const question = typeof data.question === "string" ? data.question.trim() : "";
  if (!question || question.length > ROB_QUESTION_MAX_CHARS) invalid("question_length", { questionLength, contextIsObject });
  if (!contextIsObject) invalid("context_shape", { questionLength, contextIsObject });
  if (data.context.version !== 1 || data.context.requestType !== "advice") invalid("context_type", { questionLength, contextIsObject, contextVersion: data.context.version ?? null, contextType: data.context.requestType ?? null });
  let contextText;
  try { contextText = JSON.stringify(data.context); } catch { invalid("context_serialization", { questionLength, contextIsObject, contextVersion: data.context.version, contextType: data.context.requestType }); }
  if (!contextText || contextText.length > ROB_CONTEXT_MAX_CHARS) invalid("context_size", { questionLength, contextLength: contextText?.length ?? null, contextIsObject, contextVersion: data.context.version, contextType: data.context.requestType });
  return { question, context: data.context };
}

export async function generateRobAdvice(data, { provider }) {
  const request = validateRobAdviceRequest(data);
  const messages = composeRobAdviceMessages(request);
  if (messages[1].content.length > ROB_PROMPT_MAX_CHARS) invalid("prompt_size", { questionLength: request.question.length, contextLength: JSON.stringify(request.context).length, contextIsObject: true, contextVersion: request.context.version, contextType: request.context.requestType });
  return provider.generate({ messages });
}
