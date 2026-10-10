import catalogue from "../../../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };

export const ROB_CATALOGUE_VERSION = catalogue.version;
export const ROB_CATALOGUE_INPUT_CHAR_BUDGET = 36000;
const capabilities = { dumbbells: "dumbbell", barbell: "barbell", cables: "cable", machines: "machine", bench: "bench", pull_up_equipment: "pull up" };
const movement = (entry) => {
  const n = entry.name.toLowerCase();
  if (/crawl|punch/.test(n)) return "other";
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
const muscleGroup = (entry) => {
  const terms = [entry.primaryMuscle, entry.bodyPart].filter(Boolean).join(" ").toLowerCase();
  if (/shoulder/.test(terms)) return "shoulders";
  if (/bicep|tricep|forearm|arms?/.test(terms)) return "arms";
  if (/chest|pectoral/.test(terms)) return "chest";
  if (/lat|back|trapez/.test(terms)) return "back";
  if (/quad|hamstring|calf|leg/.test(terms)) return "legs";
  if (/glute/.test(terms)) return "glutes";
  if (/abs|obliqu|core/.test(terms)) return "core";
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
  const priorities = new Set((requirements.priorities ?? []).filter((item) => item !== "balanced"));
  // A selected muscle is an emphasis, not a reason to crowd out the rest of the catalogue.
  const emphasis = priorities.has(muscleGroup(entry)) ? 0.25 : 0;
  const conventional = movement(entry) === "other" ? -2 : 2;
  return emphasis + conventional - (/isometric|stretch|test|warm.?up/i.test(entry.name) ? 5 : 0);
};
export function buildRobExerciseCatalogue({ requirements = {}, excludedExerciseIds = [] } = {}) {
  const excluded = new Set(Array.isArray(excludedExerciseIds) ? excludedExerciseIds.filter((id) => typeof id === "string") : []);
  const unique = new Map();
  for (const entry of catalogue.exercises) if (eligible(entry, requirements, excluded)) { const key = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); if (!unique.has(key) || score(entry, requirements) > score(unique.get(key), requirements)) unique.set(key, entry); }
  return { version: catalogue.version, entries: [...unique.values()], excludedExerciseIds: [...excluded].filter((id) => catalogue.exercises.some((entry) => entry.id === id)) };
}
export function selectRobGenerationCandidates(full, requirements) {
  const ranked = [...(full?.entries ?? [])].sort((a, b) => score(b, requirements) - score(a, requirements) || a.name.localeCompare(b.name));
  const entries = [], used = new Set(), movementCounts = new Map(), muscleCounts = new Map(); let serializedChars = 0;
  const add = (entry) => { entries.push(entry); used.add(entry.id); serializedChars += JSON.stringify(entry).length + 1; movementCounts.set(movement(entry), (movementCounts.get(movement(entry)) ?? 0) + 1); muscleCounts.set(muscleGroup(entry), (muscleCounts.get(muscleGroup(entry)) ?? 0) + 1); };
  // Establish a usable conventional movement base before allowing a priority to add variety.
  for (const kind of ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "knee_dominant", "hinge", "core", "isolation"]) { const entry = ranked.find((candidate) => movement(candidate) === kind && !used.has(candidate.id)); if (entry) add(entry); }
  // Diminishing returns keep a large source catalogue balanced without imposing muscle quotas or a fixed exercise count.
  while (true) {
    const next = ranked.filter((entry) => !used.has(entry.id)).map((entry) => ({ entry, value: score(entry, requirements) + (3 / (1 + (movementCounts.get(movement(entry)) ?? 0))) + (3 / (1 + (muscleCounts.get(muscleGroup(entry)) ?? 0))) })).sort((a, b) => b.value - a.value || a.entry.name.localeCompare(b.entry.name))[0];
    if (!next || next.value < 3) break;
    const size = JSON.stringify(next.entry).length + 1;
    if (serializedChars + size > ROB_CATALOGUE_INPUT_CHAR_BUDGET) break;
    add(next.entry);
  }
  return { version: full?.version, entries, serializedChars, coverage: [...new Set(entries.map(movement))] };
}
