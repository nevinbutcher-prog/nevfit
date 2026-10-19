import test from "node:test";
import assert from "node:assert/strict";
import overlay from "../src/data/exerciseMetadataOverlay.v1.json" with { type: "json" };
import review from "../evaluation/exercise-metadata-review.json" with { type: "json" };
import snapshot from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { applyNevfitExerciseMetadata, getNevfitExerciseMetadata } from "../src/services/exerciseMetadataOverlay.js";
import { normalizeExercise, getExerciseById, searchExercises } from "../src/services/exerciseProvider.js";
import { getPreviousExercisePerformance, createCompletedWorkoutSnapshot } from "../src/services/workoutSnapshots.js";
import { normalizeRoutineExercise, createWorkoutSessionSnapshot } from "../src/services/routineBuilder.js";
import { createBackup, validateBackup } from "../src/services/backupPayload.js";
import { prototypePreviousPerformance } from "../evaluation/historyCompatibilityPrototype.js";
import { buildRobExerciseCatalogue } from "../src/services/rob/robExerciseCatalogue.js";
import { swapActiveWorkoutExercise } from "../src/services/activeWorkoutSwap.js";

const lookup = new Map(snapshot.exercises.map((entry) => [entry.id, entry]));
const source = (id) => {
  const entry = lookup.get(id);
  return {
    id: Number(id.slice(5)),
    source: "wger",
    translations: [{ language: 2, name: entry.name, aliases: [] }],
    muscles: [{ name_en: entry.primaryMuscle }],
    muscles_secondary: entry.secondaryMuscles.map((name_en) => ({ name_en })),
    category: { name_en: entry.bodyPart },
    equipment: entry.equipment.map((name_en) => ({ name_en })),
    images: [],
  };
};
const meaningful = (set) => Number(set.weight) > 0 || Number(set.reps) > 0;

test("exactly 28 protected IDs are reviewed; only listed fields activate and no preferred ID becomes runtime identity", () => {
  assert.equal(review.records.length, 28);
  assert.equal(new Set(review.records.map((row) => row.id)).size, 28);
  assert.equal(overlay.entries.length, 12);
  assert.equal(review.records.filter((row) => row.reviewStatus === "review_only").length, 16);
  for (const row of review.records) {
    assert.ok(lookup.has(row.id));
    assert.equal(row.id, review.records.find((other) => other.sourceRow === row.sourceRow).id);
  }
  for (const entry of overlay.entries) {
    const row = review.records.find((item) => item.id === entry.id);
    assert.ok(row);
    assert.equal(entry.id, `wger-${Number(entry.id.slice(5))}`);
    assert.equal(getNevfitExerciseMetadata(entry.id), entry);
    assert.ok(!Object.hasOwn(entry, "preferredWgerId"));
    for (const field of ["displayName", "equipment", "primaryMuscles", "secondaryMuscles"]) {
      assert.equal(Object.hasOwn(entry, field), row.activatedFields.includes(field), `${entry.id} ${field}`);
    }
  }
  assert.equal(getNevfitExerciseMetadata("wger-2626"), null);
  assert.equal(getNevfitExerciseMetadata("wger-1109"), null);
});

test("A/B: Seated Leg Curl changes display only; old ID and performance remain", () => {
  const raw = normalizeExercise(source("wger-364"));
  assert.equal(raw.id, "wger-364");
  assert.equal(raw.name, "Seated Leg Curl");
  assert.equal(raw.originalName, "Leg Curl");
  assert.equal(raw.primaryMuscle, "Hamstrings");
  assert.deepEqual(raw.equipment, []);
  assert.equal(getNevfitExerciseMetadata("wger-364").displayName, "Seated Leg Curl");
  const completed = [{ completedAt: "2025-01-02T10:00:00Z", exercises: [{ exerciseId: "wger-364", exerciseName: "Leg Curl", sets: [{ setNumber: 1, weight: "42", reps: "8" }] }] }];
  assert.equal(getPreviousExercisePerformance(raw.id, completed, meaningful).sets[0].weight, "42");
  assert.equal(getPreviousExercisePerformance("wger-2626", completed, meaningful), null);
  assert.equal(completed[0].exercises[0].exerciseName, "Leg Curl");
});

test("C: shared historical ID is not split or merged by overlay", () => {
  const rows = [{ sourceRow: 1, historicalWgerId: "wger-364" }, { sourceRow: 2, historicalWgerId: "wger-364" }];
  const performance = [{ completedAt: "2025-01-02T10:00:00Z", exercises: [{ exerciseId: "wger-364", sets: [{ weight: "40", reps: "10" }] }] }];
  assert.equal(prototypePreviousPerformance({ catalogueRows: rows, targetRow: 1, completedWorkouts: performance }).reason, "ambiguous_shared_historical_id");
  assert.equal(applyNevfitExerciseMetadata({ id: "wger-364", name: "Leg Curl", source: "wger", aliases: [], equipment: [] }).id, "wger-364");
});

