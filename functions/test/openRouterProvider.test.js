import test from "node:test";
import assert from "node:assert/strict";
import { AiError } from "../src/ai/aiErrors.js";
import { createOpenRouterProvider } from "../src/ai/providers/openRouterProvider.js";

const config = { model: "test-model", maxOutputTokens: 1200, timeoutMs: 25 };
const request = { messages: [{ role: "user", content: "Reply with exactly: OK" }] };
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const provider = (fetchImpl, apiKey = "secret") => createOpenRouterProvider({ apiKey, config, fetchImpl });

test("normalizes a successful OpenRouter completion and keeps controls server-owned", async () => {
  let options;
  const result = await provider(async (_url, value) => { options = value; return response(200, { model: "returned-model", choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } }); }).generate(request);
  assert.deepEqual(result, { text: "OK", model: "returned-model", usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 } });
  assert.deepEqual(JSON.parse(options.body), { model: "test-model", messages: request.messages, max_tokens: 1200, stream: false });
});

for (const [name, status, code, retryable] of [["authentication error", 401, "ai_provider_auth", false], ["rate limit", 429, "ai_rate_limited", true], ["provider unavailable", 503, "ai_provider_unavailable", true]]) {
  test(`maps ${name}`, async () => {
    await assert.rejects(() => provider(async () => response(status, {})).generate(request), (error) => error instanceof AiError && error.code === code && error.retryable === retryable);
  });
}

test("maps an aborted fetch to a retryable timeout", async () => {
  await assert.rejects(() => provider(async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; }).generate(request), (error) => error.code === "ai_timeout" && error.retryable);
});

test("rejects invalid JSON and malformed success bodies", async () => {
  const cases = [async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } }), async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }), async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: {} }] }) })];
  for (const fetchImpl of cases) await assert.rejects(() => provider(fetchImpl).generate(request), (error) => error.code === "ai_invalid_response");
});

test("does not make a request when its server secret is missing", async () => {
  let called = false;
  await assert.rejects(() => provider(async () => { called = true; }, "").generate(request), (error) => error.code === "ai_not_configured");
  assert.equal(called, false);
});
