import test from "node:test";
import assert from "node:assert/strict";
import { ROB_CATALOGUE_INPUT_CHAR_BUDGET, buildRobExerciseCatalogue, selectRobGenerationCandidates } from "../src/services/rob/robExerciseCatalogue.js";

test("versioned catalogue is broad, equipment-aware, and exclusions are exact", () => {
  const gym = buildRobExerciseCatalogue({ requirements: { environment: "commercial_gym", equipment: [], priorities: ["back"] }, excludedExerciseIds: ["wger-73", "wger-unknown"] });
  assert.ok(gym.entries.length > 200);
  assert.ok(!gym.entries.some((entry) => entry.id === "wger-73"));
  assert.deepEqual(gym.excludedExerciseIds, ["wger-73"]);
  const dumbbells = buildRobExerciseCatalogue({ requirements: { environment: "home_gym", equipment: ["dumbbells"], priorities: [] } });
  assert.ok(dumbbells.entries.length > 10);
  assert.ok(dumbbells.entries.every((entry) => entry.equipment.join(" ").toLowerCase().includes("dumbbell")));
});

test("coverage-aware selection preserves major patterns within a metadata budget", () => {
  for (const daysPerWeek of [3, 4, 5]) {
    const full = buildRobExerciseCatalogue({ requirements: { environment: "commercial_gym", equipment: [], priorities: ["shoulders", "arms"], daysPerWeek } });
    const selected = selectRobGenerationCandidates(full, { priorities: ["shoulders", "arms"] });
    assert.ok(selected.serializedChars <= ROB_CATALOGUE_INPUT_CHAR_BUDGET);
    assert.ok(selected.coverage.includes("horizontal_pull"));
    assert.ok(selected.coverage.includes("knee_dominant"));
  }
});
