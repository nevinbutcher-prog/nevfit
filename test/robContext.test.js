import test from "node:test";
import assert from "node:assert/strict";
import { buildRobContext, ROB_ADVICE_CONTEXT_LIMITS, ROB_CONTEXT_LIMITS, ROB_CONTEXT_TYPES, ROB_REVIEW_CONTEXT_LIMITS, RobContextError } from "../src/services/rob/robContext.js";

const program = { id: "program-1", name: "Current Program", description: "  Hypertrophy  ", days: [
  { id: "a", name: "Day A", exercises: [{ routineExerciseId: "ri-a-1", exerciseId: "press", displayNameOverride: "Incline DB Press", sets: 3, repRange: "8-12", restSeconds: 120, note: "  controlled  ", supersetGroupId: "ss-1" }] },
  { id: "b", name: "Day B", exercises: [{ routineExerciseId: "ri-b-1", exerciseId: "row", sets: 4, repRange: "10-12", restSeconds: 90 }] },
  { id: "old", name: "Archived", archived: true, exercises: [] },
] };
const workouts = [
  { id: "old", completedAt: "2026-01-01T00:00:00.000Z", routineDayId: "a", exercises: [{ exerciseId: "press", exerciseName: "Press", sets: [{ weight: "20", reps: "10" }] }] },
  { id: "new", completedAt: new Date("2026-02-01T00:00:00.000Z"), routineDayId: "a", exercises: [{ exerciseId: "press", exerciseName: "Press", originalExerciseId: "old-press", sets: [{ weight: "22.5", reps: "8" }, { weight: "", reps: "" }] }] },
  { id: "blank", completedAt: "2026-03-01T00:00:00.000Z", routineDayId: "a", exercises: [{ exerciseId: "press", sets: [{ weight: "", reps: "" }] }] },
];

test("builds deterministic routine-review context without mutating sources", () => {
  const input = { requestType: ROB_CONTEXT_TYPES.ROUTINE_REVIEW, program, routineId: "a", completedWorkouts: workouts };
  const before = structuredClone(input);
  const first = buildRobContext(input);
  assert.deepEqual(first, buildRobContext(input));
  assert.deepEqual(input, before);
  assert.deepEqual(first.target, { scope: "routine", programId: "program-1", routineId: "a" });
  assert.equal(first.program.routines.length, 1);
  assert.deepEqual(first.program.routines[0].exercises[0], { routineExerciseId: "ri-a-1", exerciseId: "press", name: "Incline DB Press", sets: 3, repRange: "8-12", restSeconds: 120, note: "controlled", supersetGroupId: "ss-1" });
  assert.deepEqual(first.history.workouts.map((workout) => workout.id), ["new", "old"]);
  assert.equal(first.history.workouts[0].exercises[0].originalExerciseId, "old-press");
});

test("advice supports profile-only and optional program context", () => {
  const profileOnly = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE });
  assert.equal(profileOnly.program, null);
  assert.deepEqual(profileOnly.history, { workouts: [] });
  assert.equal(profileOnly.target.scope, "none");
  const targeted = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, program, routineId: "b" });
  assert.equal(targeted.target.routineId, "b");
  assert.deepEqual(targeted.program.routines.map((routine) => routine.id), ["b"]);
});

test("general advice exposes the full active program without inheriting a stale routine", () => {
  const fourRoutineProgram = structuredClone(program);
  fourRoutineProgram.days = ["Upper", "Lower", "Push", "Pull"].map((name, index) => ({ id: `routine-${index}`, name, exercises: [{ routineExerciseId: `ri-${index}`, exerciseId: `exercise-${index}`, sets: 3 }] }));
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, program: fourRoutineProgram, routineId: "stale-day-a" });
  assert.equal(context.target.scope, "program");
  assert.equal(context.target.routineId, null);
  assert.deepEqual(context.program.routines.map((routine) => ({ id: routine.id, name: routine.name })), [{ id: "routine-0", name: "Upper" }, { id: "routine-1", name: "Lower" }, { id: "routine-2", name: "Push" }, { id: "routine-3", name: "Pull" }]);
});

test("advice context stays compact for realistic routine and history data", () => {
  const current = structuredClone(program);
  current.days[0].exercises = Array.from({ length: 8 }, (_, index) => ({ routineExerciseId: `ri-${index}`, exerciseId: `exercise-${index}`, sets: 3, repRange: "8-12", restSeconds: 90, note: "Controlled working sets" }));
  const history = Array.from({ length: 8 }, (_, workoutIndex) => ({ id: `workout-${workoutIndex}`, completedAt: `2026-02-${String(8 - workoutIndex).padStart(2, "0")}T00:00:00Z`, routineDayId: "a", exercises: Array.from({ length: 10 }, (_, exerciseIndex) => ({ exerciseId: `exercise-${exerciseIndex}`, exerciseName: `Exercise ${exerciseIndex}`, sets: Array.from({ length: 6 }, () => ({ weight: "22.5", reps: "10" })) })) }));
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, program: current, routineId: "a", completedWorkouts: history });
  assert.equal(context.history.workouts.length, ROB_ADVICE_CONTEXT_LIMITS.historyWorkouts);
  assert.equal(context.history.workouts[0].exercises.length, 10);
  assert.equal(context.history.workouts[0].exercises[0].sets.length, 6);
  assert.ok(JSON.stringify(context).length < 5000);
});

test("full-program advice remains below the server prompt cap", () => {
  const fullProgram = { id: "full", name: "Full program", days: Array.from({ length: 4 }, (_, routineIndex) => ({ id: `routine-${routineIndex}`, name: `Routine ${routineIndex}`, exercises: Array.from({ length: 8 }, (_, exerciseIndex) => ({ routineExerciseId: `ri-${routineIndex}-${exerciseIndex}`, exerciseId: `exercise-${routineIndex}-${exerciseIndex}`, sets: 3, repRange: "8-12", restSeconds: 90, note: "Controlled working sets" })) })) };
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, program: fullProgram });
  assert.equal(context.target.scope, "program");
  assert.equal(context.program.routines.length, 4);
  assert.ok(JSON.stringify(context).length < 12000);
});

test("program review includes active routines in order and excludes archived routines", () => {
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW, program, completedWorkouts: workouts });
  assert.deepEqual(context.program.routines.map((routine) => routine.id), ["a", "b"]);
  assert.equal(context.target.routineId, null);
  assert.equal(context.target.scope, "program");
});

test("realistic full-program review retains prescriptions and stays within the review boundary", () => {
  const reviewProgram = { id: "pcyc", name: "PCYC 1", days: Array.from({ length: 4 }, (_, routineIndex) => ({ id: `routine-${routineIndex}`, name: `Routine ${routineIndex + 1}`, exercises: Array.from({ length: 8 }, (_, exerciseIndex) => ({ routineExerciseId: `ri-${routineIndex}-${exerciseIndex}`, exerciseId: `exercise-${routineIndex}-${exerciseIndex}`, sets: 3, repRange: "8-12", restSeconds: 90, note: "Controlled working sets" })) })) };
  const history = Array.from({ length: 6 }, (_, workoutIndex) => ({ id: `workout-${workoutIndex}`, completedAt: `2026-02-${String(20 - workoutIndex).padStart(2, "0")}T00:00:00Z`, routineDayId: "routine-0", exercises: Array.from({ length: 10 }, (_, exerciseIndex) => ({ exerciseId: `exercise-${exerciseIndex}`, sets: Array.from({ length: 5 }, () => ({ weight: "22.5", reps: "10" })) })) }));
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW, program: reviewProgram, completedWorkouts: history });
  assert.equal(context.program.routines.length, 4);
  assert.equal(context.history.workouts.length, ROB_REVIEW_CONTEXT_LIMITS.historyWorkouts);
  assert.equal(context.history.workouts[0].exercises.length, ROB_REVIEW_CONTEXT_LIMITS.exercisesPerWorkout);
  assert.equal(context.history.workouts[0].exercises[0].sets.length, ROB_REVIEW_CONTEXT_LIMITS.setsPerExercise);
  assert.ok(JSON.stringify(context).length < 12000);
});

test("normalizes absent prescription values to null while preserving numeric strings", () => {
  const sparse = structuredClone(program);
  sparse.days[0].exercises = [
    { routineExerciseId: "missing", exerciseId: "missing", sets: null, restSeconds: "" },
    { routineExerciseId: "numeric", exerciseId: "numeric", sets: "3", restSeconds: "90" },
  ];
  const exercises = buildRobContext({ requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW, program: sparse }).program.routines[0].exercises;
  assert.equal(exercises[0].sets, null);
  assert.equal(exercises[0].restSeconds, null);
  assert.equal(exercises[1].sets, 3);
  assert.equal(exercises[1].restSeconds, 90);
});

