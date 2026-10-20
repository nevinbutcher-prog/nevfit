export function getTodayHeadline({ routineDay, completedWorkout, run }) {
  if (completedWorkout) return `✓ ${routineDay.name} Complete`;
  if (routineDay) return routineDay.name;
  if (Number(run?.distanceKm) > 0) return `${Number(run.distanceKm).toLocaleString()} km run`;
  if (run) return "Run logged today";
  return "Rest from strength training";
}

export function getTodayRestDescription(run, formatRunDetails) {
  return run
    ? `${formatRunDetails(run)} · Rest from strength training`
    : "No strength workout scheduled today.";
}
