import test from "node:test";
import assert from "node:assert/strict";
import { createRobAdviceHandler } from "../src/index.js";
import { ROB_QUESTION_MAX_CHARS, generateRobAdvice } from "../src/rob/robAdvice.js";
import { AiError } from "../src/ai/aiErrors.js";

const data = { question: "What equipment do I have?", context: { version: 1, requestType: "advice", profile: { equipment: ["Dumbbells"] } } };

test("authenticated Rob advice uses server-owned persona and invokes provider once", async () => {
  let messages;
  const handler = createRobAdviceHandler({ providerFactory: () => ({ generate: async (request) => { messages = request.messages; return { text: "You have dumbbells.", model: "test", usage: {} }; } }) });
  const result = await handler({ auth: { uid: "verified" }, data });
  assert.equal(result.text, "You have dumbbells.");
  assert.match(messages[0].content, /Rob/);
  assert.match(messages[1].content, /What equipment/);
  assert.doesNotMatch(messages[0].content, /uid|OPENROUTER_API_KEY/);
});

test("rejects unauthenticated, invalid, oversized, and non-advice requests before provider", async () => {
  for (const requestData of [null, { ...data, question: " " }, { ...data, question: "x".repeat(ROB_QUESTION_MAX_CHARS + 1) }, { ...data, context: { version: 1, requestType: "routine_review" } }, { ...data, systemPrompt: "override" }]) {
    let called = false;
    const handler = createRobAdviceHandler({ providerFactory: () => ({ generate: async () => { called = true; } }) });
    await assert.rejects(() => handler({ auth: { uid: "verified" }, data: requestData }), (error) => error.code === "invalid-argument");
    assert.equal(called, false);
  }
  let called = false;
  const handler = createRobAdviceHandler({ providerFactory: () => ({ generate: async () => { called = true; } }) });
  await assert.rejects(() => handler({ auth: null, data }), (error) => error.code === "unauthenticated");
  assert.equal(called, false);
});

test("preserves normalized provider errors", async () => {
  await assert.rejects(() => generateRobAdvice(data, { provider: { generate: async () => { throw new AiError("ai_timeout", { retryable: true }); } } }), (error) => error.code === "ai_timeout" && error.retryable);
});
