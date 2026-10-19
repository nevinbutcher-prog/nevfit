import test from "node:test";
import assert from "node:assert/strict";
import { createExerciseMigrationPlan, applyExerciseMigrationPlan, rollbackExerciseMigration } from "../src/services/exerciseIdentityMigration.js";

const fixture = () => ({
  uid: "synthetic-user",
  programs: [{ id: "p1", days: [{ id: "d1", exercises: [{ routineExerciseId: "ri-1", exerciseId: "wger-364", sets: 3, supersetGroupId: "pair-1" }] }], routines: [{ id: "d1", exercises: [{ routineExerciseId: "ri-1", exerciseId: "wger-364", sets: 3, supersetGroupId: "pair-1" }] }] }],
  completedWorkouts: [{ id: "w1", completedAt: "2026-10-19T00:00:00Z", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ setNumber: 1, weight: "45", reps: "10", unit: "kg" }] }] }],
  activeWorkout: { exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ weight: "50", reps: "8" }] }] },
  exerciseNotes: { "wger-364": "Seat setting 3" },
});
const location = { completedWorkout: ["w1", "exercises.0.exerciseId"], program: ["p1", "days.0.exercises.0.exerciseId"], activeWorkout: ["activeWorkout", "activeWorkoutSession.exercises.0.exerciseId"], exerciseNotes: ["exerciseNotes", "notes.wger-364"] };
const decision = (kind, recordedName) => ({ kind, historicalWgerId: "wger-364", nevfitId: "nevfit-seated-leg-curl", recordedName, docId: location[kind][0], path: location[kind][1], confirmed: true, reason: "Synthetic fixture movement verified." });

test("dry run counts actual references without changing account data or guessing mappings", () => {
  const data = fixture(), before = structuredClone(data);
  const plan = createExerciseMigrationPlan(data);
  assert.equal(plan.counts.completedWorkouts, 1);
  assert.equal(plan.counts.historicalOccurrences, 1);
  assert.equal(plan.counts.routineReferences, 1);
  assert.equal(plan.counts.activeReferences, 1);
  assert.equal(plan.counts.noteReferences, 1);
  assert.equal(plan.confirmed.length, 0);
  assert.equal(plan.ambiguous.length, 4);
  assert.equal(plan.mappingReview.length, 28);
  assert.deepEqual(data, before);
});

test("confirmed exact-name migration preserves every other field and rolls back", () => {
  const data = fixture();
  const decisions = [decision("completedWorkout", "Leg Curl"), decision("activeWorkout", "Leg Curl"), decision("program", ""), decision("exerciseNotes", "")];
  const plan = createExerciseMigrationPlan({ ...data, decisions });
  assert.equal(plan.confirmed.length, 4);
  const { data: migrated, manifest } = applyExerciseMigrationPlan(data, plan);
  assert.equal(migrated.completedWorkouts[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.completedWorkouts[0].exercises[0].exerciseName, "Leg Curl");
  assert.equal(migrated.completedWorkouts[0].exercises[0].sets[0].weight, "45");
  assert.equal(migrated.activeWorkout.exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.programs[0].days[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.programs[0].routines[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(migrated.exerciseNotes["nevfit-seated-leg-curl"], "Seat setting 3");
  assert.deepEqual(rollbackExerciseMigration(migrated, manifest), data);
  assert.throws(() => applyExerciseMigrationPlan(migrated, plan), /changed since dry run/);
});

test("unmapped, conflicting and fabricated relationships never become confirmed", () => {
  const data = fixture();
  data.completedWorkouts[0].exercises.push({ exerciseId: "wger-999999", exerciseName: "Unknown", sets: [] });
  data.exerciseNotes["nevfit-seated-leg-curl"] = "Existing note";
  const plan = createExerciseMigrationPlan({ ...data, decisions: [decision("completedWorkout", "Leg Curl"), decision("exerciseNotes", "")] });
  assert.deepEqual(plan.unmappedWgerIds, ["wger-999999"]);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.confirmed.length, 1);
  assert.throws(() => applyExerciseMigrationPlan(data, plan), /Invalid migration plan/);
  assert.throws(() => createExerciseMigrationPlan({ ...data, decisions: [{ ...decision("completedWorkout", "Leg Curl"), nevfitId: "nevfit-forged" }] }), /reviewed identity/);
});

test("an interrupted document sequence can resume only remaining confirmed paths", () => {
  const data = fixture();
  const decisions = [decision("completedWorkout", "Leg Curl"), decision("activeWorkout", "Leg Curl")];
  const plan = createExerciseMigrationPlan({ ...data, decisions });
  const first = applyExerciseMigrationPlan(data, { ...plan, confirmed: plan.confirmed.slice(0, 1) });
  assert.equal(first.data.completedWorkouts[0].exercises[0].exerciseId, "nevfit-seated-leg-curl");
  assert.equal(first.data.activeWorkout.exercises[0].exerciseId, "wger-364");
  const resumed = applyExerciseMigrationPlan(first.data, { ...plan, confirmed: plan.confirmed.slice(1) });
  assert.equal(resumed.data.activeWorkout.exercises[0].exerciseId, "nevfit-seated-leg-curl");
  const restored = rollbackExerciseMigration(rollbackExerciseMigration(resumed.data, resumed.manifest), first.manifest);
  assert.deepEqual(restored, data);
});
