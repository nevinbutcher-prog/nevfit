import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { createRobExercisePlanningProfile } from "../src/services/rob/robExercisePlanningTaxonomy.js";
import { assessRobMovementInteractions, assessRobPolicyStimulus, assessRobSessionWorkload, createRobWeeklyProgrammingPolicy } from "../src/services/rob/robWeeklyProgrammingPolicy.js";

const requirements = (overrides = {}) => ({ goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 75, priorities: ["balanced", "shoulders"], environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench"], ...overrides });
const profile = (id) => createRobExercisePlanningProfile(catalogue.exercises.find((entry) => entry.id === id));

test("balanced shoulder emphasis retains whole-week baseline coverage and makes shoulders a modest emphasis", () => {
  const policy = createRobWeeklyProgrammingPolicy(requirements());
  assert.equal(policy.scope, "advisory_weekly_envelope_before_exercise_selection");
  assert.equal(policy.coverage.find((item) => item.muscleGroup === "chest").expectation, "baseline_required");
  assert.equal(policy.coverage.find((item) => item.muscleGroup === "back").expectation, "baseline_required");
  assert.equal(policy.coverage.find((item) => item.muscleGroup === "shoulders").emphasis, "modest_priority");
});

test("arms, back, and simultaneous priorities alter emphasis without dropping balanced coverage", () => {
  const policy = createRobWeeklyProgrammingPolicy(requirements({ priorities: ["balanced", "arms", "back"] }));
  assert.equal(policy.coverage.find((item) => item.muscleGroup === "arms").emphasis, "modest_priority");
  assert.equal(policy.coverage.find((item) => item.muscleGroup === "back").emphasis, "modest_priority");
  assert.equal(policy.coverage.find((item) => item.muscleGroup === "legs").expectation, "baseline_required");
});

test("three, four, and five days permit varying structures without inventing a calendar", () => {
  assert.equal(createRobWeeklyProgrammingPolicy(requirements({ daysPerWeek: 3 })).distribution.sessionStructure, "full_body_or_mixed_sessions_are_plausible");
  assert.equal(createRobWeeklyProgrammingPolicy(requirements({ daysPerWeek: 4 })).distribution.sessionStructure, "full_body_mixed_or_split_sessions_are_plausible");
  const five = createRobWeeklyProgrammingPolicy(requirements({ daysPerWeek: 5 }));
  assert.equal(five.distribution.sessionStructure, "full_body_mixed_or_split_sessions_are_plausible");
  assert.match(five.distribution.recovery, /unknown/);
});

test("session guidance varies by duration and goal without rigid exercise quotas", () => {
  assert.deepEqual(createRobWeeklyProgrammingPolicy(requirements({ sessionMinutes: 45 })).sessionWorkload.directWorkingSets.typical, [8, 16]);
  assert.deepEqual(createRobWeeklyProgrammingPolicy(requirements({ sessionMinutes: 60 })).sessionWorkload.directWorkingSets.typical, [11, 20]);
  const strength = createRobWeeklyProgrammingPolicy(requirements({ sessionMinutes: 75, goal: "strength" }));
  assert.equal(strength.goal.rest, "longer");
  assert.match(strength.sessionWorkload.exerciseCount, /not a fixed quota/);
});

test("primary direct sets stay quantitative while unknown secondary metadata remains uncertainty", () => {
  const bench = profile("wger-73");
  const lateral = createRobExercisePlanningProfile(catalogue.exercises.find((entry) => entry.name === "Lateral Raises"));
  const assessment = assessRobPolicyStimulus([{ profile: bench, directWorkingSets: 4 }, { profile: lateral, directWorkingSets: 3 }]);
  assert.equal(assessment.directWorkingSetsByPrimaryMuscle.chest, 4);
  assert.ok(assessment.uncertainty.includes("unknown_secondary_stimulus"));
  assert.match(assessment.rule, /not exact direct-set equivalents/);
});

test("overlapping pressing creates a sequencing consideration rather than a blacklist", () => {
  const interactions = assessRobMovementInteractions([profile("wger-73"), profile("wger-567")]);
  assert.equal(interactions.considerations.length, 1);
  assert.ok(interactions.considerations[0].sharedMuscles.includes("shoulders"));
  assert.match(interactions.considerations[0].guidance, /consider ordering/);
});

test("four nine-set 75-minute balanced hypertrophy sessions are advisory low-workload, not universally invalid", () => {
  const sessions = Array.from({ length: 4 }, () => assessRobSessionWorkload({ sessionMinutes: 75, directWorkingSets: 9, exerciseCount: 4 }));
  assert.ok(sessions.every((session) => session.concerns.some((concern) => concern.code === "below_typical_session_workload")));
  assert.equal(sessions[0].status, "assessed");
  assert.match(sessions[0].concerns[0].reason, /advisory, not invalid/);
});

test("missing availability and conflicting equipment produce explicit limitations", () => {
  const missing = createRobWeeklyProgrammingPolicy({ goal: "other", priorities: [] });
  assert.ok(missing.limitations.includes("confirmed equipment capabilities are unavailable"));
  assert.ok(missing.limitations.includes("session duration is unavailable"));
  const conflicting = createRobWeeklyProgrammingPolicy(requirements({ environment: "minimal_equipment", equipment: ["machines", "cables"] }));
  assert.ok(conflicting.limitations.some((item) => item.includes("conflicts")));
});
