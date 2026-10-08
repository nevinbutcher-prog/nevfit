import test from "node:test";
import assert from "node:assert/strict";

test("program intake presents a confirmation indicator and expandable read-only candidate details", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/components/rob/RobProgramIntake.jsx", import.meta.url), "utf8"));
  assert.match(source, /Generated/);
  assert.match(source, /<details/);
  assert.match(source, /Brief confirmed/);
  assert.doesNotMatch(source, /disabled=\{!canNext \|\| Boolean\(intake\.confirmedRequirements\)\}/);
  assert.match(source, /read-only candidate/);
  assert.doesNotMatch(source, /saveProgram|setDoc|requestRobProgram|exerciseResolution/i);
});