import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export class AiClientError extends Error {
  constructor({ code = "ai_unknown", message = "Rob couldn't get a response right now. Try again.", retryable = false } = {}) {
    super(message);
    this.name = "AiClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

export async function requestAiResponse({ messages }) {
  try {
    const callable = httpsCallable(functions, "aiGenerate");
    const result = await callable({ messages });
    return result.data;
  } catch (error) {
    const details = error?.details && typeof error.details === "object" ? error.details : {};
    throw new AiClientError(details);
  }
}
