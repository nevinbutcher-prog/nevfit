import { createRobExercisePlanningProfile } from "./robExercisePlanningTaxonomy.js";
import { assessRobMovementInteractions, assessRobSessionWorkload, createRobWeeklyProgrammingPolicy } from "./robWeeklyProgrammingPolicy.js";

export const ROB_PROGRAM_QUALITY_SCORECARD_VERSION = 2;

const programsDays = (candidate) => candidate?.program?.days ?? candidate?.candidate?.program?.days ?? candidate?.days ?? [];
const profileFor = (exercise, entries) => {
  const entry = entries.get(exercise?.exerciseId);
  return entry ? createRobExercisePlanningProfile(entry) : null;
};
const concern = (code, severity, explanation, fields = {}) => ({ code, severity, category: "advisory", explanation, confidence: "medium", ...fields });
const directSets = (items) => items.reduce((total, item) => total + (Number.isInteger(item.exercise?.sets) ? item.exercise.sets : 0), 0);
const unique = (items) => [...new Set(items)];

export function createRobProgramQualityScorecard(candidate, requirements = {}, catalogue = { entries: [] }) {
  const policy = createRobWeeklyProgrammingPolicy(requirements);
  const entries = new Map((catalogue?.entries ?? catalogue?.exercises ?? []).map((entry) => [entry.id, entry]));
  const days = Array.isArray(programsDays(candidate)) ? programsDays(candidate) : [];
  const routines = days.map((day, routineIndex) => ({ routineIndex, day, items: (Array.isArray(day?.exercises) ? day.exercises : []).map((exercise, exerciseIndex) => ({ exercise, exerciseIndex, profile: profileFor(exercise, entries) })) }));
  const all = routines.flatMap((routine) => routine.items.map((item) => ({ ...item, routineIndex: routine.routineIndex })));
  const concerns = []; const observations = [];
  const directByMuscle = new Map(); const routineExposure = new Map(); const patterns = new Set();
  let unknownMetadata = 0;
  for (const item of all) {
    if (!item.profile) { unknownMetadata += 1; continue; }
    const primary = item.profile.primaryStimulus;
    if (primary.status !== "known") { unknownMetadata += 1; continue; }
    for (const contribution of primary.contributions) {
      directByMuscle.set(contribution.muscleGroup, (directByMuscle.get(contribution.muscleGroup) ?? 0) + item.exercise.sets);
      routineExposure.set(contribution.muscleGroup, new Set([...(routineExposure.get(contribution.muscleGroup) ?? []), item.routineIndex]));
    }
    if (item.profile.movementPattern.value !== "unknown") patterns.add(item.profile.movementPattern.value);
    if (item.profile.secondaryStimulus.status === "unknown" || item.profile.confidence === "low") unknownMetadata += 1;
  }

  for (const coverage of policy.coverage.filter((item) => item.expectation === "baseline_required")) {
    const workingSets = directByMuscle.get(coverage.muscleGroup) ?? 0;
    if (!workingSets) concerns.push(concern("baseline_coverage_gap", "high", `No direct ${coverage.muscleGroup} working sets are visible despite the weekly baseline expectation.`, { muscleGroups: [coverage.muscleGroup], confidence: "high", policyExpectation: coverage.expectation }));
  }
  for (const priority of policy.priorityEmphasis.selected) {
    const sets = directByMuscle.get(priority) ?? 0;
    const baselineSets = policy.coverage.filter((item) => item.expectation === "baseline_required" && item.muscleGroup !== priority).map((item) => directByMuscle.get(item.muscleGroup) ?? 0).filter(Boolean);
    const baselineMiddle = baselineSets.sort((a, b) => a - b)[Math.floor(baselineSets.length / 2)] ?? 0;
    if (!sets) concerns.push(concern("priority_not_directly_addressed", "moderate", `${priority} is a selected priority but has no direct working sets in the supplied program.`, { muscleGroups: [priority], policyExpectation: "modest_priority" }));
    else if (baselineMiddle && sets < baselineMiddle) concerns.push(concern("priority_emphasis_not_evident", "low", `${priority} has direct work, but its volume is below the middle of the visible baseline groups; confirm that the intended emphasis is represented.`, { muscleGroups: [priority], policyExpectation: "modest_priority" }));
    if (requirements.daysPerWeek >= 4 && sets && (routineExposure.get(priority)?.size ?? 0) === 1) concerns.push(concern("priority_single_session_concentration", "low", `${priority} direct work appears in only one routine despite a multi-session week; this may be intentional, but check distribution.`, { muscleGroups: [priority], policyExpectation: "reasonable_distribution" }));
  }
  for (const need of policy.movementPatternNeeds.filter((item) => item.expectation === "seek_when_compatible")) if (!patterns.has(need.pattern)) concerns.push(concern("movement_pattern_gap", "moderate", `The balanced brief has no visible ${need.pattern.replaceAll("_", " ")} pattern.`, { movementPatterns: [need.pattern], policyExpectation: need.expectation }));

  for (const routine of routines) {
    const totalSets = directSets(routine.items);
    const workload = assessRobSessionWorkload({ sessionMinutes: requirements.sessionMinutes, directWorkingSets: totalSets, exerciseCount: routine.items.length });
    for (const item of workload.concerns ?? []) concerns.push(concern(`session_${item.code}`, item.code === "below_typical_session_workload" ? "moderate" : "low", item.reason, { routineIndex: routine.routineIndex, policyExpectation: `${workload.referenceDuration ?? "requested"}-minute session workload` }));
    const profiles = routine.items.map((item) => item.profile).filter(Boolean);
    const interactions = assessRobMovementInteractions(profiles);
    for (const interaction of interactions.considerations) {
      const first = routine.items.filter((item) => item.profile)[interaction.firstIndex];
      const second = routine.items.filter((item) => item.profile)[interaction.secondIndex];
      const firstPattern = first?.profile?.movementPattern?.value; const secondPattern = second?.profile?.movementPattern?.value;
      if (firstPattern === "horizontal_push" && secondPattern === "horizontal_pull") observations.push({ code: "complementary_push_pull_sequence", routineIndex: routine.routineIndex, exerciseIndices: [first.exerciseIndex, second.exerciseIndex], explanation: "A horizontal press followed by a row can be a complementary pattern pairing; actual fatigue still depends on load and effort.", confidence: "medium" });
      if (["horizontal_push", "vertical_push"].includes(firstPattern) && ["horizontal_push", "vertical_push"].includes(secondPattern) && interaction.sharedMuscles.includes("shoulders")) concerns.push(concern("competing_pressing_sequence", "moderate", "Back-to-back compound pressing shares shoulder and pressing demands; consider ordering, recovery, and the purpose of both movements.", { routineIndex: routine.routineIndex, exerciseIndices: [first.exerciseIndex, second.exerciseIndex], muscleGroups: ["shoulders"], movementPatterns: [firstPattern, secondPattern], policyExpectation: "fatigue_sensitive_compound_distribution" }));
      if (firstPattern === "knee_dominant" && secondPattern === "knee_dominant") concerns.push(concern("concentrated_knee_dominant_sequence", "low", "Consecutive knee-dominant work concentrates local and bracing demand; this is not prohibited, but should have a clear workload purpose.", { routineIndex: routine.routineIndex, exerciseIndices: [first.exerciseIndex, second.exerciseIndex], movementPatterns: ["knee_dominant"], policyExpectation: "fatigue_sensitive_compound_distribution" }));
    }
  }

  const roleGroups = new Map();
  for (const item of all.filter((item) => item.profile)) {
    const primary = item.profile.primaryStimulus.contributions[0]?.muscleGroup ?? "unknown";
    const key = `${item.profile.movementPattern.value}:${item.profile.role.value}:${primary}`;
    roleGroups.set(key, [...(roleGroups.get(key) ?? []), item]);
  }
  for (const [key, items] of roleGroups) if (new Set(items.map((item) => item.exercise.exerciseId)).size >= 3 && directSets(items) >= 9) {
    const [pattern, role, muscleGroup] = key.split(":");
    concerns.push(concern("redundant_role_selection", "moderate", `Multiple ${pattern.replaceAll("_", " ")} ${role} exercises target ${muscleGroup}; verify that their roles are distinguishable.`, { routineIndices: unique(items.map((item) => item.routineIndex)), exerciseIndices: items.map((item) => ({ routineIndex: item.routineIndex, exerciseIndex: item.exerciseIndex })), muscleGroups: [muscleGroup], movementPatterns: [pattern], policyExpectation: "avoid_near_identical_roles_without_clear_purpose" }));
  }
  if (unknownMetadata && (concerns.some((item) => ["baseline_coverage_gap", "movement_pattern_gap", "redundant_role_selection"].includes(item.code)) || unknownMetadata / Math.max(all.length, 1) >= 0.25)) concerns.push(concern("material_metadata_uncertainty", "low", "Incomplete taxonomy metadata limits confidence in coverage, overlap, or redundancy interpretation; unknown stimulus is not treated as zero.", { confidence: "low", affectedExerciseCount: unknownMetadata, policyExpectation: "retain_unknown_stimulus_as_uncertainty" }));
  if (!all.length) concerns.push(concern("no_evaluable_exercises", "high", "The supplied program contains no evaluable exercises, so weekly quality cannot be assessed.", { confidence: "high" }));

  return Object.freeze({ version: ROB_PROGRAM_QUALITY_SCORECARD_VERSION, advisoryOnly: true, policyVersion: policy.version, summary: { routineCount: routines.length, exerciseCount: all.length, directWorkingSetsByPrimaryMuscle: Object.fromEntries([...directByMuscle.entries()].sort()), unknownMetadataCount: unknownMetadata, limitations: policy.limitations }, concerns, observations });
}
