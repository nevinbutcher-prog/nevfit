// Reviewed corrections are intentionally small. They apply only while the stable
// WGER ID and expected display name still agree, so a catalogue refresh cannot
// silently carry a review onto a different exercise.
export const ROB_EXERCISE_PLANNING_EXCEPTIONS_VERSION = 1;

export const ROB_EXERCISE_PLANNING_EXCEPTIONS = Object.freeze({
  "wger-73": Object.freeze({ expectedName: "Bench Press", movementPattern: "horizontal_push", role: "compound", conventionality: "standard" }),
  "wger-567": Object.freeze({ expectedName: "Shoulder Press, Dumbbells", movementPattern: "vertical_push", role: "compound", conventionality: "standard", secondary: [{ muscleGroup: "arms", involvement: "meaningful" }] }),
  "wger-723": Object.freeze({ expectedName: "Wide-grip Pulldown", movementPattern: "vertical_pull", role: "compound", conventionality: "standard" }),
  "wger-507": Object.freeze({ expectedName: "Romanian Deadlift", movementPattern: "hinge", role: "compound", conventionality: "standard", secondary: [{ muscleGroup: "glutes", involvement: "meaningful" }] }),
});
