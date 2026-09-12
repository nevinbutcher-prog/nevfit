import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VIEW_MODE,
  getInitialViewMode,
  getViewModeForLoadedActiveWorkout,
} from "../src/utils/navigation.js";

test("normal launch always starts at Dashboard", () => {
  assert.equal(DEFAULT_VIEW_MODE, "dashboard");
  assert.equal(getInitialViewMode(), "dashboard");
  assert.equal(getInitialViewMode(), DEFAULT_VIEW_MODE);
});

test("only a confirmed active workout promotes launch to Workout", () => {
  assert.equal(getViewModeForLoadedActiveWorkout(null), "dashboard");
  assert.equal(getViewModeForLoadedActiveWorkout(undefined), "dashboard");
  assert.equal(
    getViewModeForLoadedActiveWorkout({ routineDayId: "routine-a" }),
    "workout",
  );
});
