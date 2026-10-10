import test from "node:test";
import assert from "node:assert/strict";
import { fulfilRobWeeklyBlueprint } from "../src/rob/robBlueprintFulfilment.js";
import { SERVER_CATALOGUE, createServerAuthorisedRobCatalogue } from "../src/rob/robExerciseCatalogue.js";

const requirements = (overrides = {}) => ({ version: 1, goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 75, priorities: ["balanced", "shoulders"], environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench", "pull_up_equipment"], constraints: "", ...overrides });
const slot = (primaryMuscle, movementPattern, role, sets = 3, secondaryStimulus = []) => ({ primaryMuscle, secondaryStimulus, movementPattern, role, sets, repRange: "8-12", restSeconds: role === "compound" ? 120 : 75, priority: role === "compound" ? "primary" : "accessory", sequencing: { order: 1, rationale: "Preserve the intended session priority." }, fatigueConsideration: "Manage related local fatigue while retaining purposeful work.", flexibility: null });
const session = (name, primaryFocus, slots) => ({ name, purpose: `${primaryFocus} focused session within the weekly plan.`, primaryFocus, secondaryContributions: [...new Set(slots.flatMap((item) => item.secondaryStimulus.map((secondary) => secondary.muscleGroup)))], plannedWorkingSets: slots.reduce((sum, item) => sum + item.sets, 0), stimulus: "Purposeful hard working sets.", slots: slots.map((item, index) => ({ ...item, sequencing: { ...item.sequencing, order: index + 1 } })), durationGuidance: "Allow practical warm-up, rest, setup, and transitions.", relationshipToWeek: "Complements other focused sessions." });
const blueprint = (overrides = {}) => {
  const sessions = [
    session("Chest & Row", "chest", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "horizontal_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "vertical_push", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }])]),
    session("Lower", "legs", [slot("legs", "knee_dominant", "compound", 4, [{ muscleGroup: "glutes", involvement: "supporting" }]), slot("legs", "hinge", "compound", 4, [{ muscleGroup: "glutes", involvement: "meaningful" }]), slot("core", "trunk", "trunk", 3)]),
    session("Back & Delts", "back", [slot("back", "vertical_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation", 3), slot("arms", "isolation", "isolation", 3)]),
    session("Upper Balance", "chest", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "horizontal_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("core", "trunk", "trunk", 3)]),
  ];
  return { version: 1, goal: "hypertrophy", daysPerWeek: 4, weeklyStructure: { type: "focused mixed", rationale: "Focused sessions produce a balanced, shoulder-emphasised week." }, priorities: ["balanced", "shoulders"], coverage: ["chest", "back", "legs", "shoulders", "arms", "glutes", "core"].map((muscleGroup) => ({ muscleGroup, intent: "Meaningful weekly training intent." })), workloadRationale: "Session work is purposeful and workload is preserved through fulfilment.", movementPatterns: ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "knee_dominant", "hinge", "trunk", "isolation"], recoveryConsiderations: ["Calendar spacing is unavailable."], assumptions: ["Experience is unavailable."], limitations: ["Exercise selection is constrained to the authorised catalogue."], sessions, ...overrides };
};
const catalogue = (ids, overrides = {}) => ({ version: 2, ids, ...overrides });
const ids = ["wger-73", "wger-185", "wger-2669", "wger-567", "wger-1801", "wger-507", "wger-458", "wger-723", "wger-475", "wger-2658", "wger-1931", "wger-1922", "wger-1809", "wger-1620", "wger-1603"];
const selected = (result) => result.candidate.program.days.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId));

test("fulfils a four-day balanced shoulder-emphasis blueprint with trusted IDs and preserves every prescription", () => {
  const result = fulfilRobWeeklyBlueprint({ blueprint: blueprint(), requirements: requirements(), catalogue: catalogue(ids) });
  assert.equal(result.feasible, true);
  assert.deepEqual(selected(result), ["wger-73", "wger-2669", "wger-567", "wger-1801", "wger-507", "wger-458", "wger-723", "wger-2658", "wger-1931", "wger-185", "wger-2669", "wger-458"]);
  assert.equal(result.candidate.program.days.flatMap((day) => day.exercises).reduce((sum, item) => sum + item.sets, 0), blueprint().sessions.reduce((sum, day) => sum + day.plannedWorkingSets, 0));
  assert.ok(result.selections.every((item) => item.source === "server_catalogue" && item.explanation.includes("Trusted catalogue")));
  assert.ok(Array.isArray(result.quality.concerns));
  assert.ok(result.quality.observations.some((item) => item.code === "complementary_push_pull_sequence" && item.routineIndex === 0));
  assert.ok(result.quality.observations.some((item) => item.code === "accumulated_pressing_overlap" && item.routineIndex === 0));
});

test("selection supports purposeful variation and legitimate repetition without a one-exercise-per-week rule", () => {
  const varied = fulfilRobWeeklyBlueprint({ blueprint: blueprint(), requirements: requirements(), catalogue: catalogue(ids) });
  assert.equal(selected(varied)[0], "wger-73");
  assert.equal(selected(varied)[9], "wger-185");
  const repeated = fulfilRobWeeklyBlueprint({ blueprint: blueprint(), requirements: requirements(), catalogue: catalogue(ids.filter((id) => id !== "wger-185")) });
  assert.equal(selected(repeated)[0], "wger-73");
  assert.equal(selected(repeated)[9], "wger-73");
});

test("pulling and hip-hinge slots select their exact trusted roles while untrusted leg-curl metadata is not substituted", () => {
  const specific = blueprint({ sessions: [session("Pull & Posterior", "back", [slot("back", "vertical_pull", "compound"), slot("legs", "hinge", "compound", 3, [{ muscleGroup: "glutes", involvement: "meaningful" }])]), session("Chest", "chest", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }, { muscleGroup: "shoulders", involvement: "meaningful" }])]), session("Row", "back", [slot("back", "horizontal_pull", "compound")]), session("Core", "core", [slot("core", "trunk", "trunk")])], coverage: ["chest", "back", "legs", "glutes", "arms", "shoulders", "core"].map((muscleGroup) => ({ muscleGroup, intent: "Planned." })), movementPatterns: ["vertical_pull", "hinge", "horizontal_push", "horizontal_pull", "trunk"] });
  const result = fulfilRobWeeklyBlueprint({ blueprint: specific, requirements: requirements(), catalogue: catalogue(ids) });
  assert.equal(result.feasible, true);
  assert.deepEqual(selected(result).slice(0, 2), ["wger-723", "wger-507"]);
  const pullUp = fulfilRobWeeklyBlueprint({ blueprint: specific, requirements: requirements(), catalogue: catalogue(ids.filter((id) => id !== "wger-723")) });
  assert.equal(selected(pullUp)[0], "wger-475");
  const legCurlBlueprint = structuredClone(specific); legCurlBlueprint.sessions[0] = session("Leg Curl Intent", "legs", [slot("legs", "isolation", "isolation")]); legCurlBlueprint.coverage = ["chest", "back", "legs", "shoulders", "arms", "core"].map((muscleGroup) => ({ muscleGroup, intent: "Planned." })); legCurlBlueprint.movementPatterns = ["isolation", "horizontal_push", "horizontal_pull", "trunk"];
  const unresolved = fulfilRobWeeklyBlueprint({ blueprint: legCurlBlueprint, requirements: requirements(), catalogue: catalogue(["wger-1603", "wger-507", "wger-73", "wger-2669", "wger-458"]) });
  assert.equal(unresolved.feasible, false);
  assert.equal(unresolved.selections.some((item) => item.exerciseId === "wger-1603"), false);
});

