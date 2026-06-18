import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const ACTIVE_WORKOUT_DOC_ID = "activeWorkout";

function activeWorkoutDocument(uid) {
  return doc(db, "users", uid, "appState", ACTIVE_WORKOUT_DOC_ID);
}

export async function loadActiveWorkout(uid) {
  const snapshot = await getDoc(activeWorkoutDocument(uid));

  return snapshot.exists() ? snapshot.data().activeWorkoutSession ?? null : undefined;
}

export async function saveActiveWorkout(uid, session) {
  await setDoc(
    activeWorkoutDocument(uid),
    {
      activeWorkoutSession: session,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearActiveWorkout(uid) {
  await saveActiveWorkout(uid, null);
}
