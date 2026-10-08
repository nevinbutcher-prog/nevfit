import { AiError } from "../ai/aiErrors.js";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const invalid = (reason) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = { reason }; throw error; };
const fail = (reason) => { const error = new AiError("ai_invalid_response", { retryable: true }); error.validationDiagnostic = { reason }; throw error; };
const allowed = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const GOALS = new Set(["hypertrophy", "strength", "general_fitness", "hypertrophy_strength", "other"]);
const PRIORITIES = new Set(["shoulders", "arms", "chest", "back", "legs", "glutes", "core", "balanced"]);
const ENVIRONMENTS = new Set(["commercial_gym", "home_gym", "both", "minimal_equipment", "other"]);
const EQUIPMENT = new Set(["machines", "dumbbells", "barbell", "cables", "bench", "pull_up_equipment"]);
const identity = (value, max = 160) => typeof value === "string" && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.trim());
const optionalText = (value, max) => value === undefined || (typeof value === "string" && value.trim() && value.length <= max);
const list = (value, supported, max) => Array.isArray(value) && value.length <= max && value.every((item) => supported.has(item)) && new Set(value).size === value.length;
const repRange = (value) => {
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/) : null;
  if (!match) return false;
  const minimum = Number(match[1]);
  const maximum = Number(match[2] ?? match[1]);
  return minimum >= 1 && maximum <= 100 && minimum <= maximum;
};
const intakeValid = (value) => allowed(value, ["version", "goal", "goalDescription", "daysPerWeek", "sessionMinutes", "priorities", "priorityNote", "environment", "equipment", "equipmentOther", "constraints"])
  && value.version === 1
  && GOALS.has(value.goal)
  && (value.goal !== "other" || (typeof value.goalDescription === "string" && value.goalDescription.trim() && value.goalDescription.length <= 160))
  && optionalText(value.goalDescription, 160)
  && Number.isInteger(value.daysPerWeek) && value.daysPerWeek >= 1 && value.daysPerWeek <= 6
  && Number.isInteger(value.sessionMinutes) && value.sessionMinutes >= 20 && value.sessionMinutes <= 180
  && list(value.priorities, PRIORITIES, 6)
  && optionalText(value.priorityNote, 240)
  && ENVIRONMENTS.has(value.environment)
  && list(value.equipment, EQUIPMENT, 8)
  && optionalText(value.equipmentOther, 160)
  && typeof value.constraints === "string" && value.constraints.length <= 360;

export function validateProgramGenerationRequest(data) {
  if (!allowed(data, ["requirements"]) || !intakeValid(data.requirements)) invalid("requirements");
  return { requirements: data.requirements };
}
export function programGenerationMessages(requirements) {
  return [{ role: "system", content: `You are Rob. Return exactly one JSON object, no markdown. Design one complete coordinated training program for the confirmed requirements. Return schema: {"version":1,"proposalType":"create_program","program":{"name":"Name","summary":"Short summary","days":[{"name":"Routine name","focus":"Short focus","exercises":[{"exerciseRef":"exercise name","sets":3,"repRange":"8-12","restSeconds":120,"note":null,"proposalGroupKey":null}]}]},"explanation":"Short explanation"}. Return exactly ${requirements.daysPerWeek} routines. Do not include IDs, exerciseId, program metadata, scheduling, or any fields outside this schema. Use user constraints and equipment; do not claim durations are measured.` }, { role: "user", content: `CONFIRMED REQUIREMENTS:\n${JSON.stringify(requirements)}` }];
}
export function parseProgramCandidate(raw, requirements) {
  let value; try { value = JSON.parse(typeof raw === "string" ? raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "") : ""); } catch { fail("json"); }
  if (!allowed(value, ["version", "proposalType", "program", "explanation"]) || value.version !== 1 || value.proposalType !== "create_program" || !text(value.explanation, 1000) || !allowed(value.program, ["name", "summary", "days"]) || !text(value.program.name, 160) || !text(value.program.summary, 600) || !Array.isArray(value.program.days) || value.program.days.length !== requirements.daysPerWeek || value.program.days.length > 6) fail("candidate");
  const groupCheck = (day) => {
    if (!allowed(day, ["name", "focus", "exercises"]) || !text(day.name, 160) || !text(day.focus, 200) || !Array.isArray(day.exercises) || !day.exercises.length || day.exercises.length > 12) fail("routine");
    const groups = new Map();
    day.exercises.forEach((exercise) => { if (!allowed(exercise, ["exerciseRef", "sets", "repRange", "restSeconds", "note", "proposalGroupKey"]) || !text(exercise.exerciseRef, 160) || !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 12 || !repRange(exercise.repRange) || !Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 600 || (exercise.note !== null && exercise.note !== undefined && !text(exercise.note, 500)) || (exercise.proposalGroupKey !== undefined && exercise.proposalGroupKey !== null && !identity(exercise.proposalGroupKey))) fail("exercise"); if (exercise.proposalGroupKey) groups.set(exercise.proposalGroupKey.trim(), (groups.get(exercise.proposalGroupKey.trim()) ?? 0) + 1); });
    if ([...groups.values()].some((count) => count < 2)) fail("superset");
  };
  value.program.days.forEach(groupCheck);
  if (value.program.days.reduce((count, day) => count + day.exercises.length, 0) > 50) fail("size");
  return { explanation: value.explanation.trim(), candidate: { proposalType: "create_program", program: value.program } };
}
export function programGenerationDiagnostics(result) {
  const raw = typeof result?.text === "string" ? result.text : "";
  let routineCount = null;
  try {
    const candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    if (Array.isArray(candidate?.program?.days)) routineCount = candidate.program.days.length;
  } catch { /* A partial response is intentionally not retained or logged. */ }
  return {
    actualModel: typeof result?.model === "string" ? result.model : null,
    providerOutputTokens: Number.isFinite(result?.usage?.outputTokens) ? result.usage.outputTokens : null,
    providerFinishReason: typeof result?.finishReason === "string" ? result.finishReason : null,
    responseCharacterLength: raw.length,
    routineCount,
  };
}
export async function generateRobProgramCandidate(data, { provider, maxOutputTokens }) {
  const { requirements } = validateProgramGenerationRequest(data);
  const result = await provider.generate({ messages: programGenerationMessages(requirements), maxOutputTokens });
  const diagnostics = programGenerationDiagnostics(result);
  try {
    return { model: result.model, usage: result.usage, finishReason: result.finishReason ?? null, diagnostics, ...parseProgramCandidate(result.text, requirements) };
  } catch (error) {
    error.programGenerationDiagnostic = diagnostics;
    error.programGenerationFailureCategory = diagnostics.providerFinishReason === "length" ? "output_exhausted" : "candidate_validation";
    throw error;
  }
}