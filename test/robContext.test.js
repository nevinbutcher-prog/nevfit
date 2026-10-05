import test from "node:test";
import assert from "node:assert/strict";
import { buildRobContext, ROB_CONTEXT_LIMITS, ROB_CONTEXT_TYPES, RobContextError } from "../src/services/rob/robContext.js";

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
  assert.deepEqual(first.target, { programId: "program-1", routineId: "a" });
  assert.equal(first.program.routines.length, 1);
  assert.deepEqual(first.program.routines[0].exercises[0], { routineExerciseId: "ri-a-1", exerciseId: "press", name: "Incline DB Press", sets: 3, repRange: "8-12", restSeconds: 120, note: "controlled", supersetGroupId: "ss-1" });
  assert.deepEqual(first.history.workouts.map((workout) => workout.id), ["new", "old"]);
  assert.equal(first.history.workouts[0].exercises[0].originalExerciseId, "old-press");
});

test("advice supports profile-only and optional program context", () => {
  const profileOnly = buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE });
  assert.equal(profileOnly.program, null);
  assert.deepEqual(profileOnly.history, { workouts: [] });
  assert.equal(buildRobContext({ requestType: ROB_CONTEXT_TYPES.ADVICE, program, routineId: "b" }).target.routineId, "b");
});

test("program review includes active routines in order and excludes archived routines", () => {
  const context = buildRobContext({ requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW, program, completedWorkouts: workouts });
  assert.deepEqual(context.program.routines.map((routine) => routine.id), ["a", "b"]);
  assert.equal(context.target.routineId, null);
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
  assert.equal(context.history.workouts.length, ROB_CONTEXT_LIMITS.historyWorkouts);
  assert.equal(JSON.stringify(context).match(/email|photoURL|providerId|uid|apiKey|OPENROUTER_API_KEY/), null);
});
