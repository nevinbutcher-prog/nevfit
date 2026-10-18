import test from "node:test";
import assert from "node:assert/strict";
import { emptyRobCoachingProfile, normalizeRobCoachingProfile, parseRobProfileList, robCoachingProfileDocumentSegments } from "../src/services/rob/robCoachingProfile.js";
import { buildRobContext, ROB_CONTEXT_TYPES } from "../src/services/rob/robContext.js";
import { buildRobWeeklyContext } from "../src/services/rob/robWeeklyContext.js";

test("new users have unknown preferences and no inherited personal training facts", () => {
  const empty = emptyRobCoachingProfile();
  assert.deepEqual(empty.goals, []);
  assert.equal(empty.progression.method, null);
  assert.equal(empty.trainingStyle.setting, null);
  assert.deepEqual(normalizeRobCoachingProfile(null), empty);
  assert.deepEqual(buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE }).profile, empty);
});

test("two account profiles remain independent across advice and weekly contexts", () => {
  assert.deepEqual(robCoachingProfileDocumentSegments("user-a"), ["users", "user-a", "appState", "robCoaching"]);
  assert.deepEqual(robCoachingProfileDocumentSegments("user-b"), ["users", "user-b", "appState", "robCoaching"]);
  assert.throws(() => robCoachingProfileDocumentSegments("user-b/other"));
  const first = normalizeRobCoachingProfile({ version: 1, goals: ["Strength"], equipment: ["Barbell"], progression: { method: "double_progression", rule: "Increase after every set reaches 12 reps" } });
  const second = normalizeRobCoachingProfile({ version: 1, goals: ["Running"], equipment: ["Treadmill"], progression: { method: "other", rule: "Maintain pace" } });
  const adviceFirst = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, coachingProfile: first });
  const adviceSecond = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, coachingProfile: second });
  const weeklyFirst = buildRobWeeklyContext({ selectedDate: "2026-10-14", coachingProfile: first });
  const weeklySecond = buildRobWeeklyContext({ selectedDate: "2026-10-14", coachingProfile: second });
  assert.deepEqual(adviceFirst.profile.goals, ["Strength"]);
  assert.deepEqual(adviceSecond.profile.goals, ["Running"]);
  assert.equal(weeklyFirst.profile.progression.method, "double_progression");
  assert.equal(weeklySecond.profile.progression.method, "other");
  assert.doesNotMatch(JSON.stringify(weeklySecond), /Barbell|Increase after every/);
});

test("profile inputs are bounded and do not learn a progression method from logs", () => {
  assert.deepEqual(parseRobProfileList(" shoulders, arms, shoulders "), ["shoulders", "arms"]);
  const normalized = normalizeRobCoachingProfile({ version: 1, goals: ["x".repeat(200)], progression: { method: "unrecorded", rule: "" }, trainingStyle: { targetSessionMinutes: 999 } });
  assert.equal(normalized.goals[0].length, 100);
  assert.equal(normalized.progression.method, null);
  assert.equal(normalized.trainingStyle.targetSessionMinutes, null);
});
