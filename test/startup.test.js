import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { getPendingStartupOperations, runStartupOperation, startupFailureDetails } from "../src/services/startupDiagnostics.js";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function programEffect(load) {
  const anchor = app.indexOf("    programsHydratedRef.current = false;");
  const start = app.lastIndexOf("  useEffect(() => {", anchor);
  const end = app.indexOf("  }, [currentUser, trainingStore, accountStorage]);", anchor);
  assert.ok(start >= 0 && end > start);
  let effect;
  const state = { runtime: { mode: "loading" }, programsLoading: true };
  const context = {
    useEffect: (callback) => { effect = callback; },
    currentUser: { uid: "fixture" }, currentUserUidRef: { current: "fixture" },
    trainingStore: { load }, accountStorage: { setItem: () => {} },
    trainingRuntimeRef: { current: state.runtime }, programsHydratedRef: { current: false },
    setProgramsLoading: (value) => { state.programsLoading = value; }, setProgramSyncError: () => {},
    setTrainingRuntime: (value) => { state.runtime = value; },
    setProgramDefinitions: (value) => { state.programs = value; },
    setProgramDrafts: () => {}, setSelectedProgramDayId: () => {},
    setStartupFailure: (value) => { state.failure = value; },
    startupFailureDetails, reportStartupDiagnostic: () => {},
    runStartupOperation: (operation, run) => runStartupOperation(operation, run, { report: () => {} }),
    loadUserPrograms: async () => [{ id: "program", days: [] }],
    projectTrainingPrograms: () => assert.fail("must not select v2 for absent marker"),
  };
  runInNewContext(app.slice(start, end) + "  }, [currentUser, trainingStore, accountStorage]);", context);
  return { setup: () => effect(), state, context };
}

test("Strict Mode setup-cleanup-setup restarts authority hydration and ignores the discarded result", async () => {
  const first = deferred(), second = deferred();
  let calls = 0;
  const lifecycle = programEffect(() => (++calls === 1 ? first.promise : second.promise));
  const cleanup = lifecycle.setup();
  cleanup();
  const cleanupReplay = lifecycle.setup();
  assert.equal(calls, 2, "the replay must not deduplicate against a cancelled effect");
  first.resolve({ mode: "legacy" });
  await flush();
  assert.equal(lifecycle.state.runtime.mode, "loading");
  assert.equal(lifecycle.state.programsLoading, true);
  second.resolve({ mode: "legacy" });
  await flush();
  assert.equal(lifecycle.state.runtime.mode, "legacy");
  assert.equal(lifecycle.state.programsLoading, false);
  assert.equal(lifecycle.context.programsHydratedRef.current, true);
  assert.equal(lifecycle.state.programs[0].id, "program");
  assert.equal(lifecycle.state.failure, undefined);
  cleanupReplay();
});

test("authority rejection ends loading with a named recoverable failure, not legacy fallback", async () => {
  const failure = Object.assign(new Error("private SDK message"), { code: "permission-denied", startupOperation: "training model marker" });
  const lifecycle = programEffect(async () => { throw failure; });
  const cleanup = lifecycle.setup();
  await flush();
  assert.equal(lifecycle.state.programsLoading, false);
  assert.equal(lifecycle.state.runtime.mode, "unavailable");
  assert.deepEqual(lifecycle.state.failure, { operation: "training model marker", code: "permission-denied" });
  assert.equal(lifecycle.state.programs, undefined);
  cleanup();
});

test("startup reads time out with operation diagnostics; late success cannot settle the rejected read", async () => {
  const pending = deferred(), events = [];
  const read = runStartupOperation("training model marker", () => pending.promise, { timeoutMs: 5, report: (event) => events.push(event) });
  await assert.rejects(read, (error) => error.code === "startup-timeout" && error.startupOperation === "training model marker");
  pending.resolve("late server result");
  await flush();
  assert.deepEqual(events.map((event) => event.status), ["started", "failed"]);
  const denied = Object.assign(new Error("private account/path contents"), { code: "permission-denied" });
  await assert.rejects(runStartupOperation("legacy programs", () => { throw denied; }, { report: (event) => events.push(event) }), { code: "permission-denied" });
  assert.equal(JSON.stringify(events).includes("private"), false);
  assert.equal(await runStartupOperation("training model marker", () => "ready", { report: () => {} }), "ready");
});

test("the startup deadline covers every loading gate, including unresolved notes ownership", () => {
  const ready = { trainingMode: "legacy", exerciseNotesReady: true };
  assert.deepEqual(getPendingStartupOperations(ready), []);
  assert.deepEqual(getPendingStartupOperations({ ...ready, trainingMode: "loading" }), ["training authority"]);
  assert.deepEqual(getPendingStartupOperations({ ...ready, exerciseNotesReady: false }), ["exercise notes"]);
  assert.deepEqual(getPendingStartupOperations({ trainingMode: "loading", programsLoading: true, planningLoading: true,
    healthLoading: true, robCoachingProfileLoading: true, activeWorkoutLoading: true, exerciseNotesLoading: true, workoutHistoryLoading: true }),
  ["training authority", "programs", "planning", "health", "coaching profile", "active workout", "exercise notes", "workout history"]);
});

test("an unresolved startup gate triggers the recoverable error and cleans up its deadline", () => {
  const anchor = app.indexOf("    const timer = window.setTimeout(() => {");
  const start = app.lastIndexOf("  useEffect(() => {", anchor);
  const end = app.indexOf("  }, [startupLoading, startupFailure]);", anchor);
  let setup, timeout, failure, cleared = false;
  const pending = { current: ["exercise notes"] };
  runInNewContext(app.slice(start, end) + "  }, [startupLoading, startupFailure]);", {
    useEffect: (callback) => { setup = callback; }, startupLoading: true, startupFailure: null,
    pendingStartupRef: pending, STARTUP_TIMEOUT_MS: 20_000,
    window: { setTimeout: (callback) => { timeout = callback; return 1; }, clearTimeout: () => { cleared = true; } },
    reportStartupDiagnostic: () => {}, setStartupFailure: (value) => { failure = value; },
  });
  const cleanup = setup();
  timeout();
  assert.equal(failure.operation, "exercise notes");
  assert.equal(failure.code, "startup-timeout");
  cleanup();
  assert.equal(cleared, true);
  failure = null;
  pending.current = [];
  timeout();
  assert.equal(failure, null, "a completed gate cannot become an error during timer cleanup");
});

test("runtime authority reads identify the failed marker and never continue to target reads", async () => {
  const source = readFileSync(new URL("../src/services/trainingRuntimeStore.js", import.meta.url), "utf8");
  const start = source.indexOf("  async function load(");
  const end = source.indexOf("  async function commit(", start);
  let reads = 0;
  const load = runInNewContext(source.slice(start, end) + "; load", {
    guard: () => {}, markerRef: {}, getDocFromServer: () => {
      reads++;
      return Promise.reject(Object.assign(new Error("private SDK message"), { code: "permission-denied" }));
    },
  });
  await assert.rejects(load({ read: (operation, run) => runStartupOperation(operation, run, { report: () => {} }) }),
    (error) => error.code === "permission-denied" && error.startupOperation === "training model marker");
  assert.equal(reads, 1);
});
