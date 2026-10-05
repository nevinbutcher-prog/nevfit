import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export class RobClientError extends Error {
  constructor({ code = "ai_unknown", message = "Rob couldn't get a response right now. Try again.", retryable = false } = {}) {
    super(message);
    this.name = "RobClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

export async function requestRobAdvice({ question, context }) {
  try {
    const result = await httpsCallable(functions, "robAdvice")({ question, context });
    return result.data;
  } catch (error) {
    throw new RobClientError(error?.details && typeof error.details === "object" ? error.details : {});
  }
}
