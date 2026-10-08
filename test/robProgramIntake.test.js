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

test("editing constraints requires reconfirmation", () => {
  const edited = updateRobProgramIntake(complete({ constraints: "Avoid overhead pressing", constraintsConfirmed: true }), {
    constraints: "Avoid overhead pressing and deep knee flexion",
  });
  assert.equal(edited.constraintsConfirmed, false);
  assert.equal(validateRobProgramIntake(edited).errors.constraintsConfirmed, "Confirm your constraints or choose no additional constraints.");
  assert.equal(getNextRobProgramIntakeStep(edited), "constraints");
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

test("free text preserves spaces while editing and normalizes only the confirmed snapshot", () => {
  const typing = updateRobProgramIntake(complete(), { constraints: "Avoid heavy ", constraintsConfirmed: true });
  assert.equal(typing.constraints, "Avoid heavy ");
  const continued = updateRobProgramIntake(typing, { constraints: `${typing.constraints}overhead pressing` });
  assert.equal(continued.constraints, "Avoid heavy overhead pressing");
  const padded = updateRobProgramIntake(continued, {
    goal: "other", goalDescription: "  Build muscle and strength  ",
    priorityNote: "  Keep  legs  balanced  ", equipmentOther: "  Rings  ", constraints: "  Avoid heavy overhead pressing  ",
  });
  const result = confirmRobProgramIntake(updateRobProgramIntake(padded, { constraintsConfirmed: true }));
  assert.equal(result.confirmed, true);
  assert.equal(result.requirements.goalDescription, "Build muscle and strength");
  assert.equal(result.requirements.priorityNote, "Keep  legs  balanced");
  assert.equal(result.requirements.equipmentOther, "Rings");
  assert.equal(result.requirements.constraints, "Avoid heavy overhead pressing");
  assert.equal(confirmRobProgramIntake(complete({ goal: "other", goalDescription: "   " })).confirmed, false);
  assert.equal(confirmRobProgramIntake(complete({ constraints: "x".repeat(361) })).confirmed, false);
});

test("intake domain has no persistence, provider, or static-profile dependency", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/rob/robProgramIntake.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|requestRob|robTrainingProfile|saveProgram|setDoc/i);
});
