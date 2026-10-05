import { AiError } from "./aiErrors.js";
import { aiInputLimits } from "./aiConfig.js";

const allowedRoles = new Set(["system", "user", "assistant"]);

export function validateAiRequest(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !("messages" in data)) {
    throw new AiError("ai_invalid_request");
  }
  if (Object.keys(data).some((key) => key !== "messages") || !Array.isArray(data.messages) || !data.messages.length || data.messages.length > aiInputLimits.maxMessages) {
    throw new AiError("ai_invalid_request");
  }
  let totalChars = 0;
  const messages = data.messages.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message) || Object.keys(message).some((key) => key !== "role" && key !== "content") || !allowedRoles.has(message.role) || typeof message.content !== "string") {
      throw new AiError("ai_invalid_request");
    }
    const content = message.content.trim();
    if (!content || content.length > aiInputLimits.maxMessageChars) throw new AiError("ai_invalid_request");
    totalChars += content.length;
    return { role: message.role, content };
  });
  if (totalChars > aiInputLimits.maxTotalChars) throw new AiError("ai_invalid_request");
  return { messages };
}

export async function generateAiResponse(data, { provider }) {
  const request = validateAiRequest(data);
  return provider.generate(request);
}
