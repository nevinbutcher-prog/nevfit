import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { RobClientError } from "./robClient";
export async function requestRobReview({ context }) { try { return (await httpsCallable(functions, "robReview")({ context })).data; } catch (error) { throw new RobClientError(error?.details && typeof error.details === "object" ? error.details : {}); } }
