import { AiError } from "../ai/aiErrors.js";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const invalid = (reason) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = { reason }; throw error; };
const fail = (reason) => { const error = new AiError("ai_invalid_response", { retryable: true }); error.validationDiagnostic = { reason }; throw error; };
const allowed = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const EXERCISE_FIELDS = ["exerciseRef", "sets", "repRange", "restSeconds", "note", "proposalGroupKey"];
const failExercise = (routineIndex, exerciseIndex, field, fieldReason) => {
  const error = new AiError("ai_invalid_response", { retryable: true });
  // Structural metadata only: never include an exercise value or provider output.
  error.validationDiagnostic = { reason: "exercise", routineIndex, exerciseIndex, field, fieldReason };
  throw error;
};
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
  && value.version === 1 && GOALS.has(value.goal)
  && (value.goal !== "other" || (typeof value.goalDescription === "string" && value.goalDescription.trim() && value.goalDescription.length <= 160))
  && optionalText(value.goalDescription, 160) && Number.isInteger(value.daysPerWeek) && value.daysPerWeek >= 1 && value.daysPerWeek <= 6
  && Number.isInteger(value.sessionMinutes) && value.sessionMinutes >= 20 && value.sessionMinutes <= 180
  && list(value.priorities, PRIORITIES, 6) && optionalText(value.priorityNote, 240) && ENVIRONMENTS.has(value.environment)
  && list(value.equipment, EQUIPMENT, 8) && optionalText(value.equipmentOther, 160)
  && typeof value.constraints === "string" && value.constraints.length <= 360;

