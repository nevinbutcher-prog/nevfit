const safeMessages = {
  ai_unauthenticated: "Please sign in to use AI features.",
  ai_invalid_request: "That AI request is not valid.",
  ai_not_configured: "AI is not configured yet.",
  ai_rate_limited: "Rob is busy right now. Try again shortly.",
  ai_timeout: "Rob couldn't get a response right now. Try again.",
  ai_provider_auth: "AI is temporarily unavailable.",
  ai_provider_unavailable: "Rob couldn't get a response right now. Try again.",
  ai_invalid_response: "Rob couldn't get a usable response right now. Try again.",
  ai_unknown: "Rob couldn't get a response right now. Try again.",
};

export class AiError extends Error {
  constructor(code, { message = safeMessages[code] ?? safeMessages.ai_unknown, retryable = false, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "AiError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeAiError(error) {
  if (error instanceof AiError) return error;
  return new AiError("ai_unknown", { cause: error });
}

export function toClientError(error) {
  const normalized = normalizeAiError(error);
  return { code: normalized.code, message: normalized.message, retryable: normalized.retryable };
}
