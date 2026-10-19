export function validateNevfitCatalogue({ catalogue, registry, taxonomy, crosswalk, wgerSnapshot, expectedCount = null }) {
  const errors = [];
  const entries = catalogue?.entries ?? [];
  const registryEntries = registry?.entries ?? [];
  const relationships = crosswalk?.relationships ?? [];
  const muscleIds = new Set(taxonomy?.muscles?.map((item) => item.id) ?? []);
  const equipmentIds = new Set(taxonomy?.equipmentCategories ?? []);
  const movementIds = new Set(taxonomy?.movementPatterns ?? []);
  const wgerIds = new Set(wgerSnapshot?.exercises?.map((item) => item.id) ?? []);
  const registeredIds = new Set(registryEntries.map((item) => item.id));
  const canonicalIds = new Set();
  const displayNames = new Set();
  const selectedWgerIds = new Set();
  if (expectedCount !== null && entries.length !== expectedCount) errors.push(`count:${entries.length}`);
  if (registryEntries.length !== entries.length || registeredIds.size !== registryEntries.length) errors.push("registry_identity_count_or_uniqueness");
  if (catalogue?.activationStatus !== "offline_only" || crosswalk?.activationStatus !== "offline_only") errors.push("unexpected_activation_status");
  for (const entry of entries) {
    if (!/^nevfit-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || canonicalIds.has(entry.id) || !registeredIds.has(entry.id)) errors.push(`identity:${entry.id}`);
    canonicalIds.add(entry.id);
    const nameKey = entry.displayName?.trim().toLowerCase();
    if (!nameKey || displayNames.has(nameKey)) errors.push(`display_name:${entry.id}`);
    displayNames.add(nameKey);
    if (!Array.isArray(entry.aliases) || !entry.aliases.every((alias) => typeof alias === "string" && alias.trim())) errors.push(`aliases:${entry.id}`);
    if (!equipmentIds.has(entry.equipmentCategory)) errors.push(`equipment:${entry.id}`);
    if (!movementIds.has(entry.movementPattern)) errors.push(`movement:${entry.id}`);
    if (!Array.isArray(entry.primaryMuscles) || !entry.primaryMuscles.length) errors.push(`primary_missing:${entry.id}`);
    for (const field of ["primaryMuscles", "secondaryMuscles", "subdivisions"]) {
      if (!Array.isArray(entry[field]) || new Set(entry[field]).size !== entry[field].length || entry[field].some((id) => !muscleIds.has(id))) errors.push(`${field}:${entry.id}`);
    }
    if (entry.secondaryMuscles?.some((id) => entry.primaryMuscles?.includes(id))) errors.push(`primary_secondary_overlap:${entry.id}`);
    if (!entry.metadata?.provenance?.sourceRow || !["provisional", "partially_reviewed", "verified"].includes(entry.metadata.status)) errors.push(`provenance:${entry.id}`);
    const reference = entry.externalReferences?.wger;
    if (reference) {
      if (!wgerIds.has(reference.id) || selectedWgerIds.has(reference.id)) errors.push(`wger_reference:${entry.id}`);
      selectedWgerIds.add(reference.id);
    }
    const candidate = entry.externalReferences?.candidateWgerId;
    if (candidate && !wgerIds.has(candidate)) errors.push(`wger_candidate:${entry.id}`);
    for (const field of ["description", "instructions"]) if (entry[field] !== undefined && typeof entry[field] !== "string") errors.push(`${field}:${entry.id}`);
    if (entry.attribution !== undefined && (!Array.isArray(entry.attribution) || entry.attribution.some((item) => typeof item?.source !== "string"))) errors.push(`attribution:${entry.id}`);
    if (entry.media !== undefined) {
      const media = entry.media;
      if (typeof media !== "object" || media === null || !Array.isArray(media.imageReferences ?? []) || !Array.isArray(media.videoReferences ?? []) || [...(media.imageReferences ?? []), ...(media.videoReferences ?? [])].some((item) => typeof item?.url !== "string" || typeof item?.source !== "string")) errors.push(`media:${entry.id}`);
    }
  }
  if (relationships.length !== 28 || new Set(relationships.map((item) => item.historicalWgerId)).size !== relationships.length) errors.push("legacy_count_or_uniqueness");
  for (const relation of relationships) {
    if (!canonicalIds.has(relation.nevfitId) || !wgerIds.has(relation.historicalWgerId)) errors.push(`legacy_target:${relation.nevfitId}`);
    if (relation.preferredWgerId && !wgerIds.has(relation.preferredWgerId)) errors.push(`preferred_reference:${relation.nevfitId}`);
    if (relation.automaticHistoryAttributionAllowed !== false || !relation.ambiguityStatus) errors.push(`unsafe_legacy_link:${relation.nevfitId}`);
  }
  return { valid: errors.length === 0, errors, counts: { catalogue: entries.length, registry: registryEntries.length, legacy: relationships.length, selectedWger: selectedWgerIds.size, withoutWger: entries.length - selectedWgerIds.size } };
}
