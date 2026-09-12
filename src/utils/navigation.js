export const DEFAULT_VIEW_MODE = "dashboard";

export function getInitialViewMode() {
  return DEFAULT_VIEW_MODE;
}

export function getViewModeForLoadedActiveWorkout(activeWorkoutSession) {
  return activeWorkoutSession ? "workout" : DEFAULT_VIEW_MODE;
}
