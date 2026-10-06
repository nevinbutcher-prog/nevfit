const LIMIT = 600;
const LIMITS = { focus: 360, duration: 40, equipment: 160, considerations: 180 };
const clean = (value) => typeof value === "string" ? value.trim() : "";

export function buildRoutineCreationInstruction({ focus, duration, equipment, considerations }) {
  const values = { focus: clean(focus), duration: clean(duration), equipment: clean(equipment), considerations: clean(considerations) };
  const overLimit = Object.entries(values).find(([key, value]) => value.length > LIMITS[key]);
  if (overLimit) return { valid: false, code: `creation_${overLimit[0]}_too_long` };
  const parts = [["Training focus", values.focus], ["Approximate duration", values.duration], ["Available equipment or restrictions", values.equipment], ["Additional considerations", values.considerations]].filter(([, value]) => value);
  if (!parts[0]) return { valid: false, code: "missing_focus" };
  const instruction = parts.map(([label, value]) => `${label}: ${value}`).join("\n");
  return instruction.length > LIMIT ? { valid: false, code: "instruction_too_long" } : { valid: true, instruction };
}
