import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const HEALTH_DOC_ID = "health";

function healthDocument(uid) {
  return doc(db, "users", uid, "appState", HEALTH_DOC_ID);
}

export async function loadHealthState(uid, { serverOnly = false } = {}) {
  const snapshot = await (serverOnly ? getDocFromServer(healthDocument(uid)) : getDoc(healthDocument(uid)));

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

export async function saveHealthSteps(uid, steps, { documentExists = true } = {}) {
  const update = { steps, updatedAt: serverTimestamp() };
  if (documentExists) await updateDoc(healthDocument(uid), update);
  else await setDoc(healthDocument(uid), update, { merge: true });
}
