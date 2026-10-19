// Offline contract prototype. Never imported by production code.
import { getPreviousExercisePerformance } from "../src/services/workoutSnapshots.js";

const meaningful = (set) => Number(set?.reps) > 0 || Number(set?.weight) > 0;

export function prototypePreviousPerformance({ catalogueRows, targetRow, completedWorkouts }) {
  const row = catalogueRows.find((item) => item.sourceRow === targetRow);
  if (!row) return { performance: null, reason: "unknown_catalogue_row" };
  const oldId = row.historicalWgerId;
  if (!oldId) return { performance: null, reason: "no_explicit_historical_link" };
  if (catalogueRows.filter((item) => item.historicalWgerId === oldId).length > 1) {
    return { performance: null, reason: "ambiguous_shared_historical_id" };
  }
  return {
    performance: getPreviousExercisePerformance(oldId, completedWorkouts, meaningful),
    reason: "explicit_unique_historical_link",
  };
}
