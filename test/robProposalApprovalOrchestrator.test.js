import test from "node:test";
import assert from "node:assert/strict";
import { persistProgramDrafts } from "../src/services/programPersistence.js";
import { createRoutineProposalBaseline } from "../src/services/rob/robProposalApproval.js";
import {
  approveRobProposalWorkflow,
  createRobProposalState,
  rejectRobProposalWorkflow,
} from "../src/services/rob/robProposalApprovalOrchestrator.js";

const exercise = (overrides = {}) => ({ routineExerciseId: "row-1", exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: 120, supersetGroupId: null, ...overrides });
const program = (id = "program-1") => ({ id, name: id, days: [{ id: "routine-1", name: "Push", exercises: [exercise()] }] });
const proposal = () => ({ id: "proposal-1", version: 1, proposalType: "modify_routine", targetProgramId: "program-1", targetRoutineId: "routine-1", changes: [{ type: "update_exercise", targetRoutineExerciseId: "row-1", updates: { sets: 4 } }] });

function createHarness({ drafts = [program(), program("program-2")], proposalState } = {}) {
  const persisted = structuredClone(drafts);
  const unrelated = { activeWorkout: { id: "active" }, completedWorkouts: [{ id: "history" }], planning: { week: 1 }, health: { steps: 1000 } };
  const events = [];
  let currentDrafts = structuredClone(drafts);
  let currentProposalState = proposalState;
  const setter = (key) => (value) => { events.push(key); currentProposalState = key === "proposal" ? (typeof value === "function" ? value(currentProposalState) : value) : currentProposalState; };
  return {
    persisted,
    unrelated,
    events,
    get drafts() { return currentDrafts; },
    get proposalState() { return currentProposalState; },
    options: {
      proposalState,
      getLatestProgram: (id) => currentDrafts.find((item) => item.id === id),
      setProposalState: setter("proposal"),
      setProgramDrafts: (updater) => { events.push("drafts"); currentDrafts = typeof updater === "function" ? updater(currentDrafts) : updater; },
      setProgramDraftNotice: () => events.push("notice"),
      setSelectedProgramId: () => events.push("program"),
      setSelectedProgramDayId: () => events.push("routine"),
      setIsProgramEditorOpen: () => events.push("editor"),
      setViewMode: () => events.push("view"),
    },
  };
}

const readyState = (draft = program()) => {
  const candidate = proposal();
  return { ...createRobProposalState(), status: "success", proposal: candidate, baseline: createRoutineProposalBaseline(draft, candidate), preview: { items: [] } };
};

test("App approval orchestration uses the latest draft, updates only that draft, and cannot apply twice", () => {
  const harness = createHarness({ proposalState: readyState() });
  const beforePersisted = structuredClone(harness.persisted);
  const beforeUnrelated = structuredClone(harness.unrelated);
  assert.equal(approveRobProposalWorkflow(harness.options), true);
  assert.equal(harness.drafts[0].days[0].exercises[0].sets, 4);
  assert.equal(harness.drafts[1].days[0].exercises[0].sets, 3);
  assert.deepEqual(harness.persisted, beforePersisted);
  assert.deepEqual(harness.unrelated, beforeUnrelated);
  assert.equal(harness.proposalState.status, "applied");
  assert.equal(approveRobProposalWorkflow({ ...harness.options, proposalState: harness.proposalState }), false);
  assert.equal(harness.drafts[0].days[0].exercises[0].sets, 4);
  assert.ok(harness.events.includes("notice"));
  assert.equal(harness.events.includes("persistence"), false);
});

test("App rejection clears proposal state without invoking application or persistence", () => {
  const harness = createHarness({ proposalState: readyState() });
  const beforeDrafts = structuredClone(harness.drafts);
  let applicationCalls = 0;
  assert.equal(rejectRobProposalWorkflow({ proposalState: harness.proposalState, setProposalState: harness.options.setProposalState, prepare: () => { applicationCalls += 1; } }), true);
  assert.equal(harness.proposalState.status, "idle");
  assert.equal(harness.proposalState.proposal, null);
  assert.equal(harness.proposalState.baseline, null);
  assert.deepEqual(harness.drafts, beforeDrafts);
  assert.equal(applicationCalls, 0);
  assert.equal(harness.events.includes("drafts"), false);
});

test("App approval blocks a structurally valid but stale latest draft without mutation", () => {
  const initial = program();
  const staleDraft = structuredClone(initial);
  staleDraft.days[0].exercises[0].sets = 5;
  const harness = createHarness({ drafts: [staleDraft], proposalState: readyState(initial) });
  const before = structuredClone(harness.drafts);
  assert.equal(approveRobProposalWorkflow(harness.options), false);
  assert.equal(harness.proposalState.status, "stale");
  assert.equal(harness.proposalState.proposal, null);
  assert.deepEqual(harness.drafts, before);
  assert.equal(harness.events.includes("drafts"), false);
});

test("App approval leaves drafts and persisted state intact when revalidation or application fails", () => {
  for (const code of ["rob_proposal_invalidated", "rob_proposal_apply_failed"]) {
    const harness = createHarness({ proposalState: readyState() });
    const beforeDrafts = structuredClone(harness.drafts);
    const beforePersisted = structuredClone(harness.persisted);
    assert.equal(approveRobProposalWorkflow({ ...harness.options, prepare: () => ({ ok: false, code }) }), false);
    assert.equal(harness.proposalState.status, "error");
    assert.deepEqual(harness.drafts, beforeDrafts);
    assert.deepEqual(harness.persisted, beforePersisted);
    assert.equal(harness.events.includes("drafts"), false);
  }
});

test("only the subsequent normal Save Program persistence boundary persists an approved draft", async () => {
  const harness = createHarness({ proposalState: readyState() });
  assert.equal(approveRobProposalWorkflow(harness.options), true);
  const writes = [];
  await persistProgramDrafts(harness.drafts, { uid: "user-1" }, "save-program", {
    persistLocal: (value) => writes.push(["local", value]),
    saveCloud: async (uid, value) => writes.push(["cloud", uid, value]),
    logSync: () => {},
  });
  assert.deepEqual(writes.map(([type]) => type), ["local", "cloud"]);
  assert.equal(writes[0][1][0].days[0].exercises[0].sets, 4);
});

test("App approval orchestrator has no persistence imports", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/rob/robProposalApprovalOrchestrator.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|persistProgramDrafts|saveProgram|setDoc/);
});
