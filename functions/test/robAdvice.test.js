import test from "node:test";
import assert from "node:assert/strict";
import { createRobAdviceHandler } from "../src/index.js";
import { ROB_CONTEXT_MAX_CHARS, ROB_QUESTION_MAX_CHARS, generateRobAdvice, validateRobAdviceRequest } from "../src/rob/robAdvice.js";
import { AiError } from "../src/ai/aiErrors.js";
import { composeRobAdviceMessages } from "../src/rob/robPrompt.js";

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

test("accepts Firebase-callable-compatible object shapes and retains a hard context cap", () => {
  const context = Object.assign(Object.create(null), data.context);
  assert.equal(validateRobAdviceRequest({ question: data.question, context }).context, context);
  assert.throws(() => validateRobAdviceRequest({ question: "short", context: { version: 1, requestType: "advice", padding: "x".repeat(ROB_CONTEXT_MAX_CHARS) } }), (error) => error.code === "ai_invalid_request" && error.validationDiagnostic?.reason === "context_size");
});

test("advisory prompt preserves serialized weight units and forbids relabeling or invention", () => {
  const context = { version: 1, requestType: "advice", history: { workouts: [{ exercises: [{ sets: [{ weight: "62.5", reps: "8", unit: "kg" }] }] }] } };
  const messages = composeRobAdviceMessages({ question: "How did I do?", context });
  assert.match(messages[0].content, /never relabel, convert, or invent a weight unit/i);
  assert.match(messages[0].content, /unit was not recorded/i);
  assert.match(messages[1].content, /"weight":"62.5"/);
  assert.match(messages[1].content, /"unit":"kg"/);
});
