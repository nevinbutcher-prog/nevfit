import { AiError } from "../aiErrors.js";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

function usageValue(value) {
  return Number.isFinite(value) ? value : null;
}

function providerError(response) {
  if (response.status === 401 || response.status === 403) return new AiError("ai_provider_auth");
  if (response.status === 429) return new AiError("ai_rate_limited", { retryable: true });
  if (response.status >= 500) return new AiError("ai_provider_unavailable", { retryable: true });
  return new AiError("ai_provider_unavailable", { retryable: response.status >= 408 });
}

export function createOpenRouterProvider({ apiKey, config, fetchImpl = fetch }) {
  return {
    async generate({ messages, maxOutputTokens = config.maxOutputTokens }) {
      if (!apiKey) throw new AiError("ai_not_configured");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        let response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: config.model, messages, max_tokens: maxOutputTokens, stream: false }),
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted || error?.name === "AbortError") {
            throw new AiError("ai_timeout", { retryable: true, cause: error });
          }
          throw new AiError("ai_provider_unavailable", { retryable: true, cause: error });
        }
        if (!response.ok) throw providerError(response);

        let body;
        try { body = await response.json(); } catch (error) { throw new AiError("ai_invalid_response", { retryable: true, cause: error }); }
        const text = body?.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) throw new AiError("ai_invalid_response", { retryable: true });
        return {
          text,
          model: typeof body.model === "string" ? body.model : config.model,
          usage: {
            inputTokens: usageValue(body.usage?.prompt_tokens),
            outputTokens: usageValue(body.usage?.completion_tokens),
            totalTokens: usageValue(body.usage?.total_tokens),
          },
          finishReason: typeof body.choices?.[0]?.finish_reason === "string" ? body.choices[0].finish_reason : null,
        };
      } finally { clearTimeout(timeout); }
    },
  };
}
