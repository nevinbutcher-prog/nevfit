const text = (value) => typeof value === "string" ? value.trim() : "";

export function formatProgramRestPeriod(seconds) {
  if (!Number.isInteger(seconds)) return "";
  if (seconds < 60) return `${seconds}s rest`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s rest` : `${minutes}m rest`;
}

export function createRobProgramCandidateDetails(generation) {
  const candidate = generation?.candidate;
  const program = candidate?.candidate?.program;
  if (generation?.status !== "success" || !program || !Array.isArray(program.days)) return null;
  const catalogue = new Map((candidate.catalogue?.entries ?? generation?.catalogue?.entries ?? []).map((entry) => [entry.id, entry]));
  const groupLabels = new Map();
  let nextGroup = 1;
  const labelForGroup = (key) => {
    if (!key) return null;
    if (!groupLabels.has(key)) {
      groupLabels.set(key, `Superset ${nextGroup}`);
      nextGroup += 1;
    }
    return groupLabels.get(key);
  };
  return {
    name: text(program.name),
    summary: text(program.summary),
    explanation: text(candidate.explanation),
    routines: program.days.map((day, index) => ({
      key: `${index}-${text(day.name)}`,
      name: text(day.name),
      focus: text(day.focus),
      exercises: Array.isArray(day.exercises) ? day.exercises.map((exercise, exerciseIndex) => ({
        key: `${exerciseIndex}-${text(exercise.exerciseRef)}`,
        name: text(catalogue.get(exercise.exerciseId)?.name) || text(exercise.exerciseRef) || text(exercise.exerciseId),
        prescription: `${exercise.sets} sets · ${text(exercise.repRange)}`,
        rest: formatProgramRestPeriod(exercise.restSeconds),
        note: text(exercise.note),
        superset: labelForGroup(text(exercise.proposalGroupKey)),
      })) : [],
    })),
  };
}