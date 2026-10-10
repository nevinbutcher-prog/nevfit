import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { createRobProgramQualityScorecard } from "../src/services/rob/robProgramQualityScorecard.js";

const requirements = (overrides = {}) => ({ goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 75, priorities: ["balanced", "shoulders"], environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench"], ...overrides });
const exercise = (exerciseId, sets = 3) => ({ exerciseId, sets, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: null });
const program = (days) => ({ program: { days } });
const day = (name, ids, sets = 3) => ({ name, focus: name, exercises: ids.map((id) => exercise(id, sets)) });
const codes = (scorecard) => scorecard.concerns.map((item) => item.code);

test("Failure A flags inadequate balanced coverage and shoulder-role redundancy across four shoulder-dominated sessions", () => {
  const candidate = program([day("Shoulders 1", ["wger-20", "wger-566", "wger-567", "wger-2658"], 4), day("Shoulders 2", ["wger-20", "wger-193", "wger-567", "wger-487"], 4), day("Shoulders 3", ["wger-566", "wger-193", "wger-2658", "wger-487"], 4), day("Shoulders 4", ["wger-20", "wger-566", "wger-567", "wger-2658"], 4)]);
  const scorecard = createRobProgramQualityScorecard(candidate, requirements(), catalogue);
  assert.ok(codes(scorecard).includes("baseline_coverage_gap"));
  assert.ok(codes(scorecard).includes("redundant_role_selection"));
  assert.match(scorecard.concerns.find((item) => item.code === "baseline_coverage_gap").explanation, /No direct/);
});

test("Failure B flags low 75-minute session workload, pressing competition, and redundant shoulder presses", () => {
  const candidate = program([day("Shoulder Focus 1", ["wger-20", "wger-566", "wger-193"]), day("Legs & Core", ["wger-1801", "wger-1751", "wger-1412"]), day("Shoulder Focus 2", ["wger-1219", "wger-2621", "wger-1227"]), day("Chest & Back", ["wger-73", "wger-1470", "wger-1486"])]);
  const scorecard = createRobProgramQualityScorecard(candidate, requirements(), catalogue);
  assert.ok(codes(scorecard).includes("session_below_typical_session_workload"));
  assert.ok(codes(scorecard).includes("redundant_role_selection"));
  assert.ok(codes(scorecard).includes("competing_pressing_sequence"));
  assert.ok(scorecard.concerns.some((item) => item.code === "session_below_typical_session_workload" && item.routineIndex === 0));
});

test("a coherent balanced shoulder-emphasis program avoids equivalent failure codes and records complementary pressing/pulling", () => {
  const candidate = program([day("Upper 1", ["wger-73", "wger-2669", "wger-567", "wger-723", "wger-1931"], 3), day("Lower 1", ["wger-1801", "wger-507", "wger-294", "wger-364", "wger-458"], 4), day("Upper 2", ["wger-73", "wger-2669", "wger-2658", "wger-487", "wger-1931", "wger-145"], 3), day("Lower 2", ["wger-203", "wger-507", "wger-294", "wger-364", "wger-458"], 4)]);
  const scorecard = createRobProgramQualityScorecard(candidate, requirements(), catalogue);
  assert.equal(codes(scorecard).includes("redundant_role_selection"), false);
  assert.equal(codes(scorecard).includes("baseline_coverage_gap"), false);
  assert.equal(codes(scorecard).includes("session_below_typical_session_workload"), false);
  assert.equal(codes(scorecard).includes("competing_pressing_sequence"), false);
  assert.equal(new Set(candidate.program.days[2].exercises.map((item) => item.exerciseId)).size, candidate.program.days[2].exercises.length);
  assert.equal(scorecard.summary.directWorkingSetsByPrimaryMuscle.shoulders, 9);
  assert.equal(scorecard.summary.directWorkingSetsByPrimaryMuscle.glutes, 8);
  assert.ok(scorecard.observations.some((item) => item.code === "complementary_push_pull_sequence"));
  assert.ok(scorecard.observations.some((item) => item.code === "accumulated_pressing_overlap" && item.routineIndex === 0));
});

test("bench then row then overhead press is accumulated pressing demand, not back-to-back pressing", () => {
  const candidate = program([day("Upper", ["wger-73", "wger-2669", "wger-567"], 4)]);
  const scorecard = createRobProgramQualityScorecard(candidate, requirements({ daysPerWeek: 3, sessionMinutes: 45, priorities: ["shoulders"] }), catalogue);
  assert.equal(codes(scorecard).includes("competing_pressing_sequence"), false);
  assert.ok(scorecard.observations.some((item) => item.code === "complementary_push_pull_sequence"));
  assert.deepEqual(scorecard.observations.find((item) => item.code === "accumulated_pressing_overlap").exerciseIndexPairs, [[0, 2]]);
});

test("substantial compound-derived arms and glutes coverage remains qualitative rather than invented direct sets", () => {
  const candidate = program([day("Upper 1", ["wger-73", "wger-2669", "wger-567", "wger-723"]), day("Lower 1", ["wger-1801", "wger-507", "wger-458"]), day("Upper 2", ["wger-73", "wger-2669", "wger-723"]), day("Lower 2", ["wger-203", "wger-507", "wger-458"])]);
  const scorecard = createRobProgramQualityScorecard(candidate, requirements({ priorities: ["balanced"] }), catalogue);
  assert.equal(scorecard.summary.directWorkingSetsByPrimaryMuscle.arms, undefined);
  assert.equal(scorecard.summary.directWorkingSetsByPrimaryMuscle.glutes, undefined);
  assert.equal(scorecard.summary.qualitativeSecondaryCoverage.arms, "substantial_secondary");
  assert.equal(scorecard.summary.qualitativeSecondaryCoverage.glutes, "substantial_secondary");
  assert.equal(scorecard.concerns.some((item) => item.code === "baseline_coverage_gap" && item.muscleGroups.includes("arms")), false);
  assert.ok(scorecard.observations.some((item) => item.code === "qualitative_secondary_coverage" && item.muscleGroups.includes("glutes")));
});

test("genuine balanced-program omissions remain visible when neither direct nor substantial secondary stimulus exists", () => {
  const candidate = program([day("Upper 1", ["wger-73", "wger-2669", "wger-723"]), day("Upper 2", ["wger-73", "wger-2669", "wger-723"]), day("Upper 3", ["wger-73", "wger-2669", "wger-723"]), day("Upper 4", ["wger-73", "wger-2669", "wger-723"])]);
  const scorecard = createRobProgramQualityScorecard(candidate, requirements({ priorities: ["balanced"] }), catalogue);
  const missing = scorecard.concerns.filter((item) => item.code === "baseline_coverage_gap").flatMap((item) => item.muscleGroups);
  assert.ok(missing.includes("legs"));
  assert.ok(missing.includes("glutes"));
  assert.ok(missing.includes("core"));
});

test("adapter accepts current candidate envelopes and handles goals, durations, frequencies, and uncertainty deterministically", () => {
  const candidate = { candidate: program([day("Full body", ["wger-73", "wger-2669", "wger-1801"], 3)]) };
  for (const [daysPerWeek, sessionMinutes, goal, equipment] of [[3, 45, "general_fitness", ["dumbbells", "bench"]], [4, 60, "hypertrophy_strength", ["machines", "cables"]], [5, 75, "strength", ["barbell", "bench"]]]) {
    const scorecard = createRobProgramQualityScorecard(candidate, requirements({ daysPerWeek, sessionMinutes, goal, equipment }), catalogue);
    assert.equal(scorecard.version, 2);
    assert.equal(scorecard.advisoryOnly, true);
  }
  const unknownCatalogue = { entries: [{ id: "unknown-id", name: "Unclassified movement", equipment: ["Dumbbell"], primaryMuscle: "Shoulders", secondaryMuscles: [], bodyPart: "Shoulders" }] };
  const unknown = createRobProgramQualityScorecard(program([day("Unknown", ["unknown-id"], 3)]), requirements(), unknownCatalogue);
  assert.ok(codes(unknown).includes("material_metadata_uncertainty"));
  assert.equal(unknown.summary.unknownMetadataCount, 1);
});