test("equipment conflicts, exclusions, unknown or unsuitable records, and infeasible slots remain explicit", () => {
  const onlyBench = catalogue(["wger-73"]);
  const equipment = fulfilRobWeeklyBlueprint({ blueprint: blueprint(), requirements: requirements({ equipment: ["dumbbells"], environment: "home_gym" }), catalogue: onlyBench });
  assert.equal(equipment.feasible, false);
  assert.equal(equipment.unresolvedSlots[0].code, "no_trustworthy_catalogue_match");
  const excluded = fulfilRobWeeklyBlueprint({ blueprint: blueprint(), requirements: requirements(), catalogue: catalogue(ids, { excludedExerciseIds: ["wger-73", "wger-185"] }) });
  assert.equal(excluded.feasible, false);
  const incompatible = fulfilRobWeeklyBlueprint({ blueprint: blueprint(), requirements: requirements(), catalogue: catalogue(["wger-458"]) });
  assert.equal(incompatible.feasible, false);
  assert.ok(incompatible.unresolvedSlots.every((item) => item.code === "no_trustworthy_catalogue_match"));
});

test("fulfilment is deterministic and preserves blueprint ordering for challenging sessions", () => {
  const chest = blueprint(); chest.sessions[0] = session("Chest Emphasis", "chest", [slot("legs", "knee_dominant", "compound"), slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation"), slot("chest", "isolation", "isolation"), slot("shoulders", "vertical_push", "compound"), slot("arms", "isolation", "isolation"), slot("legs", "isolation", "isolation")]); chest.movementPatterns = ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "knee_dominant", "hinge", "trunk", "isolation"];
  const first = fulfilRobWeeklyBlueprint({ blueprint: chest, requirements: requirements(), catalogue: catalogue(ids) });
  const second = fulfilRobWeeklyBlueprint({ blueprint: chest, requirements: requirements(), catalogue: catalogue(ids) });
  assert.equal(first.feasible, true, JSON.stringify(first.unresolvedSlots));
  assert.deepEqual(selected(first), selected(second));
  assert.equal(first.candidate.program.days[0].exercises.reduce((sum, item) => sum + item.sets, 0), 21);
});

test("shoulder-dominant blueprints remain executable but expose selected-exercise quality concerns", () => {
  const shoulder = slot("shoulders", "vertical_push", "compound", 4, [{ muscleGroup: "arms", involvement: "meaningful" }]);
  const dominant = blueprint({
    sessions: Array.from({ length: 4 }, (_, index) => session(`Shoulder ${index + 1}`, "shoulders", [shoulder, slot("shoulders", "isolation", "isolation", 4)])),
    coverage: ["shoulders", "arms"].map((muscleGroup) => ({ muscleGroup, intent: "Planned." })),
    movementPatterns: ["vertical_push", "isolation"],
  });
  const result = fulfilRobWeeklyBlueprint({ blueprint: dominant, requirements: requirements(), catalogue: catalogue(["wger-567", "wger-2658"]) });
  assert.equal(result.feasible, true);
  assert.ok(result.quality.concerns.some((item) => item.code === "baseline_coverage_gap"));
  assert.ok(result.quality.concerns.some((item) => item.code === "session_below_typical_session_workload"));
});

test("narrow isolation intents select the requested trusted purpose and leave unsupported intent explicit", () => {
  const isolated = blueprint({
    sessions: [
      session("Biceps", "arms", [slot("arms", "isolation", "isolation", 3)]),
      session("Triceps", "arms", [slot("arms", "isolation", "isolation", 3)]),
      session("Hamstrings", "legs", [slot("legs", "isolation", "isolation", 3)]),
      session("Rear Delts", "shoulders", [slot("shoulders", "isolation", "isolation", 3)]),
    ],
    coverage: ["arms", "legs", "shoulders"].map((muscleGroup) => ({ muscleGroup, intent: "Planned." })),
    movementPatterns: ["isolation"],
  });
  isolated.sessions[0].slots[0].selectionIntent = "biceps_flexion";
  isolated.sessions[1].slots[0].selectionIntent = "triceps_extension";
  isolated.sessions[2].slots[0].selectionIntent = "knee_flexion";
  isolated.sessions[3].slots[0].selectionIntent = "rear_delt";
  const result = fulfilRobWeeklyBlueprint({ blueprint: isolated, requirements: requirements(), catalogue: catalogue(["wger-1931", "wger-211", "wger-1294", "wger-487", "wger-2658"]) });
  assert.equal(result.feasible, true);
  assert.deepEqual(selected(result), ["wger-1931", "wger-211", "wger-1294", "wger-487"]);
  assert.deepEqual(result.selections.map((item) => item.selectionIntent), ["biceps_flexion", "triceps_extension", "knee_flexion", "rear_delt"]);
  isolated.sessions[2].slots[0].selectionIntent = "knee_extension";
  const unsupported = fulfilRobWeeklyBlueprint({ blueprint: isolated, requirements: requirements(), catalogue: catalogue(["wger-1294", "wger-1931", "wger-211", "wger-487"]) });
  assert.equal(unsupported.feasible, false);
  assert.equal(unsupported.unresolvedSlots[0].selectionIntent, "knee_extension");
});

test("a realistic four-day 75-minute hypertrophy blueprint fulfils as a complete varied training week", () => {
  const complete = blueprint({
    sessions: [
      session("Upper A", "chest", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "horizontal_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "vertical_push", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation", 3), slot("arms", "isolation", "isolation", 3), slot("arms", "isolation", "isolation", 3)]),
      session("Lower", "legs", [slot("legs", "knee_dominant", "compound", 3, [{ muscleGroup: "glutes", involvement: "supporting" }]), slot("legs", "hinge", "compound", 3, [{ muscleGroup: "glutes", involvement: "meaningful" }]), slot("glutes", "hinge", "compound", 3), slot("legs", "isolation", "isolation", 3), slot("core", "trunk", "trunk", 3), slot("legs", "knee_dominant", "compound", 3, [{ muscleGroup: "glutes", involvement: "supporting" }])]),
      session("Upper B", "back", [slot("back", "vertical_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "horizontal_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation", 3), slot("arms", "isolation", "isolation", 3), slot("chest", "isolation", "isolation", 3), slot("core", "trunk", "trunk", 3)]),
      session("Full Body", "chest", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("legs", "knee_dominant", "compound", 3, [{ muscleGroup: "glutes", involvement: "supporting" }]), slot("legs", "hinge", "compound", 3, [{ muscleGroup: "glutes", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation", 3), slot("arms", "isolation", "isolation", 3), slot("core", "trunk", "trunk", 3)]),
    ],
    movementPatterns: ["horizontal_push", "horizontal_pull", "vertical_push", "isolation", "knee_dominant", "hinge", "trunk", "vertical_pull"],
  });
  complete.sessions[0].slots[3].selectionIntent = "lateral_delt";
  complete.sessions[0].slots[4].selectionIntent = "triceps_extension";
  complete.sessions[0].slots[5].selectionIntent = "biceps_flexion";
  complete.sessions[1].slots[3].selectionIntent = "knee_flexion";
  complete.sessions[2].slots[2].selectionIntent = "rear_delt";
  complete.sessions[2].slots[3].selectionIntent = "biceps_flexion";
  complete.sessions[3].slots[3].selectionIntent = "lateral_delt";
  complete.sessions[3].slots[4].selectionIntent = "triceps_extension";
  const actualAuthorisedIds = ["wger-73", "wger-185", "wger-2669", "wger-1117", "wger-567", "wger-2658", "wger-348", "wger-211", "wger-659", "wger-1931", "wger-1801", "wger-203", "wger-507", "wger-294", "wger-1294", "wger-458", "wger-723", "wger-475", "wger-487", "wger-1922"];
  const result = fulfilRobWeeklyBlueprint({ blueprint: complete, requirements: requirements(), catalogue: catalogue(actualAuthorisedIds) });
  assert.equal(result.feasible, true, JSON.stringify(result.unresolvedSlots));
  assert.equal(result.candidate.program.days.length, 4);
  assert.ok(result.candidate.program.days.every((day) => day.exercises.length === 6 && day.exercises.reduce((sum, item) => sum + item.sets, 0) === 18));
  assert.equal(new Set(selected(result)).size >= 16, true);
  assert.equal(result.quality.concerns.some((item) => item.code === "baseline_coverage_gap"), false);
  assert.equal(result.quality.concerns.some((item) => item.code === "session_below_typical_session_workload"), false);
  assert.deepEqual(selected(result).map((id) => SERVER_CATALOGUE.get(id).name), ["Bench Press", "Bent Over Dumbbell Rows", "Shoulder Press, Dumbbells", "Dumbbell Lateral Raise", "Dumbbell Triceps Extension", "Dumbbell Curl", "Dumbbell Goblet Squat", "Romanian Deadlift", "Hip Thrust", "Single-leg hamstring curl", "Plank", "Barbell Full Squat", "Wide-grip Pulldown", "Seated Cable Row", "Rear Delt Raises", "Dumbbell Curl", "Seated Cable chest fly", "Plank", "Decline Bench Press Barbell", "Dumbbell Goblet Squat", "Romanian Deadlift", "Lateral Raises", "Triceps Extensions on Cable", "Plank"]);
});

test("future integration can derive authorised IDs and exclusions only from server-owned inputs", () => {
  const authorised = createServerAuthorisedRobCatalogue(requirements(), ["wger-73", "not-a-real-id"]);
  assert.equal(authorised.version, 2);
  assert.equal(authorised.ids.includes("wger-73"), false);
  assert.equal(authorised.ids.includes("wger-567"), true);
  assert.deepEqual(authorised.excludedExerciseIds, ["wger-73"]);
  assert.ok(authorised.ids.every((id) => SERVER_CATALOGUE.has(id)));
});
