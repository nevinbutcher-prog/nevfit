import overlay from "../data/exerciseMetadataOverlay.v1.json" with { type: "json" };

const entries = new Map(overlay.entries.map((entry) => [entry.id, entry]));

export function getNevfitExerciseMetadata(id) {
  return entries.get(id) ?? null;
}

export function applyNevfitExerciseMetadata(exercise, { enabled = true } = {}) {
  if (!enabled || !exercise || exercise.source !== "wger") return exercise;
  const metadata = entries.get(exercise.id);
  if (!metadata) return exercise;
  return {
    ...exercise,
    name: metadata.displayName ?? exercise.name,
    aliases: [...new Set([...(exercise.aliases ?? []), ...metadata.aliases])],
    equipment: metadata.equipment ?? exercise.equipment,
    primaryMuscle: metadata.primaryMuscles?.[0] ?? exercise.primaryMuscle,
    primaryMuscles: metadata.primaryMuscles ?? (exercise.primaryMuscle ? [exercise.primaryMuscle] : []),
    secondaryMuscles: metadata.secondaryMuscles ?? exercise.secondaryMuscles,
    subdivisions: metadata.subdivisions,
    nevfitMetadata: {
      version: overlay.metadataVersion,
      reviewStatus: metadata.reviewStatus,
      confidence: metadata.confidence,
      provenance: metadata.provenance,
    },
  };
}
