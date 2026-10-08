import test from "node:test";
import assert from "node:assert/strict";
import {
  ROB_WORKFLOW_STEPS,
  getPreselectedReviewProgram,
  getReviewablePrograms,
} from "../src/services/rob/robWorkflow.js";

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
