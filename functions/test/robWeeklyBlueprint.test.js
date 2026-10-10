import test from "node:test";
import assert from "node:assert/strict";
import { assessRobWeeklyBlueprint, blueprintMessages, blueprintResponseFormat, generateRobWeeklyBlueprint, parseRobWeeklyBlueprint } from "../src/rob/robWeeklyBlueprint.js";

const requirements = (overrides = {}) => ({ version: 1, goal: "hypertrophy", daysPerWeek: 4, sessionMinutes: 75, priorities: ["balanced", "shoulders"], environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench"], constraints: "", ...overrides });
const slot = (primaryMuscle, movementPattern, role, sets = 3, secondaryStimulus = []) => ({ primaryMuscle, secondaryStimulus, movementPattern, role, sets, repRange: "8-12", restSeconds: role === "compound" ? 120 : 75, priority: role === "compound" ? "primary" : "accessory", sequencing: { order: 1, rationale: "Place the highest-priority demanding role before related accessory work." }, fatigueConsideration: "Keep related roles purposeful and manage accumulated local fatigue.", flexibility: null });
const session = (name, primaryFocus, slots) => ({ name, purpose: `${primaryFocus} emphasis within a coordinated training week.`, primaryFocus, secondaryContributions: [...new Set(slots.flatMap((item) => item.secondaryStimulus.map((secondary) => secondary.muscleGroup)))], plannedWorkingSets: slots.reduce((sum, item) => sum + item.sets, 0), stimulus: "Meaningful hard working sets with role-specific rest and progression room.", slots: slots.map((item, index) => ({ ...item, sequencing: { ...item.sequencing, order: index + 1 } })), durationGuidance: "Use the confirmed duration for warm-up, practical transitions, and adequate rest; timing remains approximate.", relationshipToWeek: "Complements the other sessions rather than requiring every muscle to be trained equally today." });
const fullBlueprint = (overrides = {}) => {
  const sessions = [
    session("Full Body — Chest Emphasis", "chest", [slot("legs", "knee_dominant", "compound", 3, [{ muscleGroup: "glutes", involvement: "supporting" }]), slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation"), slot("chest", "isolation", "isolation", 3, [{ muscleGroup: "shoulders", involvement: "supporting" }]), slot("shoulders", "vertical_push", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("arms", "isolation", "isolation"), slot("legs", "isolation", "isolation")]),
    session("Posterior & Back", "back", [slot("back", "vertical_pull", "compound", 4, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "horizontal_pull", "compound", 4, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("legs", "hinge", "compound", 4, [{ muscleGroup: "glutes", involvement: "meaningful" }]), slot("core", "trunk", "trunk", 3)]),
    session("Lower & Shoulders", "legs", [slot("legs", "knee_dominant", "compound", 4, [{ muscleGroup: "glutes", involvement: "supporting" }]), slot("legs", "hinge", "compound", 4, [{ muscleGroup: "glutes", involvement: "meaningful" }]), slot("shoulders", "vertical_push", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("shoulders", "isolation", "isolation", 3), slot("core", "trunk", "trunk", 3)]),
    session("Upper Balance", "back", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "horizontal_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "vertical_pull", "compound", 3, [{ muscleGroup: "arms", involvement: "meaningful" }]), slot("arms", "isolation", "isolation", 3), slot("core", "trunk", "trunk", 3)]),
  ];
  return { version: 1, goal: "hypertrophy", daysPerWeek: 4, weeklyStructure: { type: "focused mixed sessions", rationale: "Focused sessions preserve a balanced weekly distribution while allowing shoulder and chest emphasis." }, priorities: ["balanced", "shoulders"], coverage: ["chest", "back", "legs", "shoulders", "arms", "glutes", "core"].map((muscleGroup) => ({ muscleGroup, intent: muscleGroup === "shoulders" ? "Modest additional direct shoulder work across the week." : "Meaningful weekly coverage." })), workloadRationale: "Most sessions use meaningful hypertrophy workload while keeping the chest-emphasis day challenging but purposeful.", movementPatterns: ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "knee_dominant", "hinge", "trunk", "isolation"], recoveryConsiderations: ["Actual calendar spacing and recovery capacity are not known."], assumptions: ["Experience and recovery data are unavailable; use reasonable progression assumptions rather than minimum training."], limitations: ["Exercise identities and exact duration are deferred to later constrained selection."], sessions, ...overrides };
};

test("mocked strict generation returns a blueprint before exercise selection and retains advisory quality", async () => {
  let request;
  const result = await generateRobWeeklyBlueprint(requirements(), { provider: { generate: async (value) => { request = value; return { text: JSON.stringify(fullBlueprint()), model: "test", usage: { outputTokens: 1100 }, finishReason: "stop" }; } } });
  assert.equal(result.blueprint.sessions.length, 4);
  assert.equal(result.quality.advisoryOnly, true);
  assert.equal(request.requireResponseFormat, true);
  assert.equal(request.maxOutputTokens, 3200);
  assert.equal(JSON.stringify(request.messages).includes("wger-"), false);
  assert.equal(JSON.stringify(result.blueprint).includes("wger-"), false);
});

test("strict contract rejects malformed routines, unsupported slot fields, prescriptions, and wrong frequency", () => {
  const malformed = fullBlueprint(); malformed.sessions.pop();
  assert.throws(() => parseRobWeeklyBlueprint(JSON.stringify(malformed), requirements()), (error) => error.validationDiagnostic.reason === "blueprint_structure");
  const badSlot = fullBlueprint(); badSlot.sessions[0].slots[0].exerciseId = "wger-73";
  assert.throws(() => parseRobWeeklyBlueprint(JSON.stringify(badSlot), requirements()), (error) => error.validationDiagnostic.reason === "blueprint_structure");
  const badPrescription = fullBlueprint(); badPrescription.sessions[0].slots[0].repRange = "bad";
  assert.throws(() => parseRobWeeklyBlueprint(JSON.stringify(badPrescription), requirements()), (error) => error.validationDiagnostic.reason === "blueprint_structure");
  assert.throws(() => parseRobWeeklyBlueprint("{", requirements()), (error) => error.validationDiagnostic.reason === "json");
});

test("challenging 21-set chest-emphasis session is plausible inside a balanced week", () => {
  const blueprint = fullBlueprint(); const chest = blueprint.sessions[0];
  assert.equal(chest.slots.length, 7);
  assert.equal(chest.plannedWorkingSets, 21);
  const quality = assessRobWeeklyBlueprint(blueprint, requirements());
  assert.equal(quality.concerns.some((item) => item.routineIndex === 0 && item.code === "session_above_typical_session_workload"), false);
  assert.equal(quality.concerns.some((item) => item.code === "baseline_coverage_gap"), false);
});

test("focused sessions can remain balanced while shoulder-heavy and redundant plans receive advisory concerns", () => {
  const positive = assessRobWeeklyBlueprint(fullBlueprint(), requirements());
  assert.equal(positive.concerns.some((item) => item.code === "baseline_coverage_gap"), false);
  const shoulder = slot("shoulders", "vertical_push", "compound", 4, [{ muscleGroup: "arms", involvement: "meaningful" }]);
  const negative = fullBlueprint({ sessions: Array.from({ length: 4 }, (_, index) => session(`Shoulder ${index}`, "shoulders", [shoulder, { ...shoulder, sequencing: { ...shoulder.sequencing } }, { ...slot("shoulders", "isolation", "isolation", 4), sequencing: { order: 1, rationale: "Accessory role." } }])) });
  const quality = assessRobWeeklyBlueprint(negative, requirements());
  assert.ok(quality.concerns.some((item) => item.code === "baseline_coverage_gap"));
  assert.ok(quality.concerns.some((item) => item.code === "adjacent_pressing_fatigue"));
});

test("the second known shoulder-heavy shape remains structurally valid but advisory-low workload and role-redundant", () => {
  const presses = [slot("shoulders", "vertical_push", "compound"), slot("shoulders", "vertical_push", "compound"), slot("shoulders", "vertical_push", "compound")];
  const blueprint = fullBlueprint({ sessions: [session("Shoulder Focus 1", "shoulders", presses), session("Legs & Core", "legs", [slot("legs", "knee_dominant", "compound"), slot("legs", "hinge", "compound", 3, [{ muscleGroup: "glutes", involvement: "meaningful" }]), slot("core", "trunk", "trunk")]), session("Shoulder Focus 2", "shoulders", [slot("back", "horizontal_pull", "compound"), slot("shoulders", "vertical_push", "compound"), slot("back", "horizontal_pull", "compound")]), session("Chest & Back", "chest", [slot("chest", "horizontal_push", "compound", 3, [{ muscleGroup: "shoulders", involvement: "meaningful" }, { muscleGroup: "arms", involvement: "meaningful" }]), slot("back", "vertical_pull", "compound"), slot("back", "horizontal_pull", "compound")])] });
  const quality = assessRobWeeklyBlueprint(blueprint, requirements());
  assert.ok(quality.concerns.some((item) => item.code === "session_below_typical_session_workload"));
  assert.ok(quality.concerns.some((item) => item.code === "redundant_slot_roles" && item.routineIndex === 0));
  assert.ok(quality.concerns.some((item) => item.code === "adjacent_pressing_fatigue" && item.routineIndex === 0));
});

test("goals, frequencies, durations, multiple priorities, and policy messages remain bounded and deterministic", () => {
  for (const [goal, daysPerWeek, sessionMinutes] of [["hypertrophy", 3, 45], ["strength", 4, 60], ["hypertrophy_strength", 5, 75], ["general_fitness", 3, 60]]) {
    const req = requirements({ goal, daysPerWeek, sessionMinutes, priorities: ["balanced", "shoulders", "back"] });
    const baseSessions = fullBlueprint().sessions;
    const blueprint = fullBlueprint({ goal, daysPerWeek, sessions: Array.from({ length: daysPerWeek }, (_, index) => structuredClone(baseSessions[index % baseSessions.length])) });
    assert.doesNotThrow(() => parseRobWeeklyBlueprint(JSON.stringify(blueprint), req));
    const messages = blueprintMessages(req);
    assert.equal(messages.length, 2);
    assert.ok(messages[1].content.length < 12000);
  }
  const schema = blueprintResponseFormat().json_schema.schema;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.sessions.items.properties.slots.items.properties.primaryMuscle.enum.includes("chest"), true);
});
