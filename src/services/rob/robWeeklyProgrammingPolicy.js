import { planningOverlap } from "./robExercisePlanningTaxonomy.js";

export const ROB_WEEKLY_PROGRAMMING_POLICY_VERSION = 1;

// Planning heuristics, not minimum-effective-dose claims or validation limits.
export const ROB_SESSION_WORKLOAD_GUIDANCE = Object.freeze({
  45: Object.freeze({ directWorkingSets: Object.freeze({ typical: [8, 16], broad: [6, 20] }), exerciseComplexity: "favour fewer demanding setups and transitions" }),
  60: Object.freeze({ directWorkingSets: Object.freeze({ typical: [11, 20], broad: [8, 24] }), exerciseComplexity: "allow a balanced mix of compounds and simpler work" }),
  75: Object.freeze({ directWorkingSets: Object.freeze({ typical: [14, 24], broad: [10, 30] }), exerciseComplexity: "allow compounds, adequate rests, and a modest amount of accessory work" }),
});

const MAJOR_GROUPS = Object.freeze(["chest", "back", "legs", "shoulders", "arms", "glutes", "core"]);
const GOAL_PROFILES = Object.freeze({
  hypertrophy: { primary: "hypertrophy", volume: "moderate", rest: "moderate_to_long" },
  strength: { primary: "strength", volume: "lower_to_moderate", rest: "longer" },
  general_fitness: { primary: "general_fitness", volume: "moderate", rest: "variable" },
  hypertrophy_strength: { primary: "hypertrophy_strength", volume: "moderate", rest: "moderate_to_long" },
  other: { primary: "other", volume: "unknown", rest: "unknown" },
});
const number = (value) => Number.isFinite(value) ? value : null;
const unique = (items) => [...new Set(items)];
const selectedPriorities = (requirements) => unique((requirements?.priorities ?? []).filter((item) => MAJOR_GROUPS.includes(item)));
const durationBand = (minutes) => minutes <= 52 ? 45 : minutes <= 67 ? 60 : 75;

function coverageFor(requirements) {
  const priorities = new Set(selectedPriorities(requirements));
  const balanced = (requirements?.priorities ?? []).includes("balanced");
  return MAJOR_GROUPS.map((muscleGroup) => ({
    muscleGroup,
    expectation: balanced || ["chest", "back", "legs"].includes(muscleGroup) ? "baseline_required" : "optional",
    emphasis: priorities.has(muscleGroup) ? "modest_priority" : "none",
    directWorkingSets: priorities.has(muscleGroup)
      ? { guidance: "modestly_more_than_baseline", rationale: "priority adjusts emphasis without replacing whole-week coverage" }
      : { guidance: balanced || ["chest", "back", "legs"].includes(muscleGroup) ? "meaningful_baseline" : "context_dependent", rationale: "not an identical set prescription" },
  }));
}

function movementNeeds(requirements) {
  const balanced = (requirements?.priorities ?? []).includes("balanced");
  const needs = [["horizontal_push", "chest pressing exposure"], ["horizontal_pull", "back rowing exposure"], ["vertical_pull", "back vertical-pull exposure"], ["knee_dominant", "leg knee-dominant exposure"], ["hinge", "posterior-chain exposure"]]
    .map(([pattern, rationale]) => ({ pattern, expectation: balanced ? "seek_when_compatible" : "consider", rationale }));
  if (selectedPriorities(requirements).includes("shoulders")) needs.push({ pattern: "vertical_push", expectation: "consider_priority_emphasis", rationale: "shoulder priority should coexist with pressing recovery" });
  return needs;
}

function equipmentLimitations(requirements) {
  const equipment = Array.isArray(requirements?.equipment) ? requirements.equipment : [];
  const limitations = [];
  if (!requirements?.environment) limitations.push("training environment is unavailable");
  if (!equipment.length) limitations.push("confirmed equipment capabilities are unavailable");
  if (requirements?.environment === "minimal_equipment" && equipment.some((item) => ["machines", "cables"].includes(item))) limitations.push("minimal-equipment environment conflicts with selected machine or cable capability");
  return limitations;
}

function sessionGuidance(requirements) {
  const minutes = number(requirements?.sessionMinutes);
  if (!minutes) return { status: "unknown", guidance: null, limitations: ["session duration is unavailable"] };
  const referenceDuration = durationBand(minutes);
  const source = ROB_SESSION_WORKLOAD_GUIDANCE[referenceDuration];
  return { status: "guided", minutes, referenceDuration, directWorkingSets: { ...source.directWorkingSets }, warmUpAllowance: "reserve time for task-specific warm-up, especially before demanding compounds", restDemand: "session capacity changes materially with load, proximity to failure, equipment availability, and rest periods", equipmentTransitions: "prefer a practical flow; repeated station changes consume uncertain time", exerciseComplexity: source.exerciseComplexity, exerciseCount: "an outcome of selected work, rest, setup, and transition demands; not a fixed quota" };
}

function distributionGuidance(requirements) {
  const days = number(requirements?.daysPerWeek);
  if (!days) return { status: "unknown", limitations: ["weekly training frequency is unavailable"] };
  const sessionStructure = days <= 3 ? "full_body_or_mixed_sessions_are_plausible" : days <= 5 ? "full_body_mixed_or_split_sessions_are_plausible" : "several_structures_are_plausible_with_recovery_monitoring";
  return { status: "guided", daysPerWeek: days, sessionStructure, frequency: "spread major-group exposure across available sessions where practical; frequency is a planning lever, not a mandatory split", recovery: "actual training days and recovery capacity are unknown, so no exact between-session interval is assumed", compoundDistribution: "avoid concentrating every demanding compound in one session when a workable weekly distribution exists", workloadDistribution: "keep the whole-week baseline visible while allowing modest priority emphasis" };
}

