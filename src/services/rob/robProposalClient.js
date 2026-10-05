import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";
import { RobClientError } from "./robClientError.js";
export { resolveRobProposalCandidate } from "./robProposalResolver.js";

export async function requestRobProposal({ context, request }) {
  try { return (await httpsCallable(functions, "robProposal")({ context, request })).data; }
  catch (error) { throw new RobClientError(error?.details && typeof error.details === "object" ? error.details : {}); }
}
