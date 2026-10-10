import { AiError } from "../ai/aiErrors.js";
import { ROB_CATALOGUE_VERSION, SERVER_CATALOGUE, authorizeRobCatalogue } from "./robExerciseCatalogue.js";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const invalid = (reason) => { const error = new AiError("ai_invalid_request"); error.validationDiagnostic = { reason }; throw error; };
const fail = (reason) => { const error = new AiError("ai_invalid_response", { retryable: true }); error.validationDiagnostic = { reason }; throw error; };
const allowed = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const EXERCISE_FIELDS = ["exerciseId", "sets", "repRange", "restSeconds", "note", "proposalGroupKey"];
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
const movement = (entry) => {
  const name = String(entry?.name ?? "").toLowerCase();
  if (/crawl|punch/.test(name)) return "other";
  if (/squat|lunge|leg press|step.up/.test(name)) return "knee_dominant";
  if (/deadlift|good morning|hip thrust|glute bridge|pull through/.test(name)) return "hinge";
  if (/bench press|chest press|push.?up|dip/.test(name)) return "horizontal_push";
  if (/shoulder press|overhead press|military press/.test(name)) return "vertical_push";
  if (/row/.test(name)) return "horizontal_pull";
  if (/pull.?up|pulldown/.test(name)) return "vertical_pull";
  if (/curl|extension|raise|fly|calf/.test(name)) return "isolation";
  if (/plank|twist|crunch|woodchop/.test(name)) return "core";
  return "other";
};
const muscleGroup = (entry) => {
  const terms = [entry?.primaryMuscle, entry?.bodyPart].filter(Boolean).join(" ").toLowerCase();
  if (/shoulder/.test(terms)) return "shoulders";
  if (/bicep|tricep|forearm|arms?/.test(terms)) return "arms";
  if (/chest|pectoral/.test(terms)) return "chest";
  if (/lat|back|trapez/.test(terms)) return "back";
  if (/quad|hamstring|calf|leg/.test(terms)) return "legs";
  if (/glute/.test(terms)) return "glutes";
  if (/abs|obliqu|core/.test(terms)) return "core";
  return "other";
};

