export class RobClientError extends Error {
  constructor({ code = "ai_unknown", message = "Rob couldn't get a response right now. Try again.", retryable = false } = {}) {
    super(message);
    this.name = "RobClientError";
    this.code = code;
    this.retryable = retryable;
  }
}
