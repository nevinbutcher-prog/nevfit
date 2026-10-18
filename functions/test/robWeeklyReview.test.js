import test from "node:test";
import assert from "node:assert/strict";
import { createRobWeeklyReviewHandler } from "../src/index.js";
import { generateRobWeeklyReview, validateRobWeeklyReviewRequest } from "../src/rob/robWeeklyReview.js";

const period = (start, end) => ({ start, end, strength: { exercises: [] }, runs: { runs: [] }, steps: { days: [] } });
const context = { version: 1, requestType: "weekly_review", calendar: "device_local_monday_sunday", selectedDate: "2026-10-14", current: period("2026-10-12", "2026-10-18"), preceding: period("2026-10-05", "2026-10-11"), comparison: {}, evidenceLimits: {} };

test("weekly callable requires authentication before invoking provider or reading supplied evidence", async () => {
  let invoked = false;
  const handler = createRobWeeklyReviewHandler({ providerFactory: () => { invoked = true; throw new Error("should not run"); } });
  await assert.rejects(handler({ auth: null, data: { context } }), (error) => error.code === "unauthenticated");
  assert.equal(invoked, false);
});

test("weekly route is read-only and uses its focused instruction", async () => {
  const before = JSON.stringify(context);
  let messages;
  const result = await generateRobWeeklyReview({ context }, { provider: { generate: async (request) => { messages = request.messages; return { text: "Specific review", model: "test", usage: null }; } } });
  assert.equal(result.text, "Specific review");
  assert.match(messages[0].content, /running and lifting/);
  assert.match(messages[0].content, /100–150 words/);
  assert.match(messages[0].content, /double progression/);
  assert.match(messages[0].content, /Do not assume this method for other users/);
  assert.match(messages[1].content, /weekly_review/);
  assert.equal(JSON.stringify(context), before);
});

test("malformed or oversized weekly evidence is rejected", () => {
  assert.throws(() => validateRobWeeklyReviewRequest({ context: { ...context, requestType: "advice" } }));
  assert.throws(() => validateRobWeeklyReviewRequest({ context, uid: "another-user" }));
  assert.throws(() => validateRobWeeklyReviewRequest({ context: { ...context, extra: "x".repeat(23000) } }));
});
