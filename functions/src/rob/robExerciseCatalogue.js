import catalogue from "./robExerciseCatalogue.v2.json" with { type: "json" };

export const ROB_CATALOGUE_VERSION = catalogue.version;
export const SERVER_CATALOGUE = new Map(catalogue.exercises.map((entry) => [entry.id, entry]));
export function authorizeRobCatalogue(version, ids) {
  if (version !== ROB_CATALOGUE_VERSION || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return null;
  const entries = ids.map((id) => SERVER_CATALOGUE.get(id));
  return entries.every(Boolean) ? entries : null;
}
