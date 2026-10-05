import test from "node:test";
import assert from "node:assert/strict";
import { createAiGenerateHandler } from "../src/index.js";

const data = { messages: [{ role: "user", content: "Reply with exactly: OK" }] };

test("an authenticated callable request may reach the AI service", async () => {
  let called = false;
  const handler = createAiGenerateHandler({ providerFactory: () => ({ generate: async () => { called = true; return { text: "OK", model: "test", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }; } }) });
  const result = await handler({ auth: { uid: "verified-auth-context-only" }, data });
  assert.equal(called, true);
  assert.equal(result.text, "OK");
});

test("an unauthenticated callable request is rejected before the provider", async () => {
  let called = false;
  const handler = createAiGenerateHandler({ providerFactory: () => ({ generate: async () => { called = true; } }) });
  await assert.rejects(() => handler({ auth: null, data: { ...data, uid: "untrusted" } }), (error) => error.code === "unauthenticated" && error.details?.code === "ai_unauthenticated");
  assert.equal(called, false);
});
