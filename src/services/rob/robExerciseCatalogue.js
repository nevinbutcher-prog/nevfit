export const ROB_CATALOGUE_VERSION = 1;
export const ROB_CATALOGUE_MAX_SIZE = 32;
export const ROB_CATALOGUE_MIN_SIZE = 8;

// Reviewed WGER identities. The browser only includes records returned by the
// existing provider; the callable independently owns the same identifier set.
export const ROB_CATALOGUE_IDS = new Set([
  "wger-73", "wger-76", "wger-145", "wger-148", "wger-237", "wger-371",
  "wger-458", "wger-475", "wger-530", "wger-538", "wger-567", "wger-577",
  "wger-723", "wger-822", "wger-1088", "wger-1193", "wger-1370", "wger-1466",
  "wger-1691", "wger-1690", "wger-1695", "wger-1801", "wger-2626", "wger-2628",
  "wger-2669", "wger-500", "wger-580", "wger-1001", "wger-1288", "wger-1307",
  "wger-1406", "wger-1410", "wger-1489", "wger-1766", "wger-1911",
]);
const text = (value) => typeof value === "string" ? value.trim() : "";
const EQUIPMENT = { dumbbells: "dumbbell", barbell: "barbell", cables: "cable", machines: "machine", bench: "bench", pull_up_equipment: "pull up" };
const PRIORITY = { chest: ["chest", "pectoral"], back: ["back", "lat"], legs: ["quad", "hamstring", "leg"], glutes: ["glute"], shoulders: ["shoulder", "delt"], arms: ["bicep", "tricep"], core: ["abs", "core", "oblique"] };
const record = (exercise) => exercise && ROB_CATALOGUE_IDS.has(exercise.id) && text(exercise.name) && Array.isArray(exercise.equipment)
  ? { id: exercise.id, name: text(exercise.name), equipment: exercise.equipment.map(text).filter(Boolean), primaryMuscle: text(exercise.primaryMuscle), bodyPart: text(exercise.bodyPart), source: "wger" }
  : null;
const equipmentMatches = (exercise, requirements) => {
  const selected = Array.isArray(requirements?.equipment) ? requirements.equipment : [];
  const actual = exercise.equipment.join(" ").toLowerCase();
  if (requirements?.environment === "minimal_equipment") return /bodyweight|band|none/.test(actual);
  if (!selected.length || requirements?.environment === "commercial_gym" || requirements?.environment === "both") return true;
  return selected.some((entry) => actual.includes(EQUIPMENT[entry] ?? ""));
};
const relevance = (exercise, requirements) => {
  const haystack = [exercise.name, exercise.primaryMuscle, exercise.bodyPart].join(" ").toLowerCase();
  return (requirements?.priorities ?? []).reduce((score, priority) => score + (PRIORITY[priority]?.some((word) => haystack.includes(word)) ? 3 : 0), 0);
};
export function buildRobExerciseCatalogue(exercises, { requirements = {}, excludedExerciseIds = [] } = {}) {
  const excluded = new Set(Array.isArray(excludedExerciseIds) ? excludedExerciseIds.filter((id) => typeof id === "string") : []);
  const byName = new Map();
  for (const source of Array.isArray(exercises) ? exercises : []) {
    const exercise = record(source);
    if (!exercise || excluded.has(exercise.id) || !equipmentMatches(exercise, requirements)) continue;
    const key = exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const existing = byName.get(key);
    if (!existing || exercise.id.localeCompare(existing.id) < 0) byName.set(key, exercise);
  }
  const entries = [...byName.values()].sort((a, b) => relevance(b, requirements) - relevance(a, requirements) || a.name.localeCompare(b.name)).slice(0, ROB_CATALOGUE_MAX_SIZE);
  return { version: ROB_CATALOGUE_VERSION, entries, excludedExerciseIds: [...excluded].filter((id) => ROB_CATALOGUE_IDS.has(id)) };
}
export function catalogueFingerprint(catalogue, requirements) {
  return JSON.stringify({ version: catalogue?.version, ids: (catalogue?.entries ?? []).map((entry) => entry.id), requirements });
}