export function validateProgramGenerationRequest(data) {
  if (!allowed(data, ["requirements", "catalogue"]) || !intakeValid(data.requirements)) invalid("requirements");
  const entries = data.catalogue && authorizeRobCatalogue(data.catalogue.version, data.catalogue.ids, data.requirements, data.catalogue.excludedExerciseIds);
  if (!entries) invalid("catalogue");
  return { requirements: data.requirements, catalogue: { version: ROB_CATALOGUE_VERSION, entries } };
}
export function programGenerationMessages(requirements, catalogue = { entries: [] }) {
  return [{ role: "system", content: `You are Rob. Return exactly one JSON object, no markdown. Design one complete coordinated training program for the confirmed requirements. Plan the whole week before choosing exercises: distribute demanding patterns across routines, use conventional foundational exercises where suitable, and avoid near-identical variations without a clear role. If priorities include "balanced", it is a whole-week coverage requirement: cover the major muscle groups and movement patterns. Other selected muscle priorities receive modest additional emphasis within that balanced week, not a dedicated routine every day. Return exactly ${requirements.daysPerWeek} routines. Every exercise must use this complete schema: {"exerciseId":"wger-73","sets":3,"repRange":"8-12","restSeconds":120,"note":null,"proposalGroupKey":null}. exerciseId must be one of the supplied verified catalogue IDs, exactly as provided. Never invent an ID or use an exercise name. sets must be an integer from 1 to 12. repRange must be a string formatted like "8-12" or "10" (whole repetitions, 1 to 100, ascending when ranged). restSeconds must be an integer number of seconds from 0 to 600. note must be null when no exercise-specific note is needed; otherwise it must be non-empty text. proposalGroupKey must be null by default: use a non-null valid group-key string only when a superset has a clear practical benefit. A non-null key uses letters, digits, dot, underscore, colon, or hyphen (starting with a letter or digit), and the same key must be used for two or more exercises in the same routine. All exercises use this schema. Do not include exercise names in exercise objects, provider metadata, program scheduling, or unsupported fields. Return schema: {"version":1,"proposalType":"create_program","program":{"name":"Name","summary":"Short summary","days":[{"name":"Routine name","focus":"Short focus","exercises":[{"exerciseId":"wger-723","sets":3,"repRange":"8-12","restSeconds":90,"note":null,"proposalGroupKey":null}]}]},"explanation":"Short explanation"}. For hypertrophy, make practical use of the confirmed duration, sets, rests, complexity, frequency, equipment, and constraints. Typical 45-, 60-, and 75-minute sessions often need progressively more work; 5-8 exercises is common for 60-75 minutes and about 6-8 is a useful 75-minute starting point, not a mandatory target. Do not pad a session to reach a count or claim duration is measured.` }, { role: "user", content: `CONFIRMED REQUIREMENTS:\n${JSON.stringify(requirements)}\nVERIFIED CATALOGUE (use only these IDs):\n${JSON.stringify(catalogue.entries)}` }];
}
export function programCandidateResponseFormat(catalogue = { entries: [] }) {
  const authorisedIds = catalogue.entries.map((entry) => entry.id);
  const exercise = {
    type: "object", additionalProperties: false, required: EXERCISE_FIELDS,
    properties: {
      exerciseId: { type: "string", enum: authorisedIds },
      sets: { type: "integer", minimum: 1, maximum: 12 },
      repRange: { type: "string", pattern: "^\\d{1,3}(?:\\s*-\\s*\\d{1,3})?$" },
      restSeconds: { type: "integer", minimum: 0, maximum: 600 },
      note: { type: ["string", "null"], minLength: 1, maxLength: 500, pattern: "\\S" },
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
}
export function parseProgramCandidate(raw, requirements, catalogue) {
  const authorisedIds = new Set(catalogue?.entries?.map((entry) => entry.id) ?? [...SERVER_CATALOGUE.keys()]);
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
      if (typeof exercise.exerciseId !== "string") failExercise(routineIndex, exerciseIndex, "exerciseId", "wrong_type");
      if (!authorisedIds.has(exercise.exerciseId)) failExercise(routineIndex, exerciseIndex, "exerciseId", "out_of_catalogue");
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
export function estimateRoutineWorkloadMinutes(day) {
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  const groupSizes = new Map();
  for (const exercise of exercises) if (exercise?.proposalGroupKey) groupSizes.set(exercise.proposalGroupKey, (groupSizes.get(exercise.proposalGroupKey) ?? 0) + 1);
  const exerciseMinutes = exercises.reduce((total, exercise) => {
    const sets = Number.isInteger(exercise?.sets) ? exercise.sets : 0;
    const restMinutes = Number.isInteger(exercise?.restSeconds) ? (exercise.restSeconds * Math.max(sets - 1, 0)) / 60 : 0;
    return total + (sets * 0.6) + restMinutes + 1.5;
  }, 8);
  // Pairing trims setup transitions only; it never assumes a superset removes prescribed recovery.
  const pairedTransitionSavings = [...groupSizes.values()].reduce((total, size) => total + (size >= 2 ? (size - 1) * 0.5 : 0), 0);
  return Math.max(0, Math.round((exerciseMinutes - pairedTransitionSavings) * 10) / 10);
}
export function assessProgramQuality(candidate, requirements, catalogue = { entries: [] }) {
  const concerns = [];
  const entries = new Map((catalogue.entries ?? []).map((entry) => [entry.id, entry]));
  const programExercises = candidate?.program?.days?.flatMap((day, routineIndex) => (day.exercises ?? []).map((exercise, exerciseIndex) => ({ ...exercise, routineIndex, exerciseIndex, entry: entries.get(exercise.exerciseId) }))) ?? [];
  const setsFor = (items) => items.reduce((total, item) => total + (Number.isInteger(item.sets) ? item.sets : 0), 0);
  for (const [routineIndex, day] of candidate.program.days.entries()) {
    const exerciseCount = day.exercises.length;
    const totalSets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const estimatedWorkloadMinutes = estimateRoutineWorkloadMinutes(day);
    if (requirements.sessionMinutes >= 75 && (exerciseCount < 5 || totalSets < 14 || estimatedWorkloadMinutes < requirements.sessionMinutes * 0.55)) concerns.push({ routineIndex, code: "underfilled_duration", estimatedWorkloadMinutes });
    else if (requirements.sessionMinutes >= 60 && (exerciseCount < 3 || totalSets < 8)) concerns.push({ routineIndex, code: "limited_workload", estimatedWorkloadMinutes });
    else if (requirements.sessionMinutes >= 45 && (exerciseCount < 2 || totalSets < 5)) concerns.push({ routineIndex, code: "limited_workload", estimatedWorkloadMinutes });
    const routineItems = programExercises.filter((item) => item.routineIndex === routineIndex && item.entry);
    const groups = new Map();
    for (const item of routineItems) groups.set(muscleGroup(item.entry), (groups.get(muscleGroup(item.entry)) ?? 0) + item.sets);
    const dominant = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant && totalSets >= 12 && dominant[1] / totalSets > 0.65) concerns.push({ routineIndex, code: "routine_muscle_concentration", muscleGroup: dominant[0] });
  }
  if (!programExercises.length || !entries.size) return { concerns };
  const totalSets = setsFor(programExercises);
  const groupSets = new Map();
  for (const item of programExercises) { const group = muscleGroup(item.entry); groupSets.set(group, (groupSets.get(group) ?? 0) + item.sets); }
  if ((requirements.priorities ?? []).includes("balanced")) {
    for (const group of ["chest", "back", "legs"]) if ((groupSets.get(group) ?? 0) < 4) concerns.push({ code: "major_muscle_group_underrepresented", muscleGroup: group, workingSets: groupSets.get(group) ?? 0 });
    const patterns = new Set(programExercises.map((item) => movement(item.entry)));
    const foundational = ["horizontal_push", "horizontal_pull", "knee_dominant", "hinge"].filter((pattern) => patterns.has(pattern));
    if (foundational.length < 3) concerns.push({ code: "limited_movement_pattern_coverage", patterns: foundational });
  }
  const priorities = (requirements.priorities ?? []).filter((priority) => priority !== "balanced");
  for (const priority of priorities) {
    const prioritySets = groupSets.get(priority) ?? 0;
    if (totalSets >= 20 && prioritySets / totalSets > 0.45) concerns.push({ code: "priority_overconcentration", muscleGroup: priority, workingSets: prioritySets, totalWorkingSets: totalSets });
  }
  const repeated = new Map();
  for (const item of programExercises) {
    const key = `${movement(item.entry)}:${muscleGroup(item.entry)}`;
    repeated.set(key, (repeated.get(key) ?? []).concat(item));
  }
  for (const [key, items] of repeated) if (items.length >= 5 && setsFor(items) / totalSets > 0.4) concerns.push({ code: "redundant_exercise_selection", movementPattern: key.split(":")[0], muscleGroup: key.split(":")[1], exerciseCount: items.length });
  return { concerns };
}

export function programGenerationDiagnostics(result) {
  const raw = typeof result?.text === "string" ? result.text : "";
  let routineCount = null;
  try { const candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "")); if (Array.isArray(candidate?.program?.days)) routineCount = candidate.program.days.length; } catch { /* A partial response is intentionally not retained or logged. */ }
  return { actualModel: typeof result?.model === "string" ? result.model : null, providerOutputTokens: Number.isFinite(result?.usage?.outputTokens) ? result.usage.outputTokens : null, providerFinishReason: typeof result?.finishReason === "string" ? result.finishReason : null, responseCharacterLength: raw.length, routineCount };
}
export async function generateRobProgramCandidate(data, { provider, maxOutputTokens }) {
  const { requirements, catalogue } = validateProgramGenerationRequest(data);
  const result = await provider.generate({ messages: programGenerationMessages(requirements, catalogue), maxOutputTokens, responseFormat: programCandidateResponseFormat(catalogue), requireResponseFormat: true });
  const diagnostics = programGenerationDiagnostics(result);
  try {
    const parsed = parseProgramCandidate(result.text, requirements, catalogue);
    return { model: result.model, usage: result.usage, finishReason: result.finishReason ?? null, diagnostics, ...parsed, catalogue, quality: assessProgramQuality(parsed.candidate, requirements, catalogue) };
  } catch (error) { error.programGenerationDiagnostic = diagnostics; error.programGenerationFailureCategory = diagnostics.providerFinishReason === "length" ? "output_exhausted" : "candidate_validation"; throw error; }
}
