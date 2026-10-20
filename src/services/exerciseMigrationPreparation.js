import crosswalk from "../../evaluation/nevfitHistoricalCrosswalk.v3.json" with { type: "json" };
import { validateBackup } from "./backupPayload.js";
import { createExerciseMigrationPlan, validateHistoricalMappings, validateMigrationDecisions } from "./exerciseIdentityMigration.js";

const occurrenceKey = ({ kind, docId, path, historicalWgerId, recordedName }) =>
  JSON.stringify([kind, docId, path, historicalWgerId, recordedName]);
const sourceIdentity = ({ kind, docId, path, historicalWgerId, recordedName, proposedNevfitId }) =>
  JSON.stringify([kind, docId, path, historicalWgerId, recordedName, proposedNevfitId]);
const sameSources = (a, b) => {
  if (a.length !== b.length) return false;
  const identities = new Map();
  for (const item of a) {
    const key = sourceIdentity(item);
    identities.set(key, (identities.get(key) ?? 0) + 1);
  }
  // A document path identifies one occurrence. Repeated identical identities
  // are invalid even if both inputs happen to contain the same duplicate.
  if ([...identities.values()].some((count) => count !== 1)) return false;
  for (const item of b) {
    const key = sourceIdentity(item);
    if (identities.get(key) !== 1) return false;
    identities.delete(key);
  }
  return identities.size === 0;
};

// Pure, read-only preparation. A fresh downloaded preflight and full backup
// must describe the same account snapshot before exact decisions are emitted.
export function prepareExactExerciseMigration({ preflight, backup, approvalManifest, mapping = crosswalk }) {
  const historical = validateHistoricalMappings(mapping);
  if (typeof preflight?.uid !== "string" || !preflight.uid.trim()
    || preflight.crosswalkVersion !== mapping.crosswalkVersion || !Array.isArray(preflight.occurrences)
    || !validateBackup(backup).valid || backup.version !== 2)
    throw new Error("A current matching preflight and readable version 2 full backup are required.");
  const baseline = createExerciseMigrationPlan({ ...backup, uid: preflight.uid, mapping });
  if (!sameSources(preflight.occurrences, baseline.occurrences)
    || JSON.stringify(preflight.counts) !== JSON.stringify(baseline.counts))
    throw new Error("Backup and preflight identities differ; obtain a fresh pair.");
  const proposed = new Set([...historical.values()].filter((item) => item.reviewClass === "B").map((item) => item.historicalWgerId));
  const approved = approvalManifest?.approvedStrongWgerIds;
  const rejected = approvalManifest?.rejectedStrongWgerIds;
  const exclusions = approvalManifest?.excludedOccurrences;
  if (!Array.isArray(approved) || !Array.isArray(rejected) || !Array.isArray(exclusions)
    || new Set([...approved, ...rejected]).size !== approved.length + rejected.length
    || [...approved, ...rejected].some((id) => !proposed.has(id)))
    throw new Error("Strong mapping approvals and rejections must name distinct pending WGER IDs.");
  const byKey = new Map(baseline.occurrences.map((item) => [occurrenceKey(item), item]));
  const excluded = new Map();
  for (const item of exclusions) {
    const key = occurrenceKey(item);
    const current = byKey.get(key);
    const relation = current && historical.get(current.historicalWgerId);
    if (!current || excluded.has(key) || typeof item.reason !== "string" || !item.reason.trim()
      || !relation?.nevfitId || !(relation.reviewClass === "A" || approved.includes(current.historicalWgerId)))
      throw new Error("An excluded occurrence must exactly match an approved current source and include a reason.");
    excluded.set(key, item.reason);
  }
  const decisions = [];
  for (const item of baseline.occurrences) {
    const relation = historical.get(item.historicalWgerId);
    if (!relation?.nevfitId || !(relation.reviewClass === "A" && relation.userConfirmation?.scope.includes(item.kind)
      || relation.reviewClass === "B" && approved.includes(item.historicalWgerId))) continue;
    const reason = excluded.get(occurrenceKey(item));
    decisions.push({ kind: item.kind, docId: item.docId, path: item.path,
      historicalWgerId: item.historicalWgerId, nevfitId: relation.nevfitId,
      recordedName: item.recordedName, confirmed: !reason,
      reason: reason ?? (relation.reviewClass === "A" ? relation.userConfirmation.reason : "Collective strong mapping approval recorded in the private approval manifest."),
    });
  }
  validateMigrationDecisions(decisions, mapping);
  const plan = createExerciseMigrationPlan({ ...backup, uid: preflight.uid, decisions, mapping });
  if (!sameSources(preflight.occurrences, plan.occurrences) || plan.conflicts.length
    || plan.confirmed.length !== decisions.filter((item) => item.confirmed).length)
    throw new Error("Prepared decisions conflict with the current account snapshot.");
  const pendingStrongWgerIds = [...proposed].filter((id) => !approved.includes(id) && !rejected.includes(id));
  const unresolvedObservedWgerIds = [...new Set(plan.occurrences.filter((item) => {
    const relation = historical.get(item.historicalWgerId);
    return !relation || relation.reviewClass === "C";
  }).map((item) => item.historicalWgerId))].sort();
  return { decisions, plan, review: {
    approvedStrongWgerIds: [...approved], rejectedStrongWgerIds: [...rejected], pendingStrongWgerIds,
    unresolvedObservedWgerIds,
    excludedOccurrenceCount: exclusions.length, confirmedOccurrenceCount: plan.confirmed.length,
    affectedDocumentCount: plan.expectedAffectedDocuments.length,
    reviewComplete: pendingStrongWgerIds.length === 0 && unresolvedObservedWgerIds.length === 0,
  } };
}
