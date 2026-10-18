import { normalizeRobCoachingProfile } from "./robCoachingProfile.js";

const DAY_MS = 86400000;
const MAX_EXERCISES = 24;
const MAX_RUNS = 14;
const MAX_SESSIONS = 35;
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateOnly = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const number = (value) => value === null || value === undefined || String(value).trim() === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const unitFor = (workout, exercise, set) => {
  const raw = set?.unit ?? exercise?.weightUnit ?? workout?.weightUnit;
  const unit = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (["kg", "kgs", "kilogram", "kilograms"].includes(unit)) return "kg";
  if (["lb", "lbs", "pound", "pounds"].includes(unit)) return "lb";
  // Old Fitbot records were metric but did not always persist a unit.
  if (workout?.scheduleDayId && workout?.routineDayId && workout?.routineDayName) return "kg";
  return null;
};
const rounded = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

export function weeklyBounds(selectedDate) {
  if (!dateOnly(selectedDate)) throw new Error("weekly_review_invalid_date");
  const selected = new Date(`${selectedDate}T12:00:00`);
  selected.setHours(12, 0, 0, 0);
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
  const start = localDate(monday);
  const endDate = new Date(monday);
  endDate.setDate(monday.getDate() + 6);
  const priorDate = new Date(monday);
  priorDate.setDate(monday.getDate() - 7);
  const priorStart = localDate(priorDate);
  const priorEnd = new Date(monday);
  priorEnd.setDate(monday.getDate() - 1);
  return { start, end: localDate(endDate), priorStart, priorEnd: localDate(priorEnd) };
}

function workoutDate(workout) {
  const value = workout?.completedAt?.toDate?.() ?? workout?.completedAt;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDate(date);
}

function summariseStrength(workouts, start, end) {
  const selected = (Array.isArray(workouts) ? workouts : []).map((workout) => ({ workout, date: workoutDate(workout) }))
    .filter(({ date, workout }) => date >= start && date <= end && Array.isArray(workout?.exercises))
    .sort((a, b) => a.date.localeCompare(b.date));
  const byExercise = new Map();
  const sessions = [];
  let workingSets = 0;
  let incompleteSets = 0;
  for (const { workout, date } of selected) {
    let sessionSets = 0;
    for (const exercise of workout.exercises) {
      const key = typeof exercise?.exerciseId === "string" ? exercise.exerciseId.trim().slice(0, 120) : "";
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      if (!key) { incompleteSets += sets.length; continue; }
      for (const set of sets) {
        const reps = number(set?.reps);
        const load = number(set?.weight);
        if (!(reps > 0) || load === null || load < 0) { incompleteSets++; continue; }
        const unit = unitFor(workout, exercise, set);
        const entry = byExercise.get(key) ?? { exerciseId: key, name: String(exercise.exerciseName ?? exercise.name ?? key).slice(0, 100), workingSets: 0, reps: 0, loads: [], units: new Set(), missingUnits: 0, dates: new Set() };
        entry.workingSets++;
        entry.reps += reps;
        entry.dates.add(date);
        if (unit) entry.units.add(unit); else entry.missingUnits++;
        entry.loads.push({ load, reps, unit });
        byExercise.set(key, entry);
        workingSets++;
        sessionSets++;
      }
    }
    if (sessionSets) sessions.push({ date, routine: String(workout.routineName ?? workout.routineDayName ?? "Workout").slice(0, 80), workingSets: sessionSets });
  }
  const exercises = [...byExercise.values()].sort((a, b) => b.workingSets - a.workingSets || a.exerciseId.localeCompare(b.exerciseId));
  return {
    sessionCount: sessions.length, workingSets, incompleteSets,
    sessions: sessions.slice(0, MAX_SESSIONS), omittedSessions: Math.max(0, sessions.length - MAX_SESSIONS),
    exercises: exercises.slice(0, MAX_EXERCISES).map((entry) => ({
      exerciseId: entry.exerciseId, name: entry.name, workingSets: entry.workingSets, reps: entry.reps,
      sessions: entry.dates.size, units: [...entry.units].sort(), missingUnits: entry.missingUnits,
      // Keep one best same-unit working set for a conservative comparison.
      bestSets: [...entry.units].sort().map((unit) => entry.loads.filter((set) => set.unit === unit)
        .sort((a, b) => b.load - a.load || b.reps - a.reps)[0]).map(({ load, reps, unit }) => ({ load, reps, unit })),
    })),
    omittedExercises: Math.max(0, exercises.length - MAX_EXERCISES),
  };
}

