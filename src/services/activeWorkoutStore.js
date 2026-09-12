import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const ACTIVE_WORKOUT_DOC_ID = "activeWorkout";

function activeWorkoutPath(uid) {
  return `users/${uid}/appState/${ACTIVE_WORKOUT_DOC_ID}`;
}

function activeWorkoutDocument(uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    const error = new Error("An authenticated user ID is required for active workout sync.");
    error.code = "invalid-uid";
    throw error;
  }

  return doc(db, "users", uid, "appState", ACTIVE_WORKOUT_DOC_ID);
}

function removeUndefinedValues(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedValues);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => typeof nestedValue !== "undefined")
        .map(([key, nestedValue]) => [key, removeUndefinedValues(nestedValue)]),
    );
  }

  return value;
}

export async function loadActiveWorkout(uid) {
  const snapshot = await getDoc(activeWorkoutDocument(uid));

  return snapshot.exists() ? snapshot.data().activeWorkoutSession ?? null : undefined;
}

export async function saveActiveWorkout(uid, session) {
  const activeWorkoutSession = session
    ? removeUndefinedValues(session)
    : null;

  await setDoc(
    activeWorkoutDocument(uid),
    {
      activeWorkoutSession,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearActiveWorkout(uid) {
  await saveActiveWorkout(uid, null);
}

export function getActiveWorkoutPath(uid) {
  return activeWorkoutPath(uid);
}
