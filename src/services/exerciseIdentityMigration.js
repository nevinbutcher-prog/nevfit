import crosswalk from "../../evaluation/nevfitHistoricalCrosswalk.v3.json" with { type: "json" };
import { isNevfitExerciseId } from "./nevfitCatalogue.js";

export const EXERCISE_MIGRATION_VERSION = 1;
const clone = (value) => structuredClone(value);
const isWger = (value) => typeof value === "string" && /^wger-[A-Za-z0-9._:-]+$/.test(value);
const fingerprint = (value) => JSON.stringify(value);

// A reviewed decision must name the historical ID, target ID and exact recorded
// name. A preferred WGER reference is never a source identity.
export function validateHistoricalMappings(mapping = crosswalk) {
  if (!Number.isInteger(mapping?.crosswalkVersion) || !Array.isArray(mapping.relationships)) throw new Error("Invalid historical crosswalk.");
  const seen = new Set();
  for (const item of mapping.relationships) {
    const requiresEvidence = mapping.crosswalkVersion >= 2 && (
      !["A", "B", "C", "D"].includes(item?.reviewClass)
      || item.mappingConfidence !== { A: "user_confirmed", B: "strong_proposed", C: "requires_clarification", D: "no_safe_match" }[item.reviewClass]
      || !Array.isArray(item.historicalRecordedNames) || item.historicalRecordedNames.some((name) => typeof name !== "string" || !name.trim())
      || !Number.isInteger(item.historicalNameMissingReferences) || item.historicalNameMissingReferences < 0
      || typeof item.evidence?.wgerSnapshotName !== "string" && item.evidence?.wgerSnapshotName !== null
      || !Array.isArray(item.evidence?.wgerSnapshotEquipment)
      || typeof item.provenance?.source !== "string" || !item.provenance.source.trim()
      || typeof item.reviewReason !== "string" || !item.reviewReason.trim()
    );
    if (!/^wger-[0-9]+$/.test(item?.historicalWgerId ?? "") || seen.has(item.historicalWgerId)
      || (item.nevfitId !== null && !isNevfitExerciseId(item.nevfitId))
      || (item.nevfitId === null && item.reviewClass !== "D")
      || (item.reviewClass && !["A", "B", "C", "D"].includes(item.reviewClass))
      || (item.reviewClass === "A" && (item.userConfirmation?.confirmed !== true || !Array.isArray(item.userConfirmation.scope)))
      || (item.reviewClass !== "A" && item.userConfirmation?.confirmed === true)
      || requiresEvidence
      || (mapping.crosswalkVersion >= 3 && (
        item.approvalStatus !== { A: "identity_confirmed_execution_pending", B: "pending_collective_user_approval", C: "unobserved_unapproved", D: "retain_legacy_identity" }[item.reviewClass]
        || !Number.isInteger(item.historicalEstimate?.workoutOccurrences)
        || !Number.isInteger(item.historicalEstimate?.routineReferences)
        || typeof item.historicalEstimate?.sourcePreflightDate !== "string"
      ))) throw new Error(`Invalid historical mapping: ${item?.historicalWgerId}`);
    seen.add(item.historicalWgerId);
  }
  return new Map(mapping.relationships.map((item) => [item.historicalWgerId, item]));
}

export function validateMigrationDecisions(decisions = [], mapping = crosswalk) {
  if (!Array.isArray(decisions)) throw new Error("Migration decisions must be an array.");
  const historical = validateHistoricalMappings(mapping);
  const keys = new Set();
  for (const decision of decisions) {
    const relation = historical.get(decision?.historicalWgerId);
    if (!relation || relation.nevfitId !== decision.nevfitId || !isNevfitExerciseId(decision.nevfitId)
      || (mapping.crosswalkVersion >= 3 && relation.reviewClass === "C" && decision.confirmed)
      || !["completedWorkout", "program", "activeWorkout", "exerciseNotes"].includes(decision.kind)
      || typeof decision.docId !== "string" || !decision.docId.trim()
      || typeof decision.path !== "string" || !decision.path.trim()
      || typeof decision.recordedName !== "string"
      || (!decision.recordedName.trim() && !["program", "exerciseNotes"].includes(decision.kind))
      || typeof decision.confirmed !== "boolean" || typeof decision.reason !== "string" || !decision.reason.trim()) {
      throw new Error("A migration decision is missing an exact, reviewed identity and reason.");
    }
    const key = `${decision.kind}\u0000${decision.historicalWgerId}\u0000${decision.recordedName}\u0000${decision.docId ?? ""}\u0000${decision.path ?? ""}`;
    if (keys.has(key)) throw new Error("Duplicate migration decision.");
    keys.add(key);
  }
  return new Map(decisions.map((item) => [`${item.kind}\u0000${item.historicalWgerId}\u0000${item.recordedName}\u0000${item.docId ?? ""}\u0000${item.path ?? ""}`, item]));
}

