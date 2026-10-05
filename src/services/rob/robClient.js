import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";
export { RobClientError } from "./robClientError.js";
import { RobClientError } from "./robClientError.js";

export async function requestRobAdvice({ question, context }) {
  try {
    const result = await httpsCallable(functions, "robAdvice")({ question, context });
    return result.data;
  } catch (error) {
    throw new RobClientError(error?.details && typeof error.details === "object" ? error.details : {});
  }
}
