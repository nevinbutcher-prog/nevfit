export const DEFAULT_VIEW_MODE = "dashboard";

export function getInitialViewMode() {
  return DEFAULT_VIEW_MODE;
}

export function getViewModeForLoadedActiveWorkout(activeWorkoutSession) {
  return activeWorkoutSession ? "workout" : DEFAULT_VIEW_MODE;
}

export function getViewModeAfterWorkout(action) {
  if (action?.type === "open-workout" || action?.type === "open-saved-workout") return "workout";
  if (action?.type === "change-assignment") return "planner";
  return DEFAULT_VIEW_MODE;
}
