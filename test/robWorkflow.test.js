import test from "node:test";
import assert from "node:assert/strict";
import {
  ROB_WORKFLOW_STEPS,
  getPreselectedReviewProgram,
  getReviewablePrograms,
  isCurrentReviewRequest,
} from "../src/services/rob/robWorkflow.js";
import {
  createRobReviewFingerprint,
  createRobReviewLifecycle,
  invalidateRobReviewRequest,
  isActiveRobReviewRequest,
  settleRobReviewRequest,
  startRobReviewRequest,
} from "../src/services/rob/robReviewLifecycle.js";

test("Rob workflow exposes its shared primary destinations", () => {
  assert.deepEqual(ROB_WORKFLOW_STEPS, {
    HOME: "home",
    ADVICE: "advice",
    PROGRAM_SELECTION: "program_selection",
    PROGRAM_REVIEW: "program_review",
    PROGRAM_BUILD: "program_build",
    ROUTINE_REVIEW: "routine_review",
  });
});

test("only the current selected program review request may update the workflow", () => {
  assert.equal(isCurrentReviewRequest(4, 4, "program-b", "program-b"), true);
  assert.equal(isCurrentReviewRequest(5, 4, "program-b", "program-b"), false);
  assert.equal(isCurrentReviewRequest(4, 4, "program-a", "program-b"), false);
});

test("a replacement review invalidates the first request and cannot remain locked loading", () => {
  const initial = createRobReviewLifecycle();
  const first = startRobReviewRequest(initial, { targetProgramId: "program-a", fingerprint: "a" });
  const released = invalidateRobReviewRequest(first.lifecycle);
  const second = startRobReviewRequest(released, { targetProgramId: "program-b", fingerprint: "b" });
  assert.equal(isActiveRobReviewRequest(second.lifecycle, first.request), false);
  assert.equal(isActiveRobReviewRequest(second.lifecycle, second.request), true);
  assert.equal(settleRobReviewRequest(second.lifecycle, first.request), second.lifecycle);
  assert.equal(settleRobReviewRequest(second.lifecycle, second.request).activeRequest, null);
});

test("review fingerprints change with the reviewed program or routine context", () => {
  const program = { id: "program-a", name: "Program", days: [{ id: "routine-a", exercises: [] }] };
  const first = createRobReviewFingerprint(program, null);
  assert.notEqual(first, createRobReviewFingerprint({ ...program, name: "Changed" }, null));
  assert.notEqual(first, createRobReviewFingerprint(program, "routine-a"));
});

test("program review requires an available, explicitly selected program", () => {
  const programs = [
    { id: "program-a", name: "Upper lower" },
    { id: "program-b", name: "Archived", archived: true },
    { id: "program-c", name: "" },
  ];
  assert.deepEqual(getReviewablePrograms(programs).map(({ id }) => id), ["program-a"]);
  assert.equal(getPreselectedReviewProgram(programs, "program-a")?.name, "Upper lower");
  assert.equal(getPreselectedReviewProgram(programs, "program-b"), null);
  assert.equal(getPreselectedReviewProgram(programs, null), null);
});