function summariseRuns(runs, start, end) {
  const selected = (Array.isArray(runs) ? runs : []).filter((run) => dateOnly(run?.date) && run.date >= start && run.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  let distanceKm = 0, durationMinutes = 0, distanceEntries = 0, durationEntries = 0;
  const details = selected.map((run) => {
    const distance = number(run.distanceKm), duration = number(run.durationMinutes);
    if (distance > 0) { distanceKm += distance; distanceEntries++; }
    if (duration > 0) { durationMinutes += duration; durationEntries++; }
    return { date: run.date, distanceKm: distance > 0 ? distance : null, durationMinutes: duration > 0 ? duration : null,
      paceMinutesPerKm: distance > 0 && duration > 0 ? rounded(duration / distance, 2) : null };
  });
  return { count: selected.length, distanceKm: rounded(distanceKm, 2), distanceEntries, durationMinutes: rounded(durationMinutes, 1), durationEntries,
    runs: details.slice(0, MAX_RUNS), omittedRuns: Math.max(0, details.length - MAX_RUNS) };
}

function summariseSteps(steps, start, end) {
  const days = [];
  let total = 0, recordedDays = 0, zeroDays = 0;
  for (let time = Date.parse(`${start}T00:00:00Z`); time <= Date.parse(`${end}T00:00:00Z`); time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    const value = Object.hasOwn(steps ?? {}, date) ? steps[date] : null;
    const count = Number.isSafeInteger(value) && value >= 0 ? value : null;
    days.push({ date, steps: count });
    if (count !== null) { total += count; recordedDays++; if (count === 0) zeroDays++; }
  }
  return { recordedDays, missingDays: 7 - recordedDays, zeroDays, total, averageRecordedDay: recordedDays ? Math.round(total / recordedDays) : null, days };
}

function compareExercise(current, previous, profile) {
  const prior = new Map(previous.exercises.map((exercise) => [exercise.exerciseId, exercise]));
  return current.exercises.map((exercise) => {
    const before = prior.get(exercise.exerciseId);
    if (!before) return { exerciseId: exercise.exerciseId, name: exercise.name, status: "no_preceding_match" };
    const matches = exercise.bestSets.flatMap((set) => before.bestSets.filter((old) => old.unit === set.unit).map((old) => ({ set, old })));
    let status = "insufficient_comparable_evidence";
    if (matches.length === 1 && !exercise.missingUnits && !before.missingUnits) {
      const { set, old } = matches[0];
      if ((set.load > old.load && set.reps >= old.reps) || (set.load === old.load && set.reps > old.reps)) status = "top_set_progressed";
      else if ((set.load < old.load && set.reps <= old.reps) || (set.load === old.load && set.reps < old.reps)) status = "top_set_declined";
      else if (set.load === old.load && set.reps === old.reps) status = "top_set_flat";
      else if (set.load > old.load && set.reps < old.reps && profile.progression.method === "double_progression") status = "possible_double_progression_reset";
      else status = "mixed_load_rep_change";
    }
    return { exerciseId: exercise.exerciseId, name: exercise.name, status, currentWorkingSets: exercise.workingSets,
      previousWorkingSets: before.workingSets, currentBestSets: exercise.bestSets, previousBestSets: before.bestSets };
  });
}

export function buildRobWeeklyContext({ selectedDate = null, completedWorkouts = [], runs = [], stepsByDate = {}, coachingProfile = null, now = new Date() }) {
  const reviewedDate = selectedDate ?? localDate(now);
  const bounds = weeklyBounds(reviewedDate);
  const profile = normalizeRobCoachingProfile(coachingProfile);
  const period = (start, end) => ({ start, end, strength: summariseStrength(completedWorkouts, start, end), runs: summariseRuns(runs, start, end), steps: summariseSteps(stepsByDate, start, end) });
  const current = period(bounds.start, bounds.end);
  const preceding = period(bounds.priorStart, bounds.priorEnd);
  return {
    version: 1, requestType: "weekly_review", calendar: "device_local_monday_sunday", selectedDate: reviewedDate,
    current, preceding,
    comparison: { exercises: compareExercise(current.strength, preceding.strength, profile),
      stepTotalsComparable: current.steps.recordedDays === 7 && preceding.steps.recordedDays === 7,
      runDistanceComparable: current.runs.distanceEntries === current.runs.count && preceding.runs.distanceEntries === preceding.runs.count },
    evidenceLimits: { currentWeekInProgress: bounds.end >= localDate(now), noUnloggedActivityAssumed: true,
      profileSource: Object.values(profile).some((value) => Array.isArray(value) ? value.length : value && typeof value === "object" && Object.values(value).some(Boolean)) ? "account_profile" : "unknown", omittedExerciseDetails: current.strength.omittedExercises + preceding.strength.omittedExercises,
      omittedSessionDetails: current.strength.omittedSessions + preceding.strength.omittedSessions,
      omittedRunDetails: current.runs.omittedRuns + preceding.runs.omittedRuns,
      workoutsWithUnusableDates: (Array.isArray(completedWorkouts) ? completedWorkouts : []).filter((workout) => !workoutDate(workout)).length },
    profile,
  };
}
