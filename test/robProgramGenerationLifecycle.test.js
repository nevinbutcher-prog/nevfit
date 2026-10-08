import test from "node:test";
import assert from "node:assert/strict";
import {
  createRobProgramGenerationLifecycle,
  invalidateRobProgramGenerationRequest,
  isActiveRobProgramGenerationRequest,
  settleRobProgramGenerationRequest,
  startRobProgramGenerationRequest,
} from "../src/services/rob/robProgramGenerationLifecycle.js";

test("rapid generation starts with the same confirmed fingerprint create one request", () => {
  const first = startRobProgramGenerationRequest(createRobProgramGenerationLifecycle(), "requirements-a");
  const duplicate = startRobProgramGenerationRequest(first.lifecycle, "requirements-a");
  assert.ok(first.request);
  assert.equal(duplicate.request, null);
  assert.equal(duplicate.lifecycle.activeRequest.id, first.request.id);
});

test("editing invalidates pending generation and stale outcomes cannot settle it", () => {
  const started = startRobProgramGenerationRequest(createRobProgramGenerationLifecycle(), "requirements-a");
  const invalidated = invalidateRobProgramGenerationRequest(started.lifecycle);
  assert.equal(isActiveRobProgramGenerationRequest(invalidated, started.request), false);
  assert.deepEqual(settleRobProgramGenerationRequest(invalidated, started.request), invalidated);
  const retry = startRobProgramGenerationRequest(invalidated, "requirements-b");
  assert.ok(retry.request);
  assert.equal(settleRobProgramGenerationRequest(retry.lifecycle, retry.request).activeRequest, null);
});
