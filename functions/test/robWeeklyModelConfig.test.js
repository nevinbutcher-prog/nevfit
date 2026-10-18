import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("weekly model setting selects GPT-4.1 without changing the shared Rob model", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import { aiConfig } from './src/ai/aiConfig.js'; import { ROB_WEEKLY_MODEL } from './src/rob/robWeeklyReview.js'; process.stdout.write(JSON.stringify({ shared: aiConfig.model, weekly: ROB_WEEKLY_MODEL }));"], {
    cwd: new URL("..", import.meta.url), encoding: "utf8",
    env: { ...process.env, AI_MODEL: "openai/gpt-4o-mini", ROB_WEEKLY_REVIEW_MODEL: "openai/gpt-4.1" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { shared: "openai/gpt-4o-mini", weekly: "openai/gpt-4.1" });
  assert.equal(readFileSync(new URL("../.env.nevfit-fa139", import.meta.url), "utf8").trim(), "ROB_WEEKLY_REVIEW_MODEL=openai/gpt-4.1");
});
