import test from "node:test";
import assert from "node:assert/strict";
import { buildEvaluationCases, dryRunManifest } from "../scripts/evaluateRobCoaching.mjs";

test("evaluation prepares five synthetic scenarios with identical current prompts per model", () => {
  const cases = buildEvaluationCases();
  assert.equal(cases.length, 17);
  assert.equal(new Set(cases.map((item) => item.scenarioId)).size, 5);
  for (const scenarioId of new Set(cases.map((item) => item.scenarioId))) {
    const current = cases.filter((item) => item.scenarioId === scenarioId && item.variant === "current");
    assert.equal(current.length, 3);
    assert.equal(new Set(current.map((item) => item.promptHash)).size, 1);
    assert.equal(new Set(current.map((item) => item.maxOutputTokens)).size, 1);
  }
  assert.equal(cases.find((item) => item.scenarioId === "training-week").contextCoverage.suppliedWorkouts, 4);
  assert.equal(cases.find((item) => item.scenarioId === "training-week").contextCoverage.visibleWorkouts, 1);
  assert.equal(cases.filter((item) => item.variant === "clearer-prompt").length, 2);
  assert.ok(dryRunManifest(cases).conservativeCostCeilingUsd > 0);
});
