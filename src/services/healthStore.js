import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const HEALTH_DOC_ID = "health";

function healthDocument(uid) {
  return doc(db, "users", uid, "appState", HEALTH_DOC_ID);
}

export async function loadHealthState(uid) {
  const snapshot = await getDoc(healthDocument(uid));

  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveHealthState(uid, healthState) {
  await setDoc(
    healthDocument(uid),
    {
      ...healthState,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
