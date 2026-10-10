import test from "node:test";
import assert from "node:assert/strict";
import { ROB_CATALOGUE_INPUT_CHAR_BUDGET, buildRobExerciseCatalogue, selectRobGenerationCandidates } from "../src/services/rob/robExerciseCatalogue.js";

test("versioned catalogue is broad, equipment-aware, and exclusions are exact", () => {
  const gym = buildRobExerciseCatalogue({ requirements: { environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench", "pull_up_equipment"], priorities: ["back"] }, excludedExerciseIds: ["wger-73", "wger-unknown"] });
  assert.ok(gym.entries.length > 100);
  assert.ok(!gym.entries.some((entry) => entry.id === "wger-73"));
  assert.deepEqual(gym.excludedExerciseIds, ["wger-73"]);
  const dumbbells = buildRobExerciseCatalogue({ requirements: { environment: "home_gym", equipment: ["dumbbells"], priorities: [] } });
  assert.ok(dumbbells.entries.length > 10);
  assert.ok(dumbbells.entries.every((entry) => entry.equipment.join(" ").toLowerCase().includes("dumbbell") || entry.equipment.join(" ").toLowerCase().includes("bodyweight")));
});

test("mixed available equipment satisfies each exercise requirement without treating unknown metadata as bodyweight", () => {
  const full = buildRobExerciseCatalogue({ requirements: { environment: "home_gym", equipment: ["machines", "cables", "dumbbells", "bench"], priorities: [] } });
  assert.ok(full.entries.some((entry) => entry.equipment.join(" ").toLowerCase().includes("cable")));
  assert.ok(full.entries.some((entry) => entry.equipment.join(" ").toLowerCase().includes("dumbbell")));
  assert.ok(full.entries.every((entry) => entry.equipment.length > 0));
  const withoutBench = buildRobExerciseCatalogue({ requirements: { environment: "home_gym", equipment: ["dumbbells"], priorities: [] } });
  assert.ok(!withoutBench.entries.some((entry) => /bench/.test(entry.equipment.join(" ").toLowerCase())));
});

test("coverage-aware selection preserves major patterns within a metadata budget", () => {
  for (const daysPerWeek of [3, 4, 5]) {
    const full = buildRobExerciseCatalogue({ requirements: { environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench", "pull_up_equipment"], priorities: ["shoulders", "arms"], daysPerWeek } });
    const selected = selectRobGenerationCandidates(full, { priorities: ["shoulders", "arms"] });
    assert.ok(selected.serializedChars <= ROB_CATALOGUE_INPUT_CHAR_BUDGET);
    assert.ok(selected.coverage.includes("horizontal_pull"));
    assert.ok(selected.coverage.includes("knee_dominant"));
  }
});
