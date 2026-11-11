import test from "node:test";
import assert from "node:assert/strict";
import { createAccountCache } from "../src/services/accountCache.js";
import { createEmptyPlanningState } from "../src/services/accountInitialization.js";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

test("new UIDs cannot bootstrap from shared or another account's caches; returning UIDs retain their cache", () => {
  const storage = memoryStorage();
  const google = createAccountCache(storage, "google-uid");
  const email = createAccountCache(storage, "email-uid");
  const keys = ["nevfit_programs", "nevfit_schedule", "nevfit_active_program", "nevfit_steps", "nevfit_runs", "nevfit_weekly_run_target", "nevfit_completed_workouts", "nevfit_active_workout", "nevfit_cycle_start_date", "nevfit_cycle_length_weeks"];
  for (const key of keys) {
    storage.setItem(key, "legacy-private-data");
    google.setItem(key, "google-private-data");
    assert.equal(email.getItem(key), null);
    email.setItem(key, "email-data");
    assert.equal(createAccountCache(storage, "email-uid").getItem(key), "email-data");
    assert.equal(google.getItem(key), "google-private-data");
    assert.equal(storage.getItem(key), "legacy-private-data");
  }
  email.removeItem("nevfit_active_workout");
  assert.equal(google.getItem("nevfit_active_workout"), "google-private-data");
  assert.throws(() => createAccountCache(storage, null), /account_required/);
});

test("late hydration for a previous UID stops before it can populate the next account cache or migrate data", async () => {
  // Exercise the existing App hydration functions with delayed cloud reads, without mounting UI or Firebase.
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const names = ["assertCurrentCache", "loadUserPrograms", "loadUserPlanningState", "loadUserHealthState", "loadUserActiveWorkout", "loadUserCompletedWorkouts"];
  const functions = names.map((name) => {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.notEqual(start, -1);
    return source.slice(start, source.indexOf("\n}", start) + 2);
  }).join("\n");
  let resolveCloud;
  const cloud = new Promise((resolve) => { resolveCloud = resolve; });
  const writes = [];
  const context = {
    activeCacheUid: "old-uid", accountStorage: { getItem: () => null },
    HEALTH_CACHE_OWNER_STORAGE_KEY: "owner", DEFAULT_WEEKLY_RUN_TARGET: 2,
    loadStoredProgramCache: () => null,
    normalizeProgramDefinitions: (value) => value,
    normalizePlanningState: () => ({}), normalizeHealthState: () => ({}),
    createEmptyPlanningState,
    normalizeCompletedWorkout: (value) => value,
    loadCloudPrograms: () => cloud, loadPlanningState: () => cloud, loadHealthState: () => cloud,
    loadActiveWorkout: () => cloud, loadCloudCompletedWorkouts: () => cloud,
  };
  for (const name of ["persistPrograms", "migrateLocalProgramsToCloud", "persistPlanningCache", "savePlanningState", "persistHealthCache", "saveHealthState", "persistActiveWorkoutSession", "saveActiveWorkout", "persistCompletedWorkouts", "saveCompletedWorkout"]) context[name] = () => writes.push(name);
  const loaders = runInNewContext(`${functions}; ({ ${names.slice(1).join(", ")} })`, context);
  const results = Object.values(loaders).map((load) => assert.rejects(load("old-uid"), /account_changed/));
  context.activeCacheUid = "new-uid";
  resolveCloud([]);
  await Promise.all(results);
  assert.deepEqual(writes, []);
});
