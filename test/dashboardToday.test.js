import assert from "node:assert/strict";
import { test } from "node:test";
import { getTodayHeadline, getTodayRestDescription } from "../src/services/dashboardToday.js";

test("today distinguishes a completed run from strength rest without inventing values", () => {
  assert.equal(getTodayHeadline({ run: { distanceKm: 5 } }), "5 km run");
  assert.equal(getTodayRestDescription({ distanceKm: 5 }, () => "5 km · 31 min"), "5 km · 31 min · Rest from strength training");
  assert.equal(getTodayHeadline({ run: { date: "2026-10-20" } }), "Run logged today");
  assert.equal(getTodayHeadline({}), "Rest from strength training");
});

test("scheduled and completed strength workouts take precedence and retain actions", () => {
  const routineDay = { name: "Upper Body" };
  assert.equal(getTodayHeadline({ routineDay, run: { distanceKm: 5 } }), "Upper Body");
  assert.equal(getTodayHeadline({ routineDay, completedWorkout: { id: "done" } }), "✓ Upper Body Complete");
});
