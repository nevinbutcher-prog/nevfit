export const MAX_EXERCISE_NOTE_LENGTH = 4000;

export function normalizeExerciseNotes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([exerciseId, note]) =>
        typeof exerciseId === "string" &&
        exerciseId.length > 0 &&
        typeof note === "string" &&
        note.length > 0 &&
        note.length <= MAX_EXERCISE_NOTE_LENGTH,
    ),
  );
}

export function setExerciseNote(notes, exerciseId, note) {
  const nextNotes = { ...notes };
  if (note) {
    nextNotes[exerciseId] = note;
  } else {
    delete nextNotes[exerciseId];
  }
  return nextNotes;
}
