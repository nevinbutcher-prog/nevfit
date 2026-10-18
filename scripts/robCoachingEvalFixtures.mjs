// Synthetic cases only. No account data is read by this evaluation.
export const catalogueIds = [
  "wger-73", "wger-75", "wger-81", "wger-82", "wger-83", "wger-91",
  "wger-92", "wger-95", "wger-145", "wger-184", "wger-203", "wger-204",
  "wger-205", "wger-211", "wger-222", "wger-237", "wger-257", "wger-294",
  "wger-310", "wger-348", "wger-507", "wger-537", "wger-566", "wger-567",
  "wger-659", "wger-695", "wger-723", "wger-1117", "wger-1185", "wger-1283",
  "wger-1378", "wger-1652",
];

export const syntheticProfile = {
  goals: ["Hypertrophy", "Shoulders", "Arms"],
  equipment: ["Dumbbells", "Barbell", "Bench", "Cable machine"],
  constraints: [
    "No leg press available",
    "Heavy unsupported hinges aggravate lower-back discomfort",
    "Dislikes behind-the-neck pressing",
  ],
  trainingStyle: { rotation: "4 day rotation", targetSessionMinutes: 60, setting: "Home gym" },
};

const row = (id, exerciseId, name, sets = 3) => ({
  routineExerciseId: id, exerciseId, name, sets, repRange: "8-12", restSeconds: 90,
});

export const syntheticProgram = {
  id: "synthetic-program", name: "Four-day hypertrophy", days: [
    { id: "upper-a", name: "Upper A", exercises: [row("row-bench", "wger-75", "Dumbbell bench press"), row("row-cable", "wger-1117", "Seated cable row"), row("row-raise", "wger-348", "Lateral raise")] },
    { id: "lower-a", name: "Lower A", exercises: [row("row-split", "wger-205", "Dumbbell lunge"), row("row-hip", "wger-294", "Hip thrust")] },
    { id: "upper-b", name: "Upper B", exercises: [row("row-press", "wger-567", "Dumbbell shoulder press"), row("row-pull", "wger-723", "Wide-grip pulldown"), row("row-curl", "wger-92", "Dumbbell curl")] },
    { id: "lower-b", name: "Lower B", exercises: [row("row-squat", "wger-203", "Goblet squat"), row("row-rdl", "wger-1652", "Dumbbell Romanian deadlift")] },
  ],
};

const workout = (id, date, routineId, exercises) => ({
  id, completedAt: date, routineDayId: routineId, routineDayName: routineId,
  scheduleDayId: "monday", weightUnit: "kg",
  exercises: exercises.map(([exerciseId, exerciseName, weights]) => ({
    exerciseId, exerciseName,
    sets: weights.map((weight, index) => ({ setNumber: index + 1, weight: String(weight), reps: "10" })),
  })),
});

export const syntheticWeek = [
  workout("wk1-upper", "2026-09-21T08:00:00Z", "upper-a", [["wger-75", "Dumbbell bench press", [25, 25, 25]], ["wger-1117", "Seated cable row", [45, 45, 45]]]),
  workout("wk1-lower", "2026-09-23T08:00:00Z", "lower-a", [["wger-205", "Dumbbell lunge", [16, 16, 16]], ["wger-294", "Hip thrust", [60, 60, 60]]]),
  workout("wk2-upper", "2026-09-28T08:00:00Z", "upper-a", [["wger-75", "Dumbbell bench press", [27.5, 27.5, 27.5]], ["wger-1117", "Seated cable row", [47.5, 47.5, 47.5]]]),
  workout("wk2-lower", "2026-09-30T08:00:00Z", "lower-a", [["wger-205", "Dumbbell lunge", [18, 18, 18]], ["wger-294", "Hip thrust", [62.5, 62.5, 62.5]]]),
];

const baseRequirements = {
  version: 1, goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 60,
  priorities: ["balanced", "shoulders", "arms"], environment: "home_gym",
  equipment: ["dumbbells", "barbell", "cables", "machines", "bench"],
  constraints: "No leg press. Heavy unsupported hinges aggravate lower-back discomfort. Avoid behind-the-neck pressing.",
};

export const scenarios = [
  {
    id: "session-60", type: "program", title: "60-minute hypertrophy session",
    requirements: { ...baseRequirements, daysPerWeek: 1, priorities: ["shoulders", "arms"] },
    checks: ["Practical exercise order and selection", "Plausible 60-minute workload", "Respects equipment and discomfort constraints"],
  },
  {
    id: "program-four-day", type: "program", title: "Four-day shoulder and arm emphasis",
    requirements: baseRequirements,
    checks: ["Whole-week coverage with modest shoulder and arm emphasis", "Recovery and repetition across days", "Feasible 60-minute sessions"],
  },
  {
    id: "questionable-exercise", type: "advice", title: "Unconventional exercise selection",
    question: "Axe Hold was placed ahead of a conventional lateral raise for shoulder hypertrophy in my 60-minute session. Is that a good choice? Be candid and suggest the smallest useful correction.",
    checks: ["Questions the unusual choice rather than rationalising it", "Suggests a conventional alternative", "Does not invent clinical safety claims"],
  },
  {
    id: "training-week", type: "advice", title: "Completed training-week review",
    question: "Compare my latest complete training week with the preceding week. What genuinely progressed, what is uncertain, and what should I do next?",
    workouts: syntheticWeek,
    checks: ["Uses only visible logged evidence", "Does not invent missing prior sessions", "Identifies the context limit when comparison is impossible"],
  },
  {
    id: "follow-up", type: "advice", title: "Follow-up conversation continuity",
    question: "Last time we agreed which row variation I liked and why. Should I keep it in Upper A this week? Also remember the movements I dislike.",
    checks: ["Does not pretend to remember an absent prior turn", "Respects supplied dislikes and discomfort", "Asks only for information needed to decide"],
  },
];
