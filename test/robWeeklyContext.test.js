import test from "node:test";
import assert from "node:assert/strict";
import { buildRobWeeklyContext, weeklyBounds } from "../src/services/rob/robWeeklyContext.js";

const workout = (id, date, sets, exerciseId = "wger-75", unit = "kg") => ({ id, completedAt: `${date}T12:00:00`, routineDayName: "Upper A", exercises: [{ exerciseId, exerciseName: "Dumbbell bench press", sets: sets.map(([weight, reps]) => ({ weight: String(weight), reps: String(reps), unit })) }] });
const build = (overrides = {}) => buildRobWeeklyContext({ selectedDate: "2026-10-14", now: new Date("2026-10-18T12:00:00"), completedWorkouts: [], runs: [], stepsByDate: {}, ...overrides });

test("Monday–Sunday local weeks and preceding period cross month and year boundaries", () => {
  assert.deepEqual(weeklyBounds("2026-01-01"), { start: "2025-12-29", end: "2026-01-04", priorStart: "2025-12-22", priorEnd: "2025-12-28" });
  assert.deepEqual(weeklyBounds("2026-10-18"), { start: "2026-10-12", end: "2026-10-18", priorStart: "2026-10-05", priorEnd: "2026-10-11" });
});

test("automatically chooses the current local week on Monday and Sunday", () => {
  const monday = buildRobWeeklyContext({ now: new Date("2026-10-12T12:00:00") });
  const sunday = buildRobWeeklyContext({ now: new Date("2026-10-18T12:00:00") });
  assert.equal(monday.current.start, "2026-10-12");
  assert.equal(sunday.current.start, "2026-10-12");
  assert.equal(monday.preceding.end, "2026-10-11");
  assert.equal(sunday.evidenceLimits.currentWeekInProgress, true);
});

test("double progression is considered only when explicitly recorded for this account", () => {
  const completedWorkouts = [workout("p", "2026-10-06", [[25, 12]]), workout("c", "2026-10-13", [[27.5, 8]])];
  const withoutPreference = build({ completedWorkouts });
  const withPreference = build({ completedWorkouts, coachingProfile: { version: 1, progression: { method: "double_progression", rule: "Add load after all sets reach 12 reps." } } });
  const otherMethod = build({ completedWorkouts, coachingProfile: { version: 1, progression: { method: "other", rule: "Different method" } } });
  assert.equal(withoutPreference.comparison.exercises[0].status, "mixed_load_rep_change");
  assert.equal(withPreference.comparison.exercises[0].status, "possible_double_progression_reset");
  assert.equal(otherMethod.comparison.exercises[0].status, "mixed_load_rep_change");
  assert.equal(withPreference.profile.progression.rule, "Add load after all sets reach 12 reps.");
});

test("includes multiple completed workouts and compares same exercise across routine IDs", () => {
  const previous = workout("p", "2026-10-06", [[25, 10], [25, 10]]);
  const current1 = workout("c1", "2026-10-13", [[27.5, 10], [27.5, 10]]);
  current1.routineDayId = "different-routine";
  const current2 = workout("c2", "2026-10-15", [[27.5, 10]]);
  const context = build({ completedWorkouts: [previous, current1, current2] });
  assert.equal(context.current.strength.sessionCount, 2);
  assert.equal(context.current.strength.workingSets, 3);
  assert.equal(context.preceding.strength.workingSets, 2);
  assert.equal(context.comparison.exercises[0].status, "top_set_progressed");
  assert.equal(context.comparison.exercises[0].currentWorkingSets, 3);
});

test("mixed load and reps, flat top sets, missing units and incomplete records never invent progression", () => {
  const mixed = build({ completedWorkouts: [workout("p", "2026-10-06", [[25, 12]]), workout("c", "2026-10-13", [[30, 8]])] });
  assert.equal(mixed.comparison.exercises[0].status, "mixed_load_rep_change");
  const flat = build({ completedWorkouts: [workout("p", "2026-10-06", [[25, 10]]), workout("c", "2026-10-13", [[25, 10]])] });
  assert.equal(flat.comparison.exercises[0].status, "top_set_flat");
  const missing = workout("c", "2026-10-13", [[30, 10]]);
  delete missing.exercises[0].sets[0].unit;
  const withoutUnit = build({ completedWorkouts: [workout("p", "2026-10-06", [[25, 10]]), missing] });
  assert.equal(withoutUnit.comparison.exercises[0].status, "insufficient_comparable_evidence");
  assert.equal(withoutUnit.current.strength.exercises[0].missingUnits, 1);
  const incomplete = workout("empty", "2026-10-14", [["", ""]]);
  const context = build({ completedWorkouts: [incomplete] });
  assert.equal(context.current.strength.sessionCount, 0);
  assert.equal(context.current.strength.incompleteSets, 1);
});

test("integrates run totals and pace with recorded versus missing step days", () => {
  const context = build({
    completedWorkouts: [workout("p", "2026-10-06", [[25, 10]]), workout("c", "2026-10-13", [[27.5, 10]])],
    runs: [{ date: "2026-10-07", distanceKm: 4, durationMinutes: 24 }, { date: "2026-10-14", distanceKm: 5, durationMinutes: 25 }, { date: "2026-10-16", distanceKm: 3, durationMinutes: null }],
    stepsByDate: { "2026-10-06": 4000, "2026-10-13": 0, "2026-10-14": 6000 },
  });
  assert.equal(context.current.runs.count, 2);
  assert.equal(context.current.runs.distanceKm, 8);
  assert.equal(context.current.runs.runs[0].paceMinutesPerKm, 5);
  assert.equal(context.current.runs.runs[1].paceMinutesPerKm, null);
  assert.equal(context.current.steps.recordedDays, 2);
  assert.equal(context.current.steps.missingDays, 5);
  assert.equal(context.current.steps.zeroDays, 1);
  assert.equal(context.current.steps.averageRecordedDay, 3000);
  assert.equal(context.comparison.stepTotalsComparable, false);
});

test("stable activity and insufficient preceding history are explicit", () => {
  const stable = build({ completedWorkouts: [workout("p", "2026-10-06", [[25, 10]]), workout("c", "2026-10-13", [[25, 10]])], runs: [{ date: "2026-10-06", distanceKm: 5, durationMinutes: 30 }, { date: "2026-10-13", distanceKm: 5, durationMinutes: 30 }] });
  assert.equal(stable.comparison.exercises[0].status, "top_set_flat");
  assert.equal(stable.current.runs.distanceKm, stable.preceding.runs.distanceKm);
  const insufficient = build({ completedWorkouts: [workout("c", "2026-10-13", [[25, 10]])] });
  assert.equal(insufficient.comparison.exercises[0].status, "no_preceding_match");
});

test("does not mutate supplied workout or health records", () => {
  const completedWorkouts = [workout("c", "2026-10-13", [[25, 10]])];
  const runs = [{ date: "2026-10-13", distanceKm: 5, durationMinutes: 30 }];
  const stepsByDate = { "2026-10-13": 5000 };
  const before = JSON.stringify({ completedWorkouts, runs, stepsByDate });
  build({ completedWorkouts, runs, stepsByDate });
  assert.equal(JSON.stringify({ completedWorkouts, runs, stepsByDate }), before);
});
