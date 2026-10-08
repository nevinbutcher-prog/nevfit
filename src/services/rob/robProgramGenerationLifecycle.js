export function createRobProgramGenerationLifecycle() {
  return { nextRequestId: 1, activeRequest: null };
}

export function startRobProgramGenerationRequest(lifecycle, fingerprint) {
  if (lifecycle.activeRequest?.fingerprint === fingerprint) return { lifecycle, request: null };
  const request = { id: lifecycle.nextRequestId, fingerprint };
  return { lifecycle: { nextRequestId: request.id + 1, activeRequest: request }, request };
}

export function invalidateRobProgramGenerationRequest(lifecycle) {
  return { ...lifecycle, activeRequest: null };
}

export function isActiveRobProgramGenerationRequest(lifecycle, request) {
  return lifecycle.activeRequest?.id === request.id && lifecycle.activeRequest?.fingerprint === request.fingerprint;
}

export function settleRobProgramGenerationRequest(lifecycle, request) {
  return isActiveRobProgramGenerationRequest(lifecycle, request)
    ? invalidateRobProgramGenerationRequest(lifecycle)
    : lifecycle;
}