export function validateProgramGenerationRequest(data) {
  if (!allowed(data, ["requirements"]) || !intakeValid(data.requirements)) invalid("requirements");
  return { requirements: data.requirements };
}
export function programGenerationMessages(requirements) {
  return [{ role: "system", content: `You are Rob. Return exactly one JSON object, no markdown. Design one complete coordinated training program for the confirmed requirements. Return exactly ${requirements.daysPerWeek} routines. Every exercise must use this complete schema: {"exerciseRef":"exercise name","sets":3,"repRange":"8-12","restSeconds":120,"note":null,"proposalGroupKey":null}. exerciseRef must be a non-empty exercise-name string. sets must be an integer from 1 to 12. repRange must be a string formatted like "8-12" or "10" (whole repetitions, 1 to 100, ascending when ranged). restSeconds must be an integer number of seconds from 0 to 600. note must be a string or null. proposalGroupKey must be null by default: use a non-null valid group-key string only when a superset has a clear practical benefit. A non-null key uses letters, digits, dot, underscore, colon, or hyphen (starting with a letter or digit), and the same key must be used for two or more exercises in the same routine. All exercises use this schema. Do not include Fitbot IDs, exerciseId, program metadata, scheduling, or unsupported fields. Return schema: {"version":1,"proposalType":"create_program","program":{"name":"Name","summary":"Short summary","days":[{"name":"Routine name","focus":"Short focus","exercises":[{"exerciseRef":"Cable row","sets":3,"repRange":"8-12","restSeconds":90,"note":"Pause at contraction.","proposalGroupKey":null},{"exerciseRef":"Lat pulldown","sets":3,"repRange":"10","restSeconds":90,"note":null,"proposalGroupKey":null},{"exerciseRef":"Rear delt fly","sets":3,"repRange":"12-15","restSeconds":60,"note":null,"proposalGroupKey":"pair-1"},{"exerciseRef":"Biceps curl","sets":3,"repRange":"10-12","restSeconds":60,"note":null,"proposalGroupKey":"pair-1"}]}]},"explanation":"Short explanation"}. Design coherent routines that cover the requested priorities and the muscle groups needed for a balanced program, while respecting the confirmed duration, frequency, equipment, and constraints. For hypertrophy goals, make each session practically useful: a typical 60-minute session often uses about 4-7 exercises, adjusted down or up for the actual duration, sets, rest periods, exercise complexity, frequency, equipment, and constraints. This is workload guidance, not a fixed minimum. Use user constraints and equipment; do not claim durations are measured.` }, { role: "user", content: `CONFIRMED REQUIREMENTS:\n${JSON.stringify(requirements)}` }];
}
export const programCandidateResponseFormat = (() => {
  const exercise = {
    type: "object", additionalProperties: false, required: EXERCISE_FIELDS,
    properties: {
      exerciseRef: { type: "string", minLength: 1, maxLength: 160 },
      sets: { type: "integer", minimum: 1, maximum: 12 },
      repRange: { type: "string", pattern: "^\\d{1,3}(?:\\s*-\\s*\\d{1,3})?$" },
      restSeconds: { type: "integer", minimum: 0, maximum: 600 },
      note: { type: ["string", "null"], maxLength: 500 },
      proposalGroupKey: { type: ["string", "null"], pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$", maxLength: 160 },
    },
  };
  const routine = {
    type: "object", additionalProperties: false, required: ["name", "focus", "exercises"],
    properties: { name: { type: "string", minLength: 1, maxLength: 160 }, focus: { type: "string", minLength: 1, maxLength: 200 }, exercises: { type: "array", minItems: 1, maxItems: 12, items: exercise } },
  };
  return Object.freeze({
    type: "json_schema",
    json_schema: {
      name: "rob_program_candidate", strict: true,
      schema: {
        type: "object", additionalProperties: false, required: ["version", "proposalType", "program", "explanation"],
        properties: {
          version: { type: "integer", const: 1 }, proposalType: { type: "string", const: "create_program" }, explanation: { type: "string", minLength: 1, maxLength: 1000 },
          program: { type: "object", additionalProperties: false, required: ["name", "summary", "days"], properties: { name: { type: "string", minLength: 1, maxLength: 160 }, summary: { type: "string", minLength: 1, maxLength: 600 }, days: { type: "array", minItems: 1, maxItems: 6, items: routine } } },
        },
      },
    },
  });
})();export function parseProgramCandidate(raw, requirements) {
  let value; try { value = JSON.parse(typeof raw === "string" ? raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "") : ""); } catch { fail("json"); }
  if (!allowed(value, ["version", "proposalType", "program", "explanation"]) || value.version !== 1 || value.proposalType !== "create_program" || !text(value.explanation, 1000) || !allowed(value.program, ["name", "summary", "days"]) || !text(value.program.name, 160) || !text(value.program.summary, 600) || !Array.isArray(value.program.days) || value.program.days.length !== requirements.daysPerWeek || value.program.days.length > 6) fail("candidate");
  const groupCheck = (day, routineIndex) => {
    if (!allowed(day, ["name", "focus", "exercises"]) || !text(day.name, 160) || !text(day.focus, 200) || !Array.isArray(day.exercises) || !day.exercises.length || day.exercises.length > 12) fail("routine");
    const groups = new Map();
    day.exercises.forEach((exercise, exerciseIndex) => {
      if (!object(exercise)) failExercise(routineIndex, exerciseIndex, "exercise", "wrong_type");
      const unexpected = Object.keys(exercise).find((key) => !EXERCISE_FIELDS.includes(key));
      if (unexpected) failExercise(routineIndex, exerciseIndex, ["exerciseId", "id"].includes(unexpected) ? unexpected : "unexpected_field", "unexpected_field");
      for (const field of EXERCISE_FIELDS) if (!(field in exercise)) failExercise(routineIndex, exerciseIndex, field, "missing");
      if (typeof exercise.exerciseRef !== "string") failExercise(routineIndex, exerciseIndex, "exerciseRef", "wrong_type");
      if (!text(exercise.exerciseRef, 160)) failExercise(routineIndex, exerciseIndex, "exerciseRef", "unsupported_format");
      if (!Number.isInteger(exercise.sets)) failExercise(routineIndex, exerciseIndex, "sets", "wrong_type");
      if (exercise.sets < 1 || exercise.sets > 12) failExercise(routineIndex, exerciseIndex, "sets", "unsupported_format");
      if (typeof exercise.repRange !== "string") failExercise(routineIndex, exerciseIndex, "repRange", "wrong_type");
      if (!repRange(exercise.repRange)) failExercise(routineIndex, exerciseIndex, "repRange", "unsupported_format");
      if (!Number.isInteger(exercise.restSeconds)) failExercise(routineIndex, exerciseIndex, "restSeconds", "wrong_type");
      if (exercise.restSeconds < 0 || exercise.restSeconds > 600) failExercise(routineIndex, exerciseIndex, "restSeconds", "unsupported_format");
      if (exercise.note !== null && typeof exercise.note !== "string") failExercise(routineIndex, exerciseIndex, "note", "wrong_type");
      if (exercise.note !== null && !text(exercise.note, 500)) failExercise(routineIndex, exerciseIndex, "note", "unsupported_format");
      if (exercise.proposalGroupKey !== null && typeof exercise.proposalGroupKey !== "string") failExercise(routineIndex, exerciseIndex, "proposalGroupKey", "wrong_type");
      if (exercise.proposalGroupKey !== null && !identity(exercise.proposalGroupKey)) failExercise(routineIndex, exerciseIndex, "proposalGroupKey", "unsupported_format");
      if (exercise.proposalGroupKey) groups.set(exercise.proposalGroupKey.trim(), (groups.get(exercise.proposalGroupKey.trim()) ?? 0) + 1);
    });
    day.exercises.forEach((exercise) => {
      if (exercise.proposalGroupKey && groups.get(exercise.proposalGroupKey.trim()) < 2) exercise.proposalGroupKey = null;
    });
  };
  value.program.days.forEach(groupCheck);
  if (value.program.days.reduce((count, day) => count + day.exercises.length, 0) > 50) fail("size");
  return { explanation: value.explanation.trim(), candidate: { proposalType: "create_program", program: value.program } };
}
export function programGenerationDiagnostics(result) {
  const raw = typeof result?.text === "string" ? result.text : "";
  let routineCount = null;
  try { const candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "")); if (Array.isArray(candidate?.program?.days)) routineCount = candidate.program.days.length; } catch { /* A partial response is intentionally not retained or logged. */ }
  return { actualModel: typeof result?.model === "string" ? result.model : null, providerOutputTokens: Number.isFinite(result?.usage?.outputTokens) ? result.usage.outputTokens : null, providerFinishReason: typeof result?.finishReason === "string" ? result.finishReason : null, responseCharacterLength: raw.length, routineCount };
}
export async function generateRobProgramCandidate(data, { provider, maxOutputTokens }) {
  const { requirements } = validateProgramGenerationRequest(data);
  const result = await provider.generate({ messages: programGenerationMessages(requirements), maxOutputTokens, responseFormat: programCandidateResponseFormat, requireResponseFormat: true });
  const diagnostics = programGenerationDiagnostics(result);
  try { return { model: result.model, usage: result.usage, finishReason: result.finishReason ?? null, diagnostics, ...parseProgramCandidate(result.text, requirements) }; } catch (error) { error.programGenerationDiagnostic = diagnostics; error.programGenerationFailureCategory = diagnostics.providerFinishReason === "length" ? "output_exhausted" : "candidate_validation"; throw error; }
}