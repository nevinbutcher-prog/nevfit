import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmRobProgramIntake,
  createRobProgramIntake,
  getNextRobProgramIntakeStep,
  updateRobProgramIntake,
  validateRobProgramIntake,
} from "../src/services/rob/robProgramIntake.js";

const complete = (overrides = {}) => updateRobProgramIntake(createRobProgramIntake(), {
  goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 60, priorities: ["shoulders", "arms"],
  environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells"], equipmentConfirmed: true,
  constraints: "", constraintsConfirmed: true, ...overrides,
});

test("program intake begins unanswered and progresses deterministically", () => {
  const initial = createRobProgramIntake();
  assert.equal(getNextRobProgramIntakeStep(initial), "goal");
  assert.equal(validateRobProgramIntake(initial).valid, false);
  assert.equal(getNextRobProgramIntakeStep(updateRobProgramIntake(initial, { goal: "strength" })), "days");
});

test("three, four, and five day program briefs validate with multiple priorities", () => {
  [3, 4, 5].forEach((daysPerWeek) => assert.equal(validateRobProgramIntake(complete({ daysPerWeek })).valid, true));
  assert.equal(validateRobProgramIntake(complete({ daysPerWeek: 2 })).valid, true);
  assert.equal(validateRobProgramIntake(complete({ daysPerWeek: 7 })).errors.days, "Choose one to six training days per week.");
  assert.equal(validateRobProgramIntake(complete({ sessionMinutes: 0 })).errors.duration, "Choose a session duration from 20 to 180 minutes.");
});

test("other goals, bounded text, equipment confirmation, and explicit no constraints are validated", () => {
  assert.ok(validateRobProgramIntake(complete({ goal: "other", goalDescription: "" })).errors.goalDescription);
  assert.equal(validateRobProgramIntake(complete({ goal: "other", goalDescription: "Train for a hiking trip" })).valid, true);
  assert.ok(validateRobProgramIntake(complete({ priorityNote: "x".repeat(241) })).errors.priorityNote);
  assert.ok(validateRobProgramIntake(complete({ equipmentConfirmed: false })).errors.equipmentConfirmed);
  assert.equal(validateRobProgramIntake(complete({ constraints: "", constraintsConfirmed: true })).valid, true);
});

test("confirmation returns an independent, serializable requirements snapshot and edits invalidate it", () => {
  const result = confirmRobProgramIntake(complete());
  assert.equal(result.confirmed, true);
  assert.deepEqual(result.requirements.priorities, ["shoulders", "arms"]);
  const edited = updateRobProgramIntake(result.intake, { daysPerWeek: 5 });
  assert.equal(edited.confirmedRequirements, null);
  assert.equal(edited.daysPerWeek, 5);
  result.requirements.priorities.push("back");
  assert.deepEqual(result.intake.confirmedRequirements.priorities, ["shoulders", "arms"]);
});

test("intake domain has no persistence, provider, or static-profile dependency", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/rob/robProgramIntake.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|requestRob|robTrainingProfile|saveProgram|setDoc/i);
});
