import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createEmptySchedule, createEmptyPlanningState, hasWeeklyCheckInEvidence } from "../src/services/accountInitialization.js";
import { createQuickWorkoutSession } from "../src/services/workoutSnapshots.js";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
function actualFunction(name, context) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  return runInNewContext(`${app.slice(start, app.indexOf("\n}\n", start) + 2)}; ${name}`, context);
}

test("empty server programs remain empty on repeated login; a real Starter Program remains ordinary saved data", async () => {
  let cloud = [];
  const cache = [{ id: "starter-program", name: "Starter Program", days: [] }];
  const writes = [];
  const load = actualFunction("loadUserPrograms", {
    loadCloudPrograms: async () => cloud, normalizeProgramDefinitions: (value) => value,
    assertCurrentCache: () => {}, loadStoredProgramCache: () => cache,
    persistPrograms: (value) => writes.push(value),
  });
  assert.deepEqual(await load("fixture"), []);
  assert.deepEqual(await load("fixture"), []);
  assert.deepEqual(writes, [], "stale non-empty cache is retained for recovery, never uploaded");
  cloud = cache;
  assert.deepEqual(await load("fixture"), cache);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].id, "starter-program");
});

test("connectivity failure is unavailable, not an empty result or an instruction to seed programs", async () => {
  const load = actualFunction("loadUserPrograms", {
    loadCloudPrograms: async () => { throw new Error("offline"); },
    normalizeProgramDefinitions: (value) => value,
    persistPrograms: () => assert.fail("must not overwrite cache"),
  });
  await assert.rejects(load("fixture"), /offline/);
  const normalize = actualFunction("normalizeProgramDefinitions", {});
  assert.deepEqual(Array.from(normalize([])), []);
  assert.equal(normalize(null), null);
});

test("new planning/selection has no fabricated assignments or cycle, and Quick Workout is independent", () => {
  const schedule = createEmptySchedule();
  assert.equal(schedule.length, 7);
  assert.ok(schedule.every((day) => day.routineDayId === null && day.note === ""));
  assert.deepEqual(createEmptyPlanningState(), { schedule, activeProgramId: null, cycleStartDate: "", cycleLengthWeeks: "" });
  const current = actualFunction("getCurrentPlanningState", {});
  assert.equal(current({ schedule, selectedProgramId: null }).activeProgramId, null);
  assert.deepEqual(createQuickWorkoutSession(), { sessionKind: "quick", exercises: [] });
});

test("first check-in needs real prior evidence, while saved reviews and experienced users retain access", () => {
  const input = { period: { end: "2026-11-08" }, completedWorkouts: [], runs: [], stepsByDate: {}, savedReview: null };
  assert.equal(hasWeeklyCheckInEvidence(input), false);
  assert.equal(hasWeeklyCheckInEvidence({ ...input, stepsByDate: { "2026-11-10": 1000 } }), false);
  assert.equal(hasWeeklyCheckInEvidence({ ...input, stepsByDate: { "2026-11-07": 0 } }), true);
  assert.equal(hasWeeklyCheckInEvidence({ ...input, savedReview: { text: "Saved" } }), true);
  assert.equal(hasWeeklyCheckInEvidence({ ...input, completedWorkouts: [{ completedAt: "2026-10-01T12:00:00", exercises: [{ sets: [{ reps: "8", weight: "20" }] }] }] }), true);
});
