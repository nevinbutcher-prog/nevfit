import test from "node:test";
import assert from "node:assert/strict";
import { buildRoutineCreationInstruction } from "../src/services/rob/robRoutineCreation.js";

test("routine creation request requires focus and preserves explicit constraints", () => {
  assert.equal(buildRoutineCreationInstruction({ focus: "", duration: "", equipment: "", considerations: "" }).code, "missing_focus");
  const result = buildRoutineCreationInstruction({ focus: "Shoulders and arms", duration: "45 minutes", equipment: "Machines only", considerations: "Avoid heavy gripping" });
  assert.equal(result.valid, true);
  assert.match(result.instruction, /Training focus: Shoulders and arms/);
  assert.match(result.instruction, /Approximate duration: 45 minutes/);
  assert.match(result.instruction, /Available equipment or restrictions: Machines only/);
  assert.match(result.instruction, /Additional considerations: Avoid heavy gripping/);
});

test("routine creation request rejects over-limit fields and never silently truncates", () => {
  for (const [field, size, code] of [["focus", 361, "creation_focus_too_long"], ["equipment", 161, "creation_equipment_too_long"], ["considerations", 181, "creation_considerations_too_long"]]) {
    const result = buildRoutineCreationInstruction({ focus: "Valid focus", duration: "", equipment: "", considerations: "", [field]: "a".repeat(size) });
    assert.equal(result.code, code);
  }
  const exact = buildRoutineCreationInstruction({ focus: "a".repeat(360), duration: "", equipment: "", considerations: "" });
  assert.equal(exact.valid, true);
  assert.equal(exact.instruction.endsWith("a".repeat(360)), true);
});

test("routine creation request rejects an overlong combined instruction without truncating it", () => {
  const result = buildRoutineCreationInstruction({ focus: "a".repeat(360), duration: "75 minutes", equipment: "b".repeat(160), considerations: "c".repeat(180) });
  assert.equal(result.valid, false);
  assert.equal(result.code, "instruction_too_long");
});