export function createExerciseMigrationPlan({ uid, programs = [], completedWorkouts = [], activeWorkout = null, exerciseNotes = {}, decisions = [], mapping = crosswalk }) {
  if (typeof uid !== "string" || !uid.trim()) throw new Error("An authenticated account is required.");
  const historical = validateHistoricalMappings(mapping);
  const approved = validateMigrationDecisions(decisions, mapping);
  const occurrences = [], documents = new Map(), unmapped = new Set(), ambiguous = [], conflicts = [], rejected = [];
  const counts = { completedWorkouts: completedWorkouts.length, historicalOccurrences: 0, routineReferences: 0, activeReferences: 0, noteReferences: 0, confirmedCandidates: 0 };
  const inspect = (kind, docId, path, exerciseId, recordedName) => {
    if (!isWger(exerciseId)) return;
    const relation = historical.get(exerciseId);
    const name = typeof recordedName === "string" ? recordedName : "";
    const occurrence = { kind, docId, path, historicalWgerId: exerciseId, recordedName: name, proposedNevfitId: relation?.nevfitId ?? null, decision: "unmapped" };
    if (kind === "completedWorkout") counts.historicalOccurrences++;
    if (kind === "program") counts.routineReferences++;
    if (kind === "activeWorkout") counts.activeReferences++;
    if (kind === "exerciseNotes") counts.noteReferences++;
    if (!relation || !relation.nevfitId) unmapped.add(exerciseId);
    else {
      const base = `${kind}\u0000${exerciseId}\u0000${name}`;
      const decision = approved.get(`${base}\u0000${docId}\u0000${path}`);
      if (decision?.confirmed === false) {
        occurrence.decision = "rejected";
        occurrence.reason = decision.reason;
        rejected.push(occurrence);
      } else if (decision?.confirmed === true || (relation.reviewClass === "A" && relation.userConfirmation?.scope.includes(kind))) {
        occurrence.decision = "confirmed";
        occurrence.reason = decision?.reason ?? relation.userConfirmation.reason;
        occurrence.approvalSource = decision ? "exact_occurrence_decision" : "user_confirmed_mapping";
        counts.confirmedCandidates++;
        const key = `${kind}/${docId}`;
        if (!documents.has(key)) documents.set(key, []);
        documents.get(key).push(occurrence);
      } else {
        occurrence.decision = "needs_review";
        occurrence.reason = name ? relation.reviewReason : "No historical exercise name was recorded.";
        ambiguous.push(occurrence);
      }
    }
    occurrences.push(occurrence);
  };
  completedWorkouts.forEach((workout) => (workout.exercises ?? []).forEach((exercise, index) =>
    inspect("completedWorkout", workout.id, `exercises.${index}.exerciseId`, exercise.exerciseId, exercise.exerciseName)));
  programs.forEach((program) => (program.days ?? program.routines ?? []).forEach((day, dayIndex) => (day.exercises ?? []).forEach((exercise, index) =>
    inspect("program", program.id, `${Array.isArray(program.days) ? "days" : "routines"}.${dayIndex}.exercises.${index}.exerciseId`, exercise.exerciseId, exercise.displayNameOverride ?? ""))));
  (activeWorkout?.exercises ?? []).forEach((exercise, index) =>
    inspect("activeWorkout", "activeWorkout", `activeWorkoutSession.exercises.${index}.exerciseId`, exercise.exerciseId, exercise.exerciseName));
  Object.keys(exerciseNotes).forEach((id) => inspect("exerciseNotes", "exerciseNotes", `notes.${id}`, id, ""));
  // A target already present in the same document can merge notes or duplicate
  // routine movements. Require a separate human decision before any write.
  for (const [key, changes] of documents) {
    const [kind, docId] = key.split("/");
    const source = kind === "completedWorkout" ? completedWorkouts.find((item) => item.id === docId)
      : kind === "program" ? programs.find((item) => item.id === docId)
        : kind === "activeWorkout" ? activeWorkout : { notes: exerciseNotes };
    for (const change of changes) {
      const siblingsPath = change.path.replace(/\.\d+\.exerciseId$/, "");
      const existing = kind === "exerciseNotes" ? Object.keys(exerciseNotes)
        : kind === "program" ? at(source, siblingsPath)?.map((item) => item.exerciseId) ?? []
          : source.exercises.map((item) => item.exerciseId);
      const proposedPeers = changes.filter((peer) => peer !== change && peer.proposedNevfitId === change.proposedNevfitId
        && peer.path.replace(/\.\d+\.exerciseId$/, "") === siblingsPath);
      if (existing.includes(change.proposedNevfitId) || proposedPeers.length) {
        change.decision = "conflict";
        counts.confirmedCandidates--;
        conflicts.push({ ...change, reason: "Target identity already occurs in this exercise list or another proposed conversion." });
      }
    }
    if (kind === "program" && Array.isArray(source.days) && Array.isArray(source.routines)) for (const change of changes) {
      if (change.decision !== "confirmed") continue;
      const mirror = change.path.replace(/^days\./, "routines.");
      if (at(source, mirror) !== change.historicalWgerId) {
        change.decision = "conflict";
        counts.confirmedCandidates--;
        conflicts.push({ ...change, reason: "Program days and routines identity snapshots disagree." });
      }
    }
  }
  const safe = occurrences.filter((item) => item.decision === "confirmed");
  return {
    version: EXERCISE_MIGRATION_VERSION, uid, crosswalkVersion: mapping.crosswalkVersion,
    mappingReview: mapping.relationships.map((relation) => ({
      historicalWgerId: relation.historicalWgerId, proposedNevfitId: relation.nevfitId,
      ambiguityStatus: relation.ambiguityStatus, reviewClass: relation.reviewClass ?? "C",
      automaticConversionSafe: relation.reviewClass === "A" && relation.userConfirmation?.confirmed === true,
      reason: relation.reviewReason,
      observedNames: [...new Set(occurrences.filter((item) => item.historicalWgerId === relation.historicalWgerId).map((item) => item.recordedName))],
    })),
    counts, confirmed: safe, ambiguous, rejected, unmappedWgerIds: [...unmapped].sort(), conflicts,
    expectedAffectedDocuments: [...new Set(safe.map((item) => `${item.kind}/${item.docId}`))].sort(),
    examples: safe.slice(0, 3).map(({ historicalWgerId, proposedNevfitId, recordedName }) =>
      ({ before: { exerciseId: historicalWgerId, exerciseName: recordedName }, after: { exerciseId: proposedNevfitId, exerciseName: recordedName } })),
    occurrences,
  };
}

