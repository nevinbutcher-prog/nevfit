import { buildRobWeeklyContext, weeklyBounds } from "./robWeeklyContext.js";

const addDays = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export function weeklyCheckInPeriod(now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const current = weeklyBounds(today);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(current.priorStart, index));
  return {
    start: current.priorStart,
    end: current.priorEnd,
    precedingStart: addDays(current.priorStart, -7),
    precedingEnd: addDays(current.priorStart, -1),
    nextMonday: addDays(current.start, 7),
    daysUntilNextMonday: Math.round((Date.parse(`${addDays(current.start, 7)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000),
    dates,
  };
}

export function stepDraftsForWeek(steps, dates) {
  return Object.fromEntries(dates.map((date) => [date, Number.isSafeInteger(steps?.[date]) && steps[date] >= 0 ? String(steps[date]) : ""]));
}

export function applyWeeklyStepDrafts(cloudSteps, baseline, drafts, dates) {
  const next = { ...cloudSteps };
  let changed = false;
  for (const date of dates) {
    const value = String(drafts[date] ?? "").trim();
    if (value === String(baseline[date] ?? "")) continue;
    if (value === "") delete next[date];
    else {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("invalid_steps");
      next[date] = Number(value);
    }
    changed = true;
  }
  return { steps: next, changed };
}

export async function prepareWeeklyCheckInEvidence({ uid, period, baseline, drafts, selfReport, waitForHealthWrites, loadHealth, saveHealth, loadWorkouts, loadProfile, isCurrent = () => true }) {
  await waitForHealthWrites();
  if (!isCurrent()) throw new Error("stale_weekly_check_in");
  const cloudHealth = await loadHealth(uid);
  if (!isCurrent()) throw new Error("stale_weekly_check_in");
  const updated = applyWeeklyStepDrafts(cloudHealth?.steps ?? {}, baseline, drafts, period.dates);
  if (updated.changed) await saveHealth(uid, updated.steps, { documentExists: cloudHealth !== null });
  if (!isCurrent()) throw new Error("stale_weekly_check_in");
  const [health, workouts, profile] = await Promise.all([loadHealth(uid), loadWorkouts(uid), loadProfile(uid)]);
  if (!isCurrent()) throw new Error("stale_weekly_check_in");
  const context = buildRobWeeklyContext({
    selectedDate: period.start, completedWorkouts: workouts, runs: health?.runs ?? [], stepsByDate: health?.steps ?? {}, coachingProfile: profile, selfReport,
  });
  return { health, context };
}

export function weeklyReviewRecord(period, result, context, completedAt = new Date()) {
  if (typeof result?.text !== "string" || !result.text.trim()) throw new Error("invalid_weekly_review_response");
  return {
    version: 1,
    weekStart: period.start,
    weekEnd: period.end,
    precedingStart: period.precedingStart,
    precedingEnd: period.precedingEnd,
    text: result.text,
    completedAt: completedAt.toISOString(),
    model: result.model ?? null,
    activity: {
      strengthSessions: context.current.strength.sessionCount,
      runs: context.current.runs.count,
      recordedStepDays: context.current.steps.recordedDays,
    },
  };
}

export async function completeWeeklyCheckIn({ uid, period, context, loadReview, requestReview, saveReview, isCurrent = () => true }) {
  const existing = await loadReview(uid, period.start);
  if (!isCurrent()) throw new Error("stale_weekly_check_in");
  if (existing) return { review: existing, saved: true, reused: true };
  const result = await requestReview({ context });
  if (!isCurrent()) throw new Error("stale_weekly_check_in");
  const review = weeklyReviewRecord(period, result, context);
  try {
    await saveReview(uid, review);
    if (!isCurrent()) throw new Error("stale_weekly_check_in");
    return { review, saved: true, reused: false };
  } catch (error) {
    if (!isCurrent()) throw error;
    return { review, saved: false, reused: false };
  }
}
