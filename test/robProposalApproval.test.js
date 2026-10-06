import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoutineProposalPreview,
  createRoutineProposalBaseline,
  isRoutineProposalFresh,
  prepareRoutineProposalApplication,
} from "../src/services/rob/robProposalApproval.js";

const exercise = (routineExerciseId, exerciseId, overrides = {}) => ({ routineExerciseId, exerciseId, sets: 3, repRange: "8-12", restSeconds: 120, supersetGroupId: null, ...overrides });
const program = () => ({ id: "program-1", days: [{ id: "routine-1", name: "Push A", exercises: [exercise("row-a", "wger-a"), exercise("row-b", "wger-b", { note: "Slow tempo", supersetGroupId: "ss-1" }), exercise("row-c", "wger-c", { supersetGroupId: "ss-1" })] }] });
const proposal = (changes) => ({ id: "proposal-1", version: 1, proposalType: "modify_routine", targetProgramId: "program-1", targetRoutineId: "routine-1", changes });
const names = { "wger-a": "Bench Press", "wger-b": "Cable Row", "wger-c": "Lateral Raise", "wger-d": "Lat Pulldown" };

test("preview makes every supported modification human-readable without IDs", () => {
  const result = buildRoutineProposalPreview(program(), proposal([
    { type: "add_exercise", afterRoutineExerciseId: "row-a", exercise: exercise("row-d", "wger-d", { sets: 4, repRange: "6-10", restSeconds: 90 }) },
    { type: "remove_exercise", targetRoutineExerciseId: "row-b" },
    { type: "replace_exercise", targetRoutineExerciseId: "row-c", exercise: exercise(undefined, "wger-d", { sets: 2 }) },
    { type: "move_exercise", targetRoutineExerciseId: "row-a", afterRoutineExerciseId: null },
    { type: "update_exercise", targetRoutineExerciseId: "row-a", updates: { sets: 4, repRange: "6-10", restSeconds: 90, displayNameOverride: "Incline press", note: "Pause" } },
    { type: "rename_routine", name: "Upper A" },
    { type: "set_superset", proposalGroupKey: "new-pair", memberRoutineExerciseIds: ["row-a", "row-d"] },
    { type: "clear_superset", targetRoutineExerciseId: "row-b" },
  ]), { getExerciseName: (id) => names[id] });
  assert.equal(result.valid, true);
  const text = result.items.flatMap((item) => [item.title, ...item.details]).join("\n");
  assert.match(text, /Add Lat Pulldown/);
  assert.match(text, /Remove Cable Row/);
  assert.match(text, /Replace Lateral Raise/);
  assert.match(text, /Move Bench Press/);
  assert.match(text, /Sets: 3 → 4/);
  assert.match(text, /Routine name[\s\S]*Push A → Upper A/);
  assert.match(text, /Create superset/);
  assert.match(text, /Remove superset containing Cable Row/);
  assert.doesNotMatch(text, /row-a|wger-a|proposalGroupKey/);
});

test("preview blocks approval when an exercise name cannot be resolved", () => {
  const result = buildRoutineProposalPreview(program(), proposal([{ type: "remove_exercise", targetRoutineExerciseId: "row-a" }]), { getExerciseName: () => null });
  assert.equal(result.valid, false);
  assert.equal(result.code, "rob_proposal_preview_unavailable");
});

test("preview renders nullable rest as None without a seconds suffix", () => {
  const result = buildRoutineProposalPreview(program(), proposal([{ type: "update_exercise", targetRoutineExerciseId: "row-a", updates: { restSeconds: null } }]), { getExerciseName: (id) => names[id] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.items[0].details, ["Rest: 120 sec → None"]);
});

test("baseline detects prescriptions, order, supersets, and routine names changing", () => {
  const original = program();
  const baseline = createRoutineProposalBaseline(original, proposal([{ type: "update_exercise", targetRoutineExerciseId: "row-a", updates: { sets: 4 } }]));
  assert.equal(isRoutineProposalFresh(structuredClone(original), baseline), true);
  for (const mutate of [
    (copy) => { copy.days[0].exercises[0].sets = 5; },
    (copy) => { copy.days[0].exercises.reverse(); },
    (copy) => { copy.days[0].exercises[0].supersetGroupId = "different"; },
    (copy) => { copy.days[0].name = "Changed"; },
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.equal(isRoutineProposalFresh(changed, baseline), false);
  }
});

test("approval preparation is draft-only, revalidates, and blocks stale or invalid proposals", () => {
  const current = program();
  const valid = proposal([{ type: "update_exercise", targetRoutineExerciseId: "row-a", updates: { sets: 4 } }]);
  const baseline = createRoutineProposalBaseline(current, valid);
  const approved = prepareRoutineProposalApplication(current, valid, baseline);
  assert.equal(approved.ok, true);
  assert.equal(current.days[0].exercises[0].sets, 3);
  assert.equal(approved.result.program.days[0].exercises[0].sets, 4);
  const changed = structuredClone(current);
  changed.days[0].exercises[0].sets = 5;
  assert.equal(prepareRoutineProposalApplication(changed, valid, baseline).code, "rob_proposal_stale");
  const invalid = structuredClone(valid);
  invalid.changes[0].targetRoutineExerciseId = "missing";
  assert.equal(prepareRoutineProposalApplication(current, invalid, baseline).code, "rob_proposal_invalidated");
  assert.equal(prepareRoutineProposalApplication(current, valid, baseline, { apply: () => ({ applied: false, errors: [] }) }).code, "rob_proposal_apply_failed");
});

test("approval helper has no persistence dependencies", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/rob/robProposalApproval.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|saveProgram|setDoc/);
});
