import catalogue from "./robExerciseCatalogue.v2.json" with { type: "json" };
import nevfitCatalogue from "./nevfitExerciseCatalogue.v1.json" with { type: "json" };

export const ROB_CATALOGUE_VERSION = catalogue.version;
export const SERVER_CATALOGUE = new Map([...catalogue.exercises, ...nevfitCatalogue.exercises].map((entry) => [entry.id, entry]));
const catalogues = new Map([[catalogue.version, catalogue.exercises], [nevfitCatalogue.version, nevfitCatalogue.exercises]]);
const capabilities = { dumbbells: "dumbbell", barbell: "barbell", cables: "cable", machines: "machine", bench: "bench", pull_up_equipment: "pull up" };
export const eligibleRobCatalogueEntry = (entry, requirements, exclusions = new Set()) => {
  if (exclusions.has(entry.id)) return false;
  const actual = entry.equipment.join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (!actual) return false;
  if (requirements.environment === "minimal_equipment") return /bodyweight|band|none/.test(actual);
  const available = (requirements.equipment ?? []).map((item) => capabilities[item] ?? item);
  if (actual.includes("bodyweight") || actual.includes("none")) return true;
  const required = Object.values(capabilities).filter((item) => actual.includes(item));
  return required.length > 0 && required.every((item) => available.includes(item));
};
// Future fulfilment integration must construct this inside Firebase from
// confirmed requirements and server-owned exclusions. It deliberately accepts
// no browser catalogue snapshot, display metadata, or browser exclusion claim.
export function createServerAuthorisedRobCatalogue(requirements, serverExcludedExerciseIds = [], version = ROB_CATALOGUE_VERSION) {
  const source = catalogues.get(version);
  if (!source) return null;
  const exclusions = new Set(Array.isArray(serverExcludedExerciseIds) ? serverExcludedExerciseIds.filter((id) => typeof id === "string") : []);
  return Object.freeze({ version, ids: source.filter((entry) => eligibleRobCatalogueEntry(entry, requirements, exclusions)).map((entry) => entry.id), excludedExerciseIds: [...exclusions].filter((id) => source.some((entry) => entry.id === id)) });
}
export function authorizeRobCatalogue(version, ids, requirements = {}, excludedExerciseIds = []) {
  const source = catalogues.get(version);
  if (!source || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return null;
  const authorised = new Map(source.map((entry) => [entry.id, entry]));
  const entries = ids.map((id) => authorised.get(id));
  const exclusions = new Set(Array.isArray(excludedExerciseIds) ? excludedExerciseIds : []);
  return entries.every(Boolean) && entries.every((entry) => eligibleRobCatalogueEntry(entry, requirements, exclusions)) ? entries : null;
}
