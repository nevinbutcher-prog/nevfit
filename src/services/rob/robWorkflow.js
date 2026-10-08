export const ROB_WORKFLOW_STEPS = Object.freeze({
  HOME: "home",
  ADVICE: "advice",
  PROGRAM_SELECTION: "program_selection",
  PROGRAM_REVIEW: "program_review",
  PROGRAM_BUILD: "program_build",
  ROUTINE_REVIEW: "routine_review",
});

export function getReviewablePrograms(programs) {
  return Array.isArray(programs)
    ? programs.filter((program) => program && !program.archived && typeof program.id === "string" && typeof program.name === "string" && program.name.trim())
    : [];
}

export function getPreselectedReviewProgram(programs, programId) {
  return getReviewablePrograms(programs).find((program) => program.id === programId) ?? null;
}