test("D/E/F: saved routine, active session, completed snapshot and backup keep original identity and sets", () => {
  const routine = normalizeRoutineExercise({ routineExerciseId: "ri-1", exerciseId: "wger-364", sets: 2, repRange: "8-12", restSeconds: 90, supersetGroupId: "ss-1" }, "fallback", (id) => id.startsWith("wger-"));
  const session = createWorkoutSessionSnapshot({ id: "mon" }, { id: "legs", exercises: [routine] }, () => "Leg Curl");
  session.exercises[0].sets[0] = { setNumber: 1, weight: "42", reps: "8", completed: true };
  const before = structuredClone(session);
  normalizeExercise(source("wger-364"));
  assert.deepEqual(session, before);
  const finished = createCompletedWorkoutSnapshot(session, "Legs", new Date("2025-01-02T10:00:00Z"), "wo-1", (exercise) => exercise.exerciseName);
  assert.equal(finished.exercises[0].exerciseName, "Leg Curl");
  assert.deepEqual(finished.exercises[0].sets[0], { setNumber: 1, weight: "42", reps: "8" });
  assert.equal(finished.completedAt, "2025-01-02T10:00:00.000Z");
  const backup = createBackup({ programs: [{ id: "p-1", days: [{ id: "legs", exercises: [routine] }] }], planning: {}, activeWorkout: session, completedWorkouts: [finished], health: {}, exerciseNotes: { "wger-364": "Seat setting 4" } });
  assert.equal(validateBackup(backup).valid, true);
  const roundTrip = JSON.parse(JSON.stringify(backup));
  assert.equal(roundTrip.programs[0].days[0].exercises[0].exerciseId, "wger-364");
  assert.equal(roundTrip.activeWorkout.exercises[0].exerciseId, "wger-364");
  assert.deepEqual(roundTrip.completedWorkouts, [finished]);
  assert.equal(roundTrip.exerciseNotes["wger-364"], "Seat setting 4");
});

test("exercise swap retains original trace and superset grouping", () => {
  const workout = {
    exercises: [
      { exerciseId: "wger-364", exerciseName: "Leg Curl", supersetGroupId: "ss-1", sets: [{ setNumber: 1, weight: "", reps: "" }] },
      { exerciseId: "wger-348", exerciseName: "Lateral Raises", supersetGroupId: "ss-1", sets: [{ setNumber: 1, weight: "", reps: "" }] },
    ],
  };
  const replacement = normalizeExercise(source("wger-1012"));
  const swapped = swapActiveWorkoutExercise(workout, 0, replacement);
  assert.equal(swapped.swapped, true);
  assert.equal(swapped.workout.exercises[0].originalExerciseId, "wger-364");
  assert.equal(swapped.workout.exercises[0].exerciseId, "wger-1012");
  assert.equal(swapped.workout.exercises[0].supersetGroupId, "ss-1");
  assert.equal(swapped.workout.exercises[1].supersetGroupId, "ss-1");
  assert.equal(workout.exercises[0].exerciseId, "wger-364");
});

test("G: unreviewed WGER data falls back; overlay disable restores source display", () => {
  const unreviewed = normalizeExercise(source("wger-73"));
  assert.equal(unreviewed.name, lookup.get("wger-73").name);
  assert.equal(unreviewed.nevfitMetadata, undefined);
  const old = { id: "wger-364", name: "Leg Curl", source: "wger", aliases: [], equipment: [] };
  assert.strictEqual(applyNevfitExerciseMetadata(old, { enabled: false }), old);
  assert.equal(applyNevfitExerciseMetadata(old).name, "Seated Leg Curl");
});

test("provider search and direct lookup use reviewed display, while Rob snapshot remains unchanged", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => String(url).includes("exerciseinfo/?") ? { results: [source("wger-364"), source("wger-73")] } : source("wger-364") });
  try {
    const [renamed] = await searchExercises("Seated Leg Curl");
    assert.equal(renamed.id, "wger-364");
    assert.equal((await getExerciseById("wger-364")).name, "Seated Leg Curl");
    assert.equal((await searchExercises("Leg Curl"))[0].id, "wger-364");
    assert.equal(snapshot.exercises.find((entry) => entry.id === "wger-364").name, "Leg Curl");
    const rob = buildRobExerciseCatalogue({ requirements: { environment: "home_gym", equipment: ["dumbbells"], priorities: [] } });
    assert.equal(rob.entries.find((entry) => entry.id === "wger-1012").name, "Alternating bicep curls");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