export function createRobWeeklyProgrammingPolicy(requirements = {}) {
  const goal = GOAL_PROFILES[requirements.goal] ?? { primary: "unknown", volume: "unknown", rest: "unknown" };
  const limitations = [...equipmentLimitations(requirements)];
  if (!GOAL_PROFILES[requirements.goal]) limitations.push("training goal is unsupported or unavailable");
  if (!Array.isArray(requirements.priorities)) limitations.push("development priorities are unavailable");
  const sessions = sessionGuidance(requirements);
  const distribution = distributionGuidance(requirements);
  limitations.push(...(sessions.limitations ?? []), ...(distribution.limitations ?? []));
  return Object.freeze({ version: ROB_WEEKLY_PROGRAMMING_POLICY_VERSION, scope: "advisory_weekly_envelope_before_exercise_selection", goal, coverage: coverageFor(requirements), priorityEmphasis: { selected: selectedPriorities(requirements), rule: "priorities receive modest additional emphasis and do not remove baseline coverage" }, movementPatternNeeds: movementNeeds(requirements), distribution, sessionWorkload: sessions, stimulusAccounting: { quantitativeSignal: "direct_working_sets", primary: "count direct sets toward the exercise primary stimulus", meaningfulSecondary: "use for overlap and fatigue context; do not convert to an exact direct-set equivalent", supportingSecondary: "use as weaker overlap context; do not count as direct-set volume", unknown: "retain uncertainty; do not treat unknown as zero stimulus or absence of overlap" }, compatibility: { complementaryPatterns: "seek compatible push, pull, knee-dominant, hinge, and trunk demands when requirements allow", redundancy: "repeated roles can be useful but should earn their place through priority, skill, or workload purpose", fatigueInterference: "shared primary muscles, meaningful secondary involvement, and fatigue tags warrant sequencing and recovery consideration", ordering: "place priority and demanding compounds before related isolation when practical, while respecting setup and recovery", restriction: "overlap is not a prohibition and this policy supplies no pairwise blacklist" }, assumptions: ["direct working sets are an imperfect but practical volume signal", "session timing is uncertain without exercise, load, rest, and facility-flow details", "actual weekly calendar and recovery constraints are not inferred"], confidence: limitations.length ? "limited" : "guided", limitations: unique(limitations) });
}

export function assessRobPolicyStimulus(plannedExercises = []) {
  const known = new Map(); const uncertainty = [];
  for (const item of plannedExercises) {
    const directSets = number(item?.directWorkingSets); const profile = item?.profile;
    if (!directSets || directSets < 0) { uncertainty.push("missing_direct_working_sets"); continue; }
    if (profile?.primaryStimulus?.status !== "known") { uncertainty.push("unknown_primary_stimulus"); continue; }
    for (const contribution of profile.primaryStimulus.contributions ?? []) known.set(contribution.muscleGroup, (known.get(contribution.muscleGroup) ?? 0) + directSets);
    if (profile?.secondaryStimulus?.status === "unknown") uncertainty.push("unknown_secondary_stimulus");
  }
  return { directWorkingSetsByPrimaryMuscle: Object.fromEntries([...known.entries()].sort()), uncertainty: unique(uncertainty), rule: "secondary and supporting involvement inform overlap, not exact direct-set equivalents" };
}

export function assessRobMovementInteractions(profiles = []) {
  const considerations = [];
  for (let first = 0; first < profiles.length; first += 1) for (let second = first + 1; second < profiles.length; second += 1) {
    const overlap = planningOverlap(profiles[first], profiles[second]);
    if (overlap.sharedMuscles.length || overlap.sharedFatigueTags.length) considerations.push({ firstIndex: first, secondIndex: second, sharedMuscles: overlap.sharedMuscles, sharedFatigueTags: overlap.sharedFatigueTags, guidance: "consider ordering, recovery, and whether repeated demand serves a clear purpose" });
  }
  return { considerations, uncertainty: profiles.some((profile) => profile?.secondaryStimulus?.status === "unknown") ? ["unknown_secondary_stimulus_may_hide_overlap"] : [] };
}

export function assessRobSessionWorkload({ sessionMinutes, directWorkingSets, exerciseCount = null } = {}) {
  const guidance = sessionGuidance({ sessionMinutes });
  if (guidance.status === "unknown" || !Number.isFinite(directWorkingSets)) return { status: "insufficient_data", concerns: ["session duration and direct working sets are required for workload assessment"] };
  const [typicalMinimum, typicalMaximum] = guidance.directWorkingSets.typical;
  const concerns = [];
  if (directWorkingSets < typicalMinimum) concerns.push({ code: "below_typical_session_workload", reason: `${directWorkingSets} direct working sets is below the ${guidance.referenceDuration}-minute typical guidance of ${typicalMinimum}-${typicalMaximum}; this is advisory, not invalid.` });
  if (directWorkingSets > typicalMaximum) concerns.push({ code: "above_typical_session_workload", reason: `${directWorkingSets} direct working sets exceeds typical guidance; rest, exercise complexity, and recovery may make the session impractical.` });
  if (Number.isFinite(exerciseCount) && exerciseCount > 0 && exerciseCount < 3 && directWorkingSets >= typicalMinimum) concerns.push({ code: "concentrated_session_structure", reason: "few exercises may be legitimate, but check whether balanced movement coverage and fatigue distribution remain credible." });
  return { status: "assessed", referenceDuration: guidance.referenceDuration, directWorkingSets, typicalRange: [typicalMinimum, typicalMaximum], concerns };
}
