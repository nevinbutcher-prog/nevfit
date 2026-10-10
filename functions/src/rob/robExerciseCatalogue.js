import catalogue from "./robExerciseCatalogue.v2.json" with { type: "json" };

export const ROB_CATALOGUE_VERSION = catalogue.version;
export const SERVER_CATALOGUE = new Map(catalogue.exercises.map((entry) => [entry.id, entry]));
const capabilities = { dumbbells: "dumbbell", barbell: "barbell", cables: "cable", machines: "machine", bench: "bench", pull_up_equipment: "pull up" };
const eligible = (entry, requirements, exclusions) => {
  if (exclusions.has(entry.id)) return false;
  const actual = entry.equipment.join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (!actual) return false;
  if (requirements.environment === "minimal_equipment") return /bodyweight|band|none/.test(actual);
  const available = (requirements.equipment ?? []).map((item) => capabilities[item] ?? item);
  if (actual.includes("bodyweight") || actual.includes("none")) return true;
  const required = Object.values(capabilities).filter((item) => actual.includes(item));
  return required.length > 0 && required.every((item) => available.includes(item));
};
export function authorizeRobCatalogue(version, ids, requirements = {}, excludedExerciseIds = []) {
  if (version !== ROB_CATALOGUE_VERSION || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return null;
  const entries = ids.map((id) => SERVER_CATALOGUE.get(id));
  const exclusions = new Set(Array.isArray(excludedExerciseIds) ? excludedExerciseIds : []);
  return entries.every(Boolean) && entries.every((entry) => eligible(entry, requirements, exclusions)) ? entries : null;
}
