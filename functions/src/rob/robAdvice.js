import { AiError } from "../ai/aiErrors.js";
import { composeRobAdviceMessages } from "./robPrompt.js";

export const ROB_QUESTION_MAX_CHARS = 1500;
export const ROB_CONTEXT_MAX_CHARS = 16000;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function validateRobAdviceRequest(data) {
  if (!isPlainObject(data) || Object.keys(data).some((key) => key !== "question" && key !== "context")) throw new AiError("ai_invalid_request");
  const question = typeof data.question === "string" ? data.question.trim() : "";
  if (!question || question.length > ROB_QUESTION_MAX_CHARS || !isPlainObject(data.context) || data.context.version !== 1 || data.context.requestType !== "advice") throw new AiError("ai_invalid_request");
  let contextText;
  try { contextText = JSON.stringify(data.context); } catch { throw new AiError("ai_invalid_request"); }
  if (!contextText || contextText.length > ROB_CONTEXT_MAX_CHARS) throw new AiError("ai_invalid_request");
  return { question, context: data.context };
}

export async function generateRobAdvice(data, { provider }) {
  const request = validateRobAdviceRequest(data);
  return provider.generate({ messages: composeRobAdviceMessages(request) });
}