const at = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const setAt = (object, path, value) => { const keys = path.split("."); const last = keys.pop(); const parent = keys.reduce((current, key) => current[key], object); parent[last] = value; };

export function applyExerciseMigrationPlan(data, plan) {
  if (!plan || plan.version !== EXERCISE_MIGRATION_VERSION || plan.conflicts.length || plan.ambiguous.some((item) => item.decision === "confirmed")) throw new Error("Invalid migration plan.");
  const next = clone(data), manifest = [];
  for (const change of plan.confirmed) {
    const document = change.kind === "completedWorkout" ? next.completedWorkouts.find((item) => item.id === change.docId)
      : change.kind === "program" ? next.programs.find((item) => item.id === change.docId)
        : change.kind === "activeWorkout" ? { activeWorkoutSession: next.activeWorkout } : { notes: next.exerciseNotes };
    if (!document || (change.kind === "exerciseNotes" ? !Object.hasOwn(document.notes, change.historicalWgerId) : at(document, change.path) !== change.historicalWgerId)) throw new Error("Source identity changed since dry run.");
    const before = fingerprint(document);
    if (change.kind === "exerciseNotes") {
      document.notes[change.proposedNevfitId] = document.notes[change.historicalWgerId];
      delete document.notes[change.historicalWgerId];
    } else {
      setAt(document, change.path, change.proposedNevfitId);
      if (change.kind === "program" && Array.isArray(document.days) && Array.isArray(document.routines))
        setAt(document, change.path.replace(/^days\./, "routines."), change.proposedNevfitId);
    }
    manifest.push({ kind: change.kind, docId: change.docId, path: change.path, originalId: change.historicalWgerId, replacementId: change.proposedNevfitId, recordedName: change.recordedName, before });
  }
  return { data: next, manifest };
}

export function rollbackExerciseMigration(data, manifest) {
  const next = clone(data);
  for (const change of [...manifest].reverse()) {
    const document = change.kind === "completedWorkout" ? next.completedWorkouts.find((item) => item.id === change.docId)
      : change.kind === "program" ? next.programs.find((item) => item.id === change.docId)
        : change.kind === "activeWorkout" ? { activeWorkoutSession: next.activeWorkout } : { notes: next.exerciseNotes };
    if (!document) throw new Error("Rollback document is missing.");
    if (change.kind === "exerciseNotes") {
      if (!Object.hasOwn(document.notes, change.replacementId) || Object.hasOwn(document.notes, change.originalId)) throw new Error("Rollback note conflict.");
      document.notes[change.originalId] = document.notes[change.replacementId];
      delete document.notes[change.replacementId];
    } else {
      if (at(document, change.path) !== change.replacementId) throw new Error("Rollback identity conflict.");
      setAt(document, change.path, change.originalId);
      if (change.kind === "program" && Array.isArray(document.days) && Array.isArray(document.routines)) {
        const mirror = change.path.replace(/^days\./, "routines.");
        if (at(document, mirror) !== change.replacementId) throw new Error("Rollback routine mirror conflict.");
        setAt(document, mirror, change.originalId);
      }
    }
  }
  return next;
}
