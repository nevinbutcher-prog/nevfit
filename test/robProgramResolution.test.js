import test from "node:test";
import assert from "node:assert/strict";
import {
  createRobProgramResolutionSession,
  getRobProgramResolutionProgress,
  materializeRobProgramProposal,
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
