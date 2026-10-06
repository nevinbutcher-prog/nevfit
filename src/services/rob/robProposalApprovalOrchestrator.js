import { prepareRoutineProposalApplication } from "./robProposalApproval.js";

export const createRobProposalState = () => ({
  status: "idle",
  explanation: null,
  proposal: null,
  baseline: null,
  preview: null,
  error: null,
});

const failureMessage = (code) => {
  if (code === "rob_proposal_stale") return "This routine has changed since Rob prepared these suggestions. Review the latest routine with Rob again before applying them.";
  if (code === "rob_proposal_target_missing") return "The proposal's target is no longer available. Review the latest routine with Rob again.";
  if (code === "rob_proposal_invalidated") return "These suggestions are no longer valid for this routine. Review the latest routine with Rob again.";
  return "Fitbot couldn't apply these changes safely. Your routine hasn't been changed.";
};

export function rejectRobProposalWorkflow({ proposalState, setProposalState }) {
  if (proposalState.status === "applying") return false;
  setProposalState(createRobProposalState());
  return true;
}

export function approveRobProposalWorkflow({
  proposalState,
  getLatestProgram,
  setProposalState,
  setProgramDrafts,
  setProgramDraftNotice,
  setSelectedProgramId,
  setSelectedProgramDayId,
  setIsProgramEditorOpen,
  setViewMode,
  prepare = prepareRoutineProposalApplication,
}) {
  if (proposalState.status !== "success" || !proposalState.proposal || !proposalState.baseline) return false;
  const { proposal, baseline } = proposalState;
  setProposalState((state) => ({ ...state, status: "applying", error: null }));
  const prepared = prepare(getLatestProgram(baseline.programId), proposal, baseline);
  if (!prepared.ok) {
    setProposalState((state) => ({ ...state, status: prepared.code === "rob_proposal_stale" ? "stale" : "error", proposal: null, baseline: null, error: failureMessage(prepared.code) }));
    return false;
  }
  const message = "Changes added to your program draft. Review them and use Save Program when you're ready.";
  setProgramDrafts((drafts) => drafts.map((program) => program.id === prepared.result.program.id ? prepared.result.program : program));
  setProgramDraftNotice({ programId: prepared.result.program.id, message });
  setSelectedProgramId(prepared.result.program.id);
  setSelectedProgramDayId(prepared.result.routineId);
  setIsProgramEditorOpen(true);
  setProposalState({ ...createRobProposalState(), status: "applied", error: message });
  setViewMode("routines");
  return true;
}
