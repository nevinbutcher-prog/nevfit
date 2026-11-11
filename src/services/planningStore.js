import { doc, getDocFromServer, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const PLANNING_DOC_ID = "planning";

function planningDocument(uid) {
  return doc(db, "users", uid, "appState", PLANNING_DOC_ID);
}

export async function loadPlanningState(uid) {
  const snapshot = await getDocFromServer(planningDocument(uid));
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) throw new Error("unconfirmed_planning_state");

  return snapshot.exists() ? snapshot.data() : null;
}

export async function savePlanningState(uid, planningState, modelVersion = 1) {
  await runTransaction(db, async (transaction) => {
    const marker = await transaction.get(doc(db, "users", uid, "appState", "trainingModel"));
    if ((marker.exists() ? 2 : 1) !== modelVersion) throw new Error("training_mode_changed_refresh_required");
    transaction.set(planningDocument(uid), {
      ...planningState,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}
