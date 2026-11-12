import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { getWorkoutPresentation, invalidActiveWorkoutError } from "../src/services/workoutRecovery.js";
import { createWorkoutSessionSnapshot, createSavedWorkoutSession } from "../src/services/routineBuilder.js";
import { createQuickWorkoutSession, isValidWorkoutSession } from "../src/services/workoutSnapshots.js";
import { isSupportedExerciseId } from "../src/services/nevfitCatalogue.js";
import { createAccountCache } from "../src/services/accountCache.js";

const template = { id: "routine", name: "Saved workout", exercises: [{ routineExerciseId: "row", exerciseId: "wger-1", sets: 2, repRange: "8-12", restSeconds: 90, supersetGroupId: null }] };
const day = { id: "mon", routineDayId: "routine", label: "Monday" };
const legacy = () => createWorkoutSessionSnapshot(day, template, () => "Synthetic exercise");
const context = { mode: "legacy", programs: [{ id: "program", days: [template] }], schedule: [day] };
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));
function actualFunction(name, globals) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  const indent = app.slice(app.lastIndexOf("\n", start) + 1, start);
  const end = app.indexOf(`\n${indent}}\n`, start) + indent.length + 3;
  assert.ok(start >= 0 && end > start);
  return runInNewContext(`${app.slice(start, end)}; ${name}`, globals);
}
test("legacy orphaned program/workout/day snapshots enter recovery without modifying logged effort", () => {
  const session = legacy();
  session.exercises[0].sets[0] = { setNumber: 1, weight: "20", reps: "8", completed: true };
  const original = structuredClone(session);
  for (const missing of [{ programs: [] }, { programs: [{ days: [] }] }, { schedule: [] }]) {
    assert.equal(getWorkoutPresentation({ ...context, ...missing, session }).reason, "missing-reference");
  }
  assert.deepEqual(session, original);
  assert.equal(getWorkoutPresentation({ ...context, session }).status, "ready");
  assert.equal(getWorkoutPresentation({ ...context, programs: [{ days: [{ ...template, archived: true }] }], session }).status, "ready");
});
test("valid v2 snapshots resume after template/program/day deletion; empty Quick Workout remains usable", () => {
  const session = createSavedWorkoutSession(template, null, () => "Snapshot name");
  const before = structuredClone(session);
  const view = getWorkoutPresentation({ mode: "v2", session });
  assert.equal(view.status, "ready");
  assert.equal(view.routine.name, template.name);
  assert.deepEqual(session, before);
  assert.equal(getWorkoutPresentation({ mode: "legacy", session: createQuickWorkoutSession() }).status, "ready");
  assert.equal(getWorkoutPresentation({ mode: "v2", session: createQuickWorkoutSession() }).status, "ready");
});
test("missing, malformed, empty and mismatched sessions never qualify for the workout footer", () => {
  assert.equal(getWorkoutPresentation({ mode: "legacy", session: null }).status, "none");
  for (const session of [{}, { ...legacy(), exercises: null }, { ...legacy(), exercises: [null] }, { ...legacy(), routineDayId: "" }]) {
    assert.equal(getWorkoutPresentation({ ...context, session }).reason, "invalid-session");
  }
  for (const session of [{ ...legacy(), exercises: [] }, { ...legacy(), exercises: [{ ...legacy().exercises[0], sets: [] }] }]) {
    assert.equal(getWorkoutPresentation({ ...context, session }).reason, "empty-session");
  }
  assert.equal(getWorkoutPresentation({ ...context, session: createSavedWorkoutSession(template) }).reason, "model-mismatch");
  assert.equal(getWorkoutPresentation({ mode: "v2", session: { ...legacy(), trainingModelVersion: 1 } }).reason, "model-mismatch");
  assert.equal(getWorkoutPresentation({ mode: "v2", session: legacy() }).reason, "model-mismatch");
  assert.equal(getWorkoutPresentation({ ...context, session: legacy(), loading: true }).status, "loading");
});
test("restoration performs no writes, keeps valid device-only data and isolates recreated UIDs", async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const oldCache = createAccountCache(storage, "old-fixture"), newCache = createAccountCache(storage, "new-fixture");
  oldCache.setItem("active", JSON.stringify(legacy()));
  let cloud, cache = oldCache, expectedUid = "old-fixture";
  const globals = {
    loadActiveWorkout: async () => cloud,
    assertCurrentCache: (uid) => { if (uid !== expectedUid) throw Error("account_changed"); },
    isValidWorkoutSession: (value) => isValidWorkoutSession(value, isSupportedExerciseId), invalidActiveWorkoutError,
    loadStoredActiveWorkoutSession: () => { try { return JSON.parse(cache.getItem("active")); } catch { return null; } },
    accountStorage: { getItem: () => cache.getItem("active") }, ACTIVE_WORKOUT_STORAGE_KEY: "active",
    logActiveWorkoutSync: () => {}, saveActiveWorkout: () => assert.fail("restore must not upload device state"),
    persistActiveWorkoutSession: () => assert.fail("only the live hydration effect may update cache"),
  };
  const load = actualFunction("loadUserActiveWorkout", globals);
  assert.equal((await load(expectedUid)).routineDayId, "routine");
  cloud = null;
  assert.equal(await load(expectedUid), null, "an explicit server clear wins over stale local data");
  cloud = { exercises: null };
  await assert.rejects(load(expectedUid), { code: "invalid-active-workout" });
  assert.ok(oldCache.getItem("active"), "invalid cloud data must not erase a device copy");
  cloud = undefined; cache = newCache; expectedUid = "new-fixture";
  assert.equal(await load(expectedUid), null, "a recreated account cannot inherit the deleted UID's snapshot");
  await assert.rejects(load("old-fixture"), /account_changed/);
  newCache.setItem("active", "invalid JSON");
  await assert.rejects(load(expectedUid), { code: "invalid-active-workout" });
  assert.equal(newCache.getItem("active"), "invalid JSON");
});
test("Strict Mode restoration replay hydrates once from the live result; cancelled reads cannot replace its cache", async () => {
  const anchor = app.indexOf("    setActiveWorkoutLoading(true);");
  const start = app.lastIndexOf("  useEffect(() => {", anchor);
  const end = app.indexOf("  }, [currentUser, setViewMode]);", anchor);
  let effect, firstResolve, secondResolve, calls = 0;
  const first = new Promise((resolve) => { firstResolve = resolve; }), second = new Promise((resolve) => { secondResolve = resolve; });
  const state = {}, cached = [];
  const globals = {
    useEffect: (callback) => { effect = callback; }, currentUser: { uid: "fixture" },
    activeWorkoutLoadedRef: { current: false }, activeWorkoutBaselineRef: { current: null },
    setActiveWorkoutLoading: (value) => { state.loading = value; }, setWorkoutSyncError: () => {},
    loadUserActiveWorkout: () => (++calls === 1 ? first : second),
    setActiveWorkoutSession: (value) => { state.session = value; }, setActiveWorkoutRestoreIssue: () => {},
    persistActiveWorkoutSession: (value) => cached.push(value), setViewMode: (value) => { state.view = value; },
    getViewModeForLoadedActiveWorkout: (value) => value ? "workout" : "dashboard",
  };
  runInNewContext(app.slice(start, end) + "  }, [currentUser, setViewMode]);", globals);
  effect()();
  const cleanup = effect();
  assert.equal(calls, 2);
  const restored = legacy(); secondResolve(restored); await flush();
  firstResolve({ ...restored, routineDayId: "stale" }); await flush();
  assert.equal(state.session, restored); assert.equal(state.view, "workout"); assert.equal(state.loading, false);
  assert.deepEqual(cached, [restored]); cleanup();
});
test("hydration, recovery and Return to Dashboard do not autosave or clear restored sessions", async () => {
  const anchor = app.indexOf("    const signature = JSON.stringify(activeWorkoutSession);");
  const start = app.lastIndexOf("  useEffect(() => {", anchor);
  const end = app.indexOf("  }, [activeWorkoutLoading, activeWorkoutSession, activeWorkoutRestoreIssue, workoutPresentation.status, currentUser]);", anchor);
  const session = legacy(), writes = [];
  let effect;
  const globals = {
    useEffect: (callback) => { effect = callback; }, currentUser: { uid: "fixture" }, activeWorkoutLoading: false,
    activeWorkoutLoadedRef: { current: true }, activeWorkoutBaselineRef: { current: JSON.stringify(session) },
    activeWorkoutSession: session, activeWorkoutRestoreIssue: null, workoutPresentation: { status: "ready" },
    activeWorkoutPersistQueueRef: { current: Promise.resolve() },
    persistActiveWorkoutForUser: async (_uid, value) => { writes.push(value); return true; }, setWorkoutSyncError: () => {},
  };
  const register = () => runInNewContext(app.slice(start, end) + "  }, [activeWorkoutLoading, activeWorkoutSession, activeWorkoutRestoreIssue, workoutPresentation.status, currentUser]);", globals);
  register(); effect(); await flush(); assert.equal(writes.length, 0);
  globals.workoutPresentation = { status: "recovery" }; register(); effect(); await flush(); assert.equal(writes.length, 0);
  globals.workoutPresentation = { status: "ready" }; globals.activeWorkoutSession = structuredClone(session);
  globals.activeWorkoutSession.exercises[0].sets[0].reps = "8";
  register(); effect(); await flush(); assert.equal(writes.length, 1, "an explicit logging edit still saves");
});
test("schedule hydration also survives effect replay so valid legacy sessions are not falsely orphaned", async () => {
  const anchor = app.indexOf("    setPlanningLoading(true);");
  const start = app.lastIndexOf("  useEffect(() => {", anchor);
  const end = app.indexOf("  }, [currentUser]);", anchor);
  let effect, firstResolve, secondResolve, calls = 0;
  const first = new Promise((resolve) => { firstResolve = resolve; }), second = new Promise((resolve) => { secondResolve = resolve; });
  const state = {};
  const globals = {
    useEffect: (callback) => { effect = callback; }, currentUser: { uid: "fixture" },
    planningHydratedRef: { current: false }, planningBaselineRef: { current: null },
    setPlanningLoading: (value) => { state.loading = value; }, setAppStateSyncError: () => {},
    loadUserPlanningState: () => (++calls === 1 ? first : second),
    setSchedule: (value) => { state.schedule = value; }, setSelectedProgramId: () => {}, setCycleStartDate: () => {}, setCycleLengthWeeks: () => {},
  };
  runInNewContext(app.slice(start, end) + "  }, [currentUser]);", globals);
  effect()(); const cleanup = effect(); assert.equal(calls, 2);
  secondResolve({ schedule: [day], activeProgramId: "program", cycleStartDate: "", cycleLengthWeeks: "" }); await flush();
  firstResolve({ schedule: [] }); await flush();
  assert.equal(state.loading, false);
  assert.equal(getWorkoutPresentation({ ...context, session: legacy(), schedule: state.schedule }).status, "ready");
  cleanup();
});
test("recovery discard is explicit, waits for server success and preserves the session on failure", async () => {
  const session = legacy(), calls = [];
  const state = { session, reason: "missing-reference" };
  let confirmed = false, fail = false;
  const globals = {
    window: { confirm: () => confirmed }, currentUser: { uid: "fixture" }, currentUserUidRef: { current: "fixture" },
    workoutRecoveryDiscardingRef: { current: false }, activeWorkoutBaselineRef: { current: JSON.stringify(session) },
    activeWorkoutPersistQueueRef: { current: Promise.resolve() },
    setWorkoutRecoveryDiscarding: () => {}, setWorkoutRecoveryError: (value) => { state.error = value; },
    clearActiveWorkout: async () => { calls.push("clear"); if (fail) throw Error("offline"); },
    persistActiveWorkoutSession: () => calls.push("cache-clear"),
    setActiveWorkoutRestoreIssue: (value) => { state.reason = value; }, setActiveWorkoutSession: (value) => { state.session = value; },
    setRestTimer: () => {}, setPendingWorkoutAction: () => {}, setViewMode: (value) => { state.view = value; }, setWorkoutSyncError: () => {},
  };
  const discard = actualFunction("discardRecoveredWorkout", globals);
  await discard(); assert.deepEqual(calls, []);
  confirmed = true; fail = true; await discard();
  assert.equal(state.session, session); assert.equal(state.reason, "missing-reference"); assert.match(state.error, /kept/);
  fail = false; await discard(); assert.equal(state.session, null); assert.equal(state.reason, null); assert.equal(state.view, "dashboard");
  assert.deepEqual(calls, ["clear", "clear", "cache-clear"]);
});
