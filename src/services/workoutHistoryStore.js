import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

function completedWorkoutsCollection(uid) {
  return collection(db, "users", uid, "completedWorkouts");
}

function completedWorkoutDocument(uid, workoutId) {
  return doc(db, "users", uid, "completedWorkouts", workoutId);
}

export async function loadCompletedWorkouts(uid, { serverOnly = false } = {}) {
  const workoutQuery = query(completedWorkoutsCollection(uid), orderBy("completedAt", "desc"));
  const snapshot = await (serverOnly ? getDocsFromServer(workoutQuery) : getDocs(workoutQuery));

  return snapshot.docs.map((workoutSnapshot) => ({
    id: workoutSnapshot.id,
    ...workoutSnapshot.data(),
  }));
}

export async function saveCompletedWorkout(uid, workout) {
  await setDoc(
    completedWorkoutDocument(uid, workout.id),
    {
      ...workout,
      syncedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
