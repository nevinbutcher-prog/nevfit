import catalogue from "../data/nevfitExerciseCatalogue.v1.json" with { type: "json" };
import taxonomy from "../data/nevfitMuscleTaxonomy.v1.json" with { type: "json" };

export const NEVFIT_CATALOGUE_VERSION = catalogue.catalogueVersion;
export const isNevfitCatalogueEnabled = (value) => value !== "false";
export const NEVFIT_CATALOGUE_ENABLED = isNevfitCatalogueEnabled(import.meta.env?.VITE_NEVFIT_CATALOGUE_ENABLED);
const labels = new Map(taxonomy.muscles.map(({ id, label }) => [id, label]));
const equipmentLabels = {
  barbell_ezbar: "Barbell / EZ bar", bodyweight: "Bodyweight", cable: "Cable",
  dumbbell: "Dumbbell", machine: "Machine", band: "Band",
  stability_ball: "Stability ball", ab_wheel: "Ab wheel",
};

export const NEVFIT_EXERCISES = Object.freeze(catalogue.entries.map((entry) => Object.freeze({
  id: entry.id,
  name: entry.displayName,
  originalName: entry.displayName,
  aliases: entry.aliases,
  category: entry.browseGroup,
  bodyPart: entry.browseGroup,
  primaryMuscle: labels.get(entry.primaryMuscles[0]) ?? entry.primaryMuscles[0],
  secondaryMuscles: entry.secondaryMuscles.map((id) => labels.get(id) ?? id),
  equipment: [equipmentLabels[entry.equipmentCategory] ?? entry.equipmentCategory,
    ...entry.accessoryEquipment.map((item) => equipmentLabels[item] ?? item)],
  images: [], imageUrl: null,
  defaultSets: 3, defaultRepRange: "8-12", defaultRestSeconds: 120,
  source: "nevfit", sourceId: entry.id,
  metadataStatus: entry.metadata.status,
  movementPattern: entry.movementPattern,
})));

const byId = new Map(NEVFIT_EXERCISES.map((entry) => [entry.id, entry]));
export const isNevfitExerciseId = (id) => byId.has(id);
export const getNevfitExerciseById = (id) => byId.get(id) ?? null;
export const isSupportedExerciseId = (id) => isNevfitExerciseId(id) || /^wger-[A-Za-z0-9._:-]+$/.test(id ?? "");
