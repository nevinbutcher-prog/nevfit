import test from "node:test";
import assert from "node:assert/strict";
import { applyWeeklyStepDrafts, completeWeeklyCheckIn, prepareWeeklyCheckInEvidence, stepDraftsForWeek, weeklyCheckInPeriod } from "../src/services/rob/weeklyCheckIn.js";

test("Monday check-in always selects the last completed week across the year boundary", () => {
  const monday = weeklyCheckInPeriod(new Date("2026-01-05T12:00:00"));
  const sunday = weeklyCheckInPeriod(new Date("2026-01-11T12:00:00"));
  assert.equal(monday.start, "2025-12-29");
  assert.equal(monday.end, "2026-01-04");
  assert.deepEqual(sunday.dates, monday.dates);
  assert.equal(monday.daysUntilNextMonday, 7);
  assert.equal(sunday.daysUntilNextMonday, 1);
  assert.equal(weeklyCheckInPeriod(new Date("2026-01-12T12:00:00")).start, "2026-01-05");
});

test("step corrections preserve missing days and explicit zero", () => {
  const dates = ["2026-10-05", "2026-10-06", "2026-10-07"];
  const baseline = stepDraftsForWeek({ "2026-10-05": 5000, "2026-10-06": 0 }, dates);
  assert.deepEqual(baseline, { "2026-10-05": "5000", "2026-10-06": "0", "2026-10-07": "" });
  const updated = applyWeeklyStepDrafts({ "2026-10-05": 5000, "2026-10-06": 0 }, baseline, { ...baseline, "2026-10-05": "", "2026-10-07": "0" }, dates);
  assert.deepEqual(updated, { steps: { "2026-10-06": 0, "2026-10-07": 0 }, changed: true });
  assert.throws(() => applyWeeklyStepDrafts({}, baseline, { ...baseline, "2026-10-07": "-1" }, dates));
});

test("corrected steps reach cloud before context is built; failed sync blocks review preparation", async () => {
  const period = weeklyCheckInPeriod(new Date("2026-10-12T12:00:00"));
  let cloud = { steps: {}, runs: [] };
  const events = [];
  const baseline = stepDraftsForWeek(cloud.steps, period.dates);
  const drafts = { ...baseline, [period.start]: "0" };
  const options = {
    uid: "user-1", period, baseline, drafts, selfReport: null,
    waitForHealthWrites: async () => { events.push("pending writes settled"); },
    loadHealth: async () => { events.push("read health"); return cloud; },
    saveHealth: async (_uid, steps) => { events.push("save steps"); cloud = { ...cloud, steps }; },
    loadWorkouts: async () => { events.push("read workouts"); return []; },
    loadProfile: async () => { events.push("read profile"); return null; },
  };
  const prepared = await prepareWeeklyCheckInEvidence(options);
  assert.equal(prepared.context.current.steps.days[0].steps, 0);
  assert.equal(prepared.context.current.steps.days[1].steps, null);
  assert.ok(events.indexOf("save steps") < events.indexOf("read workouts"));
  events.length = 0;
  await assert.rejects(prepareWeeklyCheckInEvidence({ ...options, saveHealth: async () => { throw new Error("offline"); } }));
  assert.equal(events.includes("read workouts"), false);
});

test("saved check-in reopens without AI; save failure retains the generated response for save-only retry", async () => {
  const period = weeklyCheckInPeriod(new Date("2026-10-12T12:00:00"));
  const context = { current: { strength: { sessionCount: 2 }, runs: { count: 1 }, steps: { recordedDays: 4 } } };
  let calls = 0;
  let stored = null;
  const options = { uid: "user-1", period, context, loadReview: async () => stored, requestReview: async () => { calls++; return { text: "Keep your steady routine.", model: "test" }; }, saveReview: async (_uid, review) => { stored = review; } };
  const first = await completeWeeklyCheckIn(options);
  assert.equal(first.saved, true);
  assert.equal(first.review.weekStart, period.start);
  assert.equal(calls, 1);
  const reopened = await completeWeeklyCheckIn(options);
  assert.equal(reopened.reused, true);
  assert.equal(calls, 1);
  stored = null;
  const failedSave = await completeWeeklyCheckIn({ ...options, saveReview: async () => { throw new Error("offline"); } });
  assert.equal(failedSave.saved, false);
  assert.equal(failedSave.review.text, "Keep your steady routine.");
  await options.saveReview("user-1", failedSave.review);
  assert.equal(calls, 2);
});
