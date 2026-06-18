import {
  collection,
  doc,
  getDocs,
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

export async function loadCompletedWorkouts(uid) {
  const snapshot = await getDocs(
    query(completedWorkoutsCollection(uid), orderBy("completedAt", "desc")),
  );

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
