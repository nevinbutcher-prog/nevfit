import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateMuscleWorkload, getMuscleGroupId, getWorkloadGroups,
  getWorkloadWindow, isCompletedWorkingSet,
} from "../src/services/muscleWorkload.js";

const workout = (completedAt, exerciseId, sets, exerciseName = "Saved exercise") => ({
  completedAt, exercises: [{ exerciseId, exerciseName, sets }],
});
const set = (reps = "8", weight = "20", completed) => ({ reps, weight, ...(completed === undefined ? {} : { completed }) });

test("local calendar windows start on Monday or include seven local dates", () => {
  const now = new Date(2026, 9, 20, 23, 45);
  const thisWeek = getWorkloadWindow("this-week", now);
  const lastWeek = getWorkloadWindow("last-week", now);
  const lastSeven = getWorkloadWindow("last-seven-days", now);
  assert.deepEqual([thisWeek.start.getDate(), thisWeek.end.getDate()], [19, 26]);
  assert.deepEqual([lastWeek.start.getDate(), lastWeek.end.getDate()], [12, 19]);
  assert.deepEqual([lastSeven.start.getDate(), lastSeven.end.getDate()], [14, 21]);
  assert.equal(thisWeek.start.getHours(), 0);
});

test("uses only completed working sets in the selected history window", () => {
  const now = new Date(2026, 9, 20, 12);
  const records = [
    workout(new Date(2026, 9, 19, 8).toISOString(), "nevfit-flat-barbell-bench-press", [set(), set("", "20"), set("8", "", false)]),
    workout(new Date(2026, 9, 18, 8).toISOString(), "nevfit-flat-barbell-bench-press", [set()]),
  ];
  const result = calculateMuscleWorkload(records, "this-week", now);
  assert.equal(result.totalWorkingSets, 1);
  assert.equal(result.groups.find((group) => group.id === "chest")?.weightedSets, 1);
  assert.equal(calculateMuscleWorkload(records, "last-week", now).totalWorkingSets, 1);
});

test("rolls up specific muscles once and gives primary precedence", () => {
  assert.equal(getMuscleGroupId("front_deltoids"), "shoulders");
  assert.equal(getMuscleGroupId("mid_trapezius"), "back");
  assert.equal(getMuscleGroupId("unknown"), null);
  const groups = getWorkloadGroups("nevfit-flat-barbell-bench-press");
  assert.ok(groups);
  assert.equal(new Set([...groups.primary, ...groups.secondary]).size, groups.primary.length + groups.secondary.length);
  assert.deepEqual(groups, { primary: ["chest"], secondary: ["triceps", "shoulders"] });
});

test("post-migration IDs produce weighted totals and an exact exercise breakdown", () => {
  const now = new Date(2026, 9, 20, 12);
  const records = [
    workout(now.toISOString(), "nevfit-flat-barbell-bench-press", [set(), set()], "My bench"),
    workout(now.toISOString(), "nevfit-flat-barbell-bench-press", [set()], "My bench"),
  ];
  const result = calculateMuscleWorkload(records, "this-week", now);
  const chest = result.groups.find((group) => group.id === "chest");
  const shoulders = result.groups.find((group) => group.id === "shoulders");
  assert.equal(chest.weightedSets, 3);
  assert.equal(chest.completedSets, 3);
  assert.deepEqual(chest.exercises, [{
    id: "nevfit-flat-barbell-bench-press", name: "My bench", completedSets: 3,
    weightedSets: 3, factor: 1,
  }]);
  assert.equal(shoulders.weightedSets, 1.5);
  assert.equal(shoulders.exercises[0].completedSets, 3);
  assert.equal(shoulders.exercises[0].factor, 0.5);
  assert.equal(result.unattributedSets, 0);
});

test("legacy and unknown identities stay readable as unattributed", () => {
  const now = new Date(2026, 9, 20, 12);
  const result = calculateMuscleWorkload([
    workout(now.toISOString(), "wger-123", [set(), set()], "Original legacy name"),
    workout(now.toISOString(), "missing", [set("", "")]),
  ], "this-week", now);
  assert.equal(result.unattributedSets, 2);
  assert.equal(result.unattributedExercises[0].name, "Original legacy name");
  assert.equal(result.groups.reduce((sum, group) => sum + group.weightedSets, 0), 0);
});

test("empty and incomplete records do not create workload", () => {
  const now = new Date(2026, 9, 20, 12);
  assert.equal(isCompletedWorkingSet(set("", "30")), false);
  assert.equal(isCompletedWorkingSet(set("8", "bad")), false);
  assert.equal(calculateMuscleWorkload([workout(now.toISOString(), "nevfit-flat-barbell-bench-press", [set("", "30")])], "this-week", now).totalWorkingSets, 0);
  assert.equal(calculateMuscleWorkload([], "this-week", now).totalWorkingSets, 0);
});
