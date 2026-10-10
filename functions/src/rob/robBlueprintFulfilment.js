import { ROB_CATALOGUE_VERSION, SERVER_CATALOGUE, eligibleRobCatalogueEntry } from "./robExerciseCatalogue.js";
import { parseProgramCandidate } from "./robProgramGeneration.js";
import { parseRobWeeklyBlueprint } from "./robWeeklyBlueprint.js";
import { createRobExercisePlanningProfile } from "../../../src/services/rob/robExercisePlanningTaxonomy.js";
import { createRobProgramQualityScorecard } from "../../../src/services/rob/robProgramQualityScorecard.js";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const validCatalogue = (catalogue) => object(catalogue) && catalogue.version === ROB_CATALOGUE_VERSION && Array.isArray(catalogue.ids) && catalogue.ids.length > 0 && new Set(catalogue.ids).size === catalogue.ids.length && catalogue.ids.every((id) => typeof id === "string" && SERVER_CATALOGUE.has(id));
const patternRoleMatch = (profile, slot) => profile.primaryStimulus.status === "known" && profile.primaryStimulus.contributions.some((item) => item.muscleGroup === slot.primaryMuscle) && profile.movementPattern.value === slot.movementPattern && profile.role.value === slot.role;
const rank = (entry, profile, slot, selectedIds, selectedProfiles) => {
  const conventionality = { standard: 24, variant: 12, specialist: 2, unknown: 0 }[profile.conventionality.value] ?? 0;
  const confidence = { high: 16, medium: 9, low: 0 }[profile.confidence] ?? 0;
  const setup = { low: 4, medium: 2, unknown: 0 }[profile.setupDemand.value] ?? 0;
  const repeated = selectedIds.has(entry.id) ? -20 : 0;
  const sameRole = selectedProfiles.filter((item) => item.movementPattern.value === slot.movementPattern && item.primaryStimulus.contributions.some((contribution) => contribution.muscleGroup === slot.primaryMuscle)).length * -3;
  return conventionality + confidence + setup + repeated + sameRole;
};
const rationale = (entry, profile, slot, score, selectedIds) => ({ exerciseId: entry.id, source: "server_catalogue", primaryMatch: slot.primaryMuscle, movementPattern: profile.movementPattern.value, role: profile.role.value, confidence: profile.confidence, conventionality: profile.conventionality.value, repeatedAcrossWeek: selectedIds.has(entry.id), score, explanation: `Trusted catalogue exercise fulfils the ${slot.primaryMuscle} ${slot.movementPattern.replaceAll("_", " ")} ${slot.role} slot with ${profile.confidence} planning confidence.` });

export function fulfilRobWeeklyBlueprint({ blueprint, requirements, catalogue }) {
  const validatedBlueprint = parseRobWeeklyBlueprint(JSON.stringify(blueprint), requirements);
  if (!validCatalogue(catalogue)) return { feasible: false, candidate: null, selections: [], unresolvedSlots: [{ code: "invalid_authorised_catalogue", explanation: "The authorised catalogue snapshot is missing, stale, or contains an unsupported ID." }], quality: null };
  const exclusions = new Set(Array.isArray(catalogue.excludedExerciseIds) ? catalogue.excludedExerciseIds : []);
  const entries = catalogue.ids.map((id) => SERVER_CATALOGUE.get(id)).filter((entry) => eligibleRobCatalogueEntry(entry, requirements, exclusions));
  const profiles = new Map(entries.map((entry) => [entry.id, createRobExercisePlanningProfile(entry)]));
  const selectedIds = new Set(); const selectedProfiles = []; const selections = []; const unresolvedSlots = [];
  const days = validatedBlueprint.sessions.map((session, routineIndex) => ({ name: session.name, focus: session.purpose, exercises: session.slots.map((slot, slotIndex) => {
    const candidates = entries.map((entry) => ({ entry, profile: profiles.get(entry.id) })).filter(({ profile }) => patternRoleMatch(profile, slot));
    if (!candidates.length) { unresolvedSlots.push({ code: "no_trustworthy_catalogue_match", routineIndex, slotIndex, primaryMuscle: slot.primaryMuscle, movementPattern: slot.movementPattern, role: slot.role, explanation: "No authorised, equipment-compatible trusted catalogue exercise fulfils this exact blueprint slot." }); return null; }
    const chosen = candidates.map(({ entry, profile }) => ({ entry, profile, score: rank(entry, profile, slot, selectedIds, selectedProfiles) })).sort((first, second) => second.score - first.score || first.entry.name.localeCompare(second.entry.name) || first.entry.id.localeCompare(second.entry.id))[0];
    selections.push({ routineIndex, slotIndex, ...rationale(chosen.entry, chosen.profile, slot, chosen.score, selectedIds) }); selectedIds.add(chosen.entry.id); selectedProfiles.push(chosen.profile);
    return { exerciseId: chosen.entry.id, sets: slot.sets, repRange: slot.repRange, restSeconds: slot.restSeconds, note: null, proposalGroupKey: null };
  }).filter(Boolean) }));
  if (unresolvedSlots.length) return { feasible: false, candidate: null, selections, unresolvedSlots, quality: null, catalogue: { version: ROB_CATALOGUE_VERSION, entries } };
  const raw = { version: 1, proposalType: "create_program", explanation: "Deterministic trusted-catalogue fulfilment of the weekly blueprint.", program: { name: "Rob Blueprint Program", summary: validatedBlueprint.weeklyStructure.rationale, days } };
  const parsed = parseProgramCandidate(JSON.stringify(raw), requirements, { entries });
  const candidate = parsed.candidate;
  return { feasible: true, candidate, selections, unresolvedSlots: [], quality: createRobProgramQualityScorecard(candidate, requirements, { entries }), catalogue: { version: ROB_CATALOGUE_VERSION, entries } };
}
