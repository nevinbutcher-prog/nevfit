import catalogue from "../../../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };

export const ROB_CATALOGUE_VERSION = catalogue.version;
export const ROB_CATALOGUE_INPUT_CHAR_BUDGET = 36000;
const capabilities = { dumbbells: "dumbbell", barbell: "barbell", cables: "cable", machines: "machine", bench: "bench", pull_up_equipment: "pull up" };
const movement = (entry) => {
  const n = entry.name.toLowerCase();
  if (/squat|lunge|leg press|step.up/.test(n)) return "knee_dominant";
  if (/deadlift|good morning|hip thrust|glute bridge|pull through/.test(n)) return "hinge";
  if (/bench press|chest press|push.?up|dip/.test(n)) return "horizontal_push";
  if (/shoulder press|overhead press|military press/.test(n)) return "vertical_push";
  if (/row/.test(n)) return "horizontal_pull";
  if (/pull.?up|pulldown/.test(n)) return "vertical_pull";
  if (/curl|extension|raise|fly|calf/.test(n)) return "isolation";
  if (/plank|twist|crunch|woodchop/.test(n)) return "core";
  return "other";
};
const eligible = (entry, requirements, excluded) => {
  if (excluded.has(entry.id) || !entry.name || !Array.isArray(entry.equipment)) return false;
  const actual = entry.equipment.join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  // Empty WGER metadata is unknown, not evidence of bodyweight eligibility.
  if (!actual) return false;
  if (requirements.environment === "minimal_equipment") return /bodyweight|band|none/.test(actual);
  const selected = requirements.equipment ?? [];
  if (!selected.length) return false;
  const available = selected.map((item) => capabilities[item] ?? item);
  if (actual.includes("bodyweight") || actual.includes("none")) return true;
  const required = Object.values(capabilities).filter((item) => actual.includes(item));
  return required.length > 0 && required.every((item) => available.includes(item));
};
const score = (entry, requirements) => {
  const terms = [entry.name, entry.primaryMuscle, entry.bodyPart].join(" ").toLowerCase();
  const emphasis = (requirements.priorities ?? []).some((item) => terms.includes(item.replace(/s$/, ""))) ? 4 : 0;
  return emphasis + (movement(entry) !== "other" ? 2 : 0) - (/isometric|stretch|test|warm.?up/i.test(entry.name) ? 5 : 0);
};
export function buildRobExerciseCatalogue({ requirements = {}, excludedExerciseIds = [] } = {}) {
  const excluded = new Set(Array.isArray(excludedExerciseIds) ? excludedExerciseIds.filter((id) => typeof id === "string") : []);
  const unique = new Map();
  for (const entry of catalogue.exercises) if (eligible(entry, requirements, excluded)) { const key = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); if (!unique.has(key) || score(entry, requirements) > score(unique.get(key), requirements)) unique.set(key, entry); }
  return { version: catalogue.version, entries: [...unique.values()], excludedExerciseIds: [...excluded].filter((id) => catalogue.exercises.some((entry) => entry.id === id)) };
}
export function selectRobGenerationCandidates(full, requirements) {
  const ranked = [...(full?.entries ?? [])].sort((a, b) => score(b, requirements) - score(a, requirements) || a.name.localeCompare(b.name));
  const entries = [], used = new Set(); let serializedChars = 0;
  for (const kind of ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "knee_dominant", "hinge", "core", "isolation"]) { const entry = ranked.find((candidate) => movement(candidate) === kind && !used.has(candidate.id)); if (entry) { entries.push(entry); used.add(entry.id); serializedChars += JSON.stringify(entry).length; } }
  for (const entry of ranked) { const size = JSON.stringify(entry).length + 1; if (!used.has(entry.id) && serializedChars + size <= ROB_CATALOGUE_INPUT_CHAR_BUDGET) { entries.push(entry); used.add(entry.id); serializedChars += size; } }
  return { version: full?.version, entries, serializedChars, coverage: [...new Set(entries.map(movement))] };
}
