import test from "node:test";
import assert from "node:assert/strict";
import { NEVFIT_EXERCISES, getNevfitExerciseById, isNevfitCatalogueEnabled } from "../src/services/nevfitCatalogue.js";
import { getExerciseById, searchExercises } from "../src/services/exerciseProvider.js";
import { normalizeRoutineExercise } from "../src/services/routineBuilder.js";
import { createCompletedWorkoutSnapshot, getPreviousExercisePerformance } from "../src/services/workoutSnapshots.js";
import { createBackup, validateBackup } from "../src/services/backupPayload.js";
import { createServerAuthorisedRobCatalogue, authorizeRobCatalogue } from "../functions/src/rob/robExerciseCatalogue.js";
import { getVerifiedRobExerciseCatalogue } from "../src/services/exerciseProvider.js";
import { programGenerationMessages } from "../functions/src/rob/robProgramGeneration.js";

test("all 247 Nevfit exercises search and resolve with stable identities and filters", async () => {
  assert.equal(NEVFIT_EXERCISES.length, 247);
  assert.equal((await searchExercises()).length, 247);
  for (const item of NEVFIT_EXERCISES) assert.equal((await getExerciseById(item.id))?.id, item.id);
  const selected = getNevfitExerciseById("nevfit-seated-leg-curl");
  assert.equal((await searchExercises(selected.name)).some((item) => item.id === selected.id), true);
  assert.equal((await searchExercises("curl", { equipment: "Machine", muscle: selected.primaryMuscle })).some((item) => item.id === selected.id), true);
  assert.equal((await searchExercises("curl", { equipment: "Dumbbell" })).some((item) => item.id === selected.id), false);
});

test("feature rollback restores WGER search while Nevfit read resolution stays available", async () => {
  assert.equal(isNevfitCatalogueEnabled("false"), false);
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [] }) });
  try {
    assert.deepEqual(await searchExercises("curl", {}, { catalogueEnabled: false }), []);
    assert.equal((await getExerciseById("nevfit-seated-leg-curl"))?.id, "nevfit-seated-leg-curl");
  } finally { globalThis.fetch = original; }
});

test("Nevfit ID survives routine row, active and completed workout, previous performance and backup", () => {
  const id = "nevfit-seated-leg-curl";
  const row = normalizeRoutineExercise({ exerciseId: id, routineExerciseId: "ri-1", sets: 3, repRange: "8-12", restSeconds: 90, supersetGroupId: "pair-1", note: "Slow" }, "fallback", (value) => value === id);
  assert.equal(row.routineExerciseId, "ri-1");
  const active = { scheduleDayId: "mon", routineDayId: "day-1", exercises: [{ ...row, exerciseName: "Seated Leg Curl", sets: [{ setNumber: 1, weight: "45", reps: "10" }] }] };
  const snapshot = createCompletedWorkoutSnapshot(active, "Legs", new Date("2026-10-20"), "workout-1");
  assert.equal(snapshot.exercises[0].exerciseId, id);
  assert.equal(snapshot.exercises[0].supersetGroupId, "pair-1");
  assert.deepEqual(getPreviousExercisePerformance(id, [snapshot], () => true)?.sets, snapshot.exercises[0].sets);
  const backup = createBackup({ programs: [{ id: "program-1", days: [{ id: "day-1", exercises: [row] }] }], planning: {}, activeWorkout: active, completedWorkouts: [snapshot], health: {}, exerciseNotes: { [id]: "Careful" } });
  assert.equal(validateBackup(backup).valid, true);
  assert.equal(JSON.parse(JSON.stringify(backup)).programs[0].days[0].exercises[0].exerciseId, id);
});

test("Rob server authorises only versioned Nevfit entries and retains legacy WGER", () => {
  const requirements = { environment: "home_gym", equipment: ["dumbbells", "barbell", "machines", "cables", "bench"], priorities: [] };
  const source = createServerAuthorisedRobCatalogue(requirements, [], 1);
  assert.equal(source.version, 1);
  assert.equal(source.ids.some((id) => id.startsWith("nevfit-")), true);
  assert.equal(authorizeRobCatalogue(1, [source.ids[0]], requirements)?.[0].id, source.ids[0]);
  assert.equal(authorizeRobCatalogue(1, ["nevfit-forged"], requirements), null);
  assert.equal(authorizeRobCatalogue(1, ["wger-73"], requirements), null);
  assert.equal(createServerAuthorisedRobCatalogue(requirements).version, 2);
});

test("browser Rob candidates are accepted by server-owned Nevfit catalogue", async () => {
  const requirements = { environment: "home_gym", equipment: ["dumbbells", "barbell", "machines", "cables", "bench"], priorities: ["balanced"], daysPerWeek: 3, durationMinutes: 60, goal: "hypertrophy" };
  const browser = await getVerifiedRobExerciseCatalogue(requirements);
  assert.equal(browser.version, 1);
  assert.equal(browser.entries.length >= 8, true);
  const trusted = authorizeRobCatalogue(browser.version, browser.entries.map((item) => item.id), requirements);
  assert.equal(trusted?.length, browser.entries.length);
  const prompt = programGenerationMessages(requirements, { version: 1, entries: trusted });
  assert.equal(prompt[0].content.includes('"exerciseId":"nevfit-'), true);
  assert.equal(prompt[0].content.includes('"exerciseId":"wger-'), false);
});
