export function createRobReviewFingerprint(program, routineId = null) {
  return JSON.stringify({
    programId: program?.id ?? null,
    name: program?.name ?? null,
    days: program?.days ?? program?.routines ?? [],
    routineId,
  });
}

export function createRobReviewLifecycle() {
  return { nextRequestId: 1, activeRequest: null };
}

export function startRobReviewRequest(lifecycle, target) {
  const request = { id: lifecycle.nextRequestId, ...target };
  return {
    lifecycle: { nextRequestId: request.id + 1, activeRequest: request },
    request,
  };
}

export function invalidateRobReviewRequest(lifecycle) {
  return { ...lifecycle, activeRequest: null };
}

export function isActiveRobReviewRequest(lifecycle, request) {
  return lifecycle.activeRequest?.id === request.id;
}

export function settleRobReviewRequest(lifecycle, request) {
  return isActiveRobReviewRequest(lifecycle, request)
    ? invalidateRobReviewRequest(lifecycle)
    : lifecycle;
}
