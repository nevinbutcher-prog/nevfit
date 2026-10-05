import test from "node:test";
import assert from "node:assert/strict";
import { AiError } from "../src/ai/aiErrors.js";
import { aiInputLimits } from "../src/ai/aiConfig.js";
import { generateAiResponse, validateAiRequest } from "../src/ai/aiService.js";

const validData = { messages: [{ role: "user", content: "Reply with exactly: OK" }] };

test("accepts the constrained provider-neutral request contract", () => {
  assert.deepEqual(validateAiRequest(validData), validData);
});

for (const [name, data] of [
  ["missing messages", {}],
  ["non-array messages", { messages: "no" }],
  ["unsupported role", { messages: [{ role: "tool", content: "x" }] }],
  ["empty content", { messages: [{ role: "user", content: "  " }] }],
  ["too many messages", { messages: Array.from({ length: aiInputLimits.maxMessages + 1 }, () => ({ role: "user", content: "x" })) }],
  ["too-long message", { messages: [{ role: "user", content: "x".repeat(aiInputLimits.maxMessageChars + 1) }] }],
  ["too much total input", { messages: Array.from({ length: 4 }, () => ({ role: "user", content: "x".repeat(3500) })) }],
  ["client provider configuration", { ...validData, model: "anything" }],
]) {
  test(`rejects ${name} before calling a provider`, async () => {
    let called = false;
    await assert.rejects(() => generateAiResponse(data, { provider: { generate: async () => { called = true; } } }), (error) => error instanceof AiError && error.code === "ai_invalid_request");
    assert.equal(called, false);
  });
}
