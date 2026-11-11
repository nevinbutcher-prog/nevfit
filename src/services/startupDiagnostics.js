export const STARTUP_TIMEOUT_MS = 20_000;

export function getPendingStartupOperations(state) {
  return [
    [state.trainingMode === "loading", "training authority"],
    [state.programsLoading, "programs"],
    [state.planningLoading, "planning"],
    [state.healthLoading, "health"],
    [state.robCoachingProfileLoading, "coaching profile"],
    [state.activeWorkoutLoading, "active workout"],
    [state.exerciseNotesLoading || !state.exerciseNotesReady, "exercise notes"],
    [state.workoutHistoryLoading, "workout history"],
  ].filter(([pending]) => pending).map(([, operation]) => operation);
}

export function startupFailureDetails(error, operation) {
  return { operation: error?.startupOperation ?? operation, code: error?.code ?? "startup-failed" };
}

export function reportStartupDiagnostic(event) {
  // Operation labels/codes only: do not log account IDs, snapshots or SDK messages.
  if (event.status === "failed") console.error("NevFit startup", event);
  else console.info("NevFit startup", event);
}

export async function runStartupOperation(operation, run, { timeoutMs = STARTUP_TIMEOUT_MS, report = reportStartupDiagnostic } = {}) {
  const started = Date.now();
  report({ operation, status: "started" });
  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Startup read timed out");
          error.code = "startup-timeout";
          reject(error);
        }, timeoutMs);
      }),
    ]);
    report({ operation, status: "completed", elapsedMs: Date.now() - started });
    return result;
  } catch (cause) {
    const error = new Error("Startup read failed", { cause });
    Object.assign(error, startupFailureDetails(cause, operation));
    error.startupOperation = error.operation;
    report({ ...startupFailureDetails(error, operation), status: "failed", elapsedMs: Date.now() - started });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
