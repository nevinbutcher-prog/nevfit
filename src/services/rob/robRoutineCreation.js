const LIMIT = 600;
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function buildRoutineCreationInstruction({ focus, duration, equipment, considerations }) {
  const parts = [["Training focus", clean(focus, 360)], ["Approximate duration", clean(duration, 40)], ["Available equipment or restrictions", clean(equipment, 160)], ["Additional considerations", clean(considerations, 180)]].filter(([, value]) => value);
  if (!parts[0]) return { valid: false, code: "missing_focus" };
  const instruction = parts.map(([label, value]) => `${label}: ${value}`).join("\n");
  return instruction.length > LIMIT ? { valid: false, code: "instruction_too_long" } : { valid: true, instruction };
}