test("validates required review targets and request types", () => {
  for (const input of [{ requestType: "other" }, { requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW }, { requestType: ROB_CONTEXT_TYPES.ROUTINE_REVIEW, program }, { requestType: ROB_CONTEXT_TYPES.ROUTINE_REVIEW, program, routineId: "missing" }]) {
    assert.throws(() => buildRobContext(input), (error) => error instanceof RobContextError);
  }
});

test("bounds large contexts and excludes identity data", () => {
  const large = structuredClone(program);
  large.days = Array.from({ length: ROB_CONTEXT_LIMITS.routines + 2 }, (_, index) => ({ id: `r-${index}`, name: `Routine ${index}`, exercises: Array.from({ length: ROB_CONTEXT_LIMITS.exercisesPerRoutine + 2 }, (_, exerciseIndex) => ({ routineExerciseId: `ri-${index}-${exerciseIndex}`, exerciseId: `e-${index}-${exerciseIndex}`, sets: 3 })) }));
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW, program: large, completedWorkouts: Array.from({ length: 20 }, (_, index) => ({ id: `w-${index}`, completedAt: `2026-01-${String((index % 9) + 1).padStart(2, "0")}T00:00:00Z`, exercises: [{ exerciseId: "e", sets: [{ weight: "1", reps: "1" }] }] })) });
  assert.equal(context.program.routines.length, ROB_CONTEXT_LIMITS.routines);
  assert.equal(context.program.routines[0].exercises.length, ROB_CONTEXT_LIMITS.exercisesPerRoutine);
  assert.equal(context.history.workouts.length, ROB_REVIEW_CONTEXT_LIMITS.historyWorkouts);
  assert.equal(JSON.stringify(context).match(/email|photoURL|providerId|uid|apiKey|OPENROUTER_API_KEY/), null);
});

test("bounds exercises and sets within each serialized history workout", () => {
  const exercises = Array.from({ length: ROB_CONTEXT_LIMITS.exercisesPerWorkout + 2 }, (_, index) => ({
    exerciseId: `history-${index}`,
    sets: Array.from({ length: ROB_CONTEXT_LIMITS.setsPerExercise + 2 }, () => ({ weight: "20", reps: "10" })),
  }));
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, completedWorkouts: [{ id: "large-history", completedAt: "2026-02-01T00:00:00Z", exercises }] });
  assert.equal(context.history.workouts[0].exercises.length, ROB_ADVICE_CONTEXT_LIMITS.exercisesPerWorkout);
  assert.equal(context.history.workouts[0].exercises[0].sets.length, ROB_ADVICE_CONTEXT_LIMITS.setsPerExercise);
});

test("advice preserves every set, stored unit, order, and swapped display identity from the latest workout", () => {
  const history = [
    { id: "older", completedAt: "2026-04-01T00:00:00Z", routineDayId: "a", exercises: [{ exerciseId: "press", exerciseName: "Old press", sets: [{ weight: "20", reps: "8", unit: "lb" }] }] },
    { id: "latest", completedAt: "2026-05-01T00:00:00Z", routineDayId: "a", routineDayName: "Upper A", exercises: [
      { exerciseId: "swap", exerciseName: "Seated Cable Row", originalExerciseId: "row", originalExerciseName: "Barbell Row", sets: [{ weight: "50", reps: "10", unit: "kg" }, { weight: "50", reps: "10", unit: "kg" }, { weight: "50", reps: "9", unit: "kg" }] },
      ...Array.from({ length: 6 }, (_, index) => ({ exerciseId: "extra-" + index, exerciseName: "Exercise " + index, sets: [{ weight: "10", reps: "12", unit: "lb" }] })),
    ] },
  ];
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, program, routineId: "a", completedWorkouts: history });
  const workout = context.history.workouts[0];
  assert.equal(workout.id, "latest");
  assert.equal(workout.routineName, "Upper A");
  assert.equal(workout.exercises.length, 7);
  assert.equal(workout.exercises[0].exerciseName, "Seated Cable Row");
  assert.equal(workout.exercises[0].sets.length, 3);
  assert.deepEqual(workout.exercises[0].sets.map((set) => set.unit), ["kg", "kg", "kg"]);
  assert.equal(workout.exercises[1].sets[0].unit, "lb");
});
