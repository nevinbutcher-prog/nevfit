import { weekSchedule } from "../data/weekSchedule.js";
import { hasMeaningfulWorkoutSet } from "./activeWorkoutSwap.js";

export function createEmptySchedule() {
  return weekSchedule.map(({ id, label }) => ({ id, label, routineDayId: null, note: "" }));
}

export function createEmptyPlanningState() {
  return { schedule: createEmptySchedule(), activeProgramId: null, cycleStartDate: "", cycleLengthWeeks: "" };
}

// Existing saved reviews stay accessible. New users need actual prior evidence,
// never a program assignment, before being offered a review of a completed week.
export function hasWeeklyCheckInEvidence({ period, completedWorkouts, runs, stepsByDate, savedReview }) {
  if (savedReview) return true;
  const priorDate = (date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= period.end;
  return completedWorkouts.some((workout) => {
    const date = new Date(workout.completedAt);
    const day = Number.isNaN(date.valueOf()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return priorDate(day) && workout.exercises.some((exercise) => exercise.sets.some(hasMeaningfulWorkoutSet));
  }) || runs.some((run) => priorDate(run.date) && (Number(run.distanceKm) > 0 || Number(run.durationMinutes) > 0)) ||
    Object.entries(stepsByDate).some(([date, steps]) => priorDate(date) && Number.isSafeInteger(steps) && steps >= 0);
}
