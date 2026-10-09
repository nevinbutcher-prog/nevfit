import test from "node:test";
import assert from "node:assert/strict";
import {
  createRobProgramResolutionSession,
  getRobProgramResolutionProgress,
  materializeRobProgramProposal,
  mergeRobProgramResolutionResult,
  resolveRobProgramExercises,
  searchRobProgramExercises,
  selectRobProgramExercise,
} from "../src/services/rob/robProgramResolution.js";

const candidate = { proposalType: "create_program", program: { name: "Four day plan", summary: "Balanced", days: ["Upper A", "Lower A", "Upper B", "Lower B"].map((name, routineIndex) => ({ name, focus: name, exercises: [{ exerciseRef: routineIndex === 0 ? "Cable row" : "Press " + routineIndex, sets: 3, repRange: "8-12", restSeconds: 90, note: null, proposalGroupKey: null }] })) } };
const requirements = { version: 1, goal: "hypertrophy" };
const provider = async (query) => query === "Cable row" ? [{ id: "wger-row", name: "Cable row" }, { id: "wger-row-alt", name: "Cable row" }] : [{ id: "wger-" + query.replace(/[^a-z0-9]/gi, "").toLowerCase(), name: query }];
const ids = (() => { let number = 0; return (prefix) => prefix + "-" + (++number); })();

test("whole-program resolution preserves every slot and materialises a validated proposal", async () => {
  const original = structuredClone(candidate);
  const started = createRobProgramResolutionSession({ candidate, requirements });
  const resolved = await resolveRobProgramExercises(started, { searchExercises: provider, concurrency: 2 });
  assert.equal(getRobProgramResolutionProgress(resolved.session).remaining, 1);
  const selected = selectRobProgramExercise(resolved.session, { key: "days.0.exercises.0", exerciseId: "wger-row" });
  const result = materializeRobProgramProposal(selected.session, { programs: [], createId: ids });
  assert.equal(result.validation.valid, true);
  assert.equal(result.proposal.program.days.length, 4);
  assert.equal(result.proposal.program.days[0].exercises[0].exerciseId, "wger-row");
  assert.deepEqual(candidate, original);
});

test("resolution keys are routine-local, forged selections are rejected, and manual replacement preserves prescription", async () => {
  let session = createRobProgramResolutionSession({ candidate, requirements });
  session = (await resolveRobProgramExercises(session, { searchExercises: provider })).session;
  const forged = selectRobProgramExercise(session, { key: "days.1.exercises.0", exerciseId: "wger-forged" });
  assert.equal(forged.error.code, "untrusted_exercise_selection");
  session = (await searchRobProgramExercises(session, { key: "days.1.exercises.0", query: "Seated cable row", searchExercises: async () => [{ id: "wger-seated", name: "Seated cable row" }] })).session;
  session = selectRobProgramExercise(session, { key: "days.1.exercises.0", exerciseId: "wger-seated" }).session;
  assert.equal(session.entries["days.1.exercises.0"].selectedExercise.name, "Seated cable row");
  assert.equal(session.candidate.program.days[1].exercises[0].repRange, "8-12");
  assert.equal(selectRobProgramExercise(session, { key: "days.9.exercises.0", exerciseId: "wger-seated" }).error.code, "invalid_resolution_key");
});

test("late searches merge only unchanged entries and never replace a newer selection", async () => {
  let release; const pending = new Promise((resolve) => { release = resolve; });
  const session = createRobProgramResolutionSession({ candidate, requirements });
  const search = searchRobProgramExercises(session, { key: "days.0.exercises.0", query: "Cable row", searchExercises: async () => pending });
  const prepared = await searchRobProgramExercises(session, { key: "days.0.exercises.0", query: "Cable row", searchExercises: async () => [{ id: "wger-new", name: "New row" }] });
  let current = selectRobProgramExercise(prepared.session, { key: "days.0.exercises.0", exerciseId: "wger-new" }).session;
  release([{ id: "wger-old", name: "Old row" }]);
  const late = await search;
  current = mergeRobProgramResolutionResult(current, late);
  assert.equal(current.entries["days.0.exercises.0"].selectedExercise.id, "wger-new");
});

test("late results do not cross candidate fingerprints or erase other exercise decisions", async () => {
  const session = createRobProgramResolutionSession({ candidate, requirements });
  const result = await searchRobProgramExercises(session, { key: "days.0.exercises.0", query: "Cable row", searchExercises: async () => [{ id: "wger-row", name: "Cable row" }] });
  let changed = selectRobProgramExercise((await searchRobProgramExercises(session, { key: "days.1.exercises.0", query: "Press 1", searchExercises: provider })).session, { key: "days.1.exercises.0", exerciseId: "wger-press1" }).session;
  changed = mergeRobProgramResolutionResult(changed, result);
  assert.equal(changed.entries["days.1.exercises.0"].selectedExercise.id, "wger-press1");
  const replacement = createRobProgramResolutionSession({ candidate: { ...candidate, program: { ...candidate.program, name: "Different" } }, requirements });
  assert.equal(mergeRobProgramResolutionResult(replacement, result), replacement);
});
