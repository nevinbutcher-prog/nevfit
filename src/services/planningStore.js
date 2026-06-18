import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const PLANNING_DOC_ID = "planning";

function planningDocument(uid) {
  return doc(db, "users", uid, "appState", PLANNING_DOC_ID);
}

export async function loadPlanningState(uid) {
  const snapshot = await getDoc(planningDocument(uid));

  return snapshot.exists() ? snapshot.data() : null;
}

export async function savePlanningState(uid, planningState) {
  await setDoc(
    planningDocument(uid),
    {
      ...planningState,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
