import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

function reviewDocument(uid, weekStart) {
  if (!uid || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("invalid_weekly_check_in_key");
  return doc(db, "users", uid, "appState", `weeklyCheckIn-${weekStart}`);
}

export async function loadWeeklyCheckIn(uid, weekStart) {
  const snapshot = await getDocFromServer(reviewDocument(uid, weekStart));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveWeeklyCheckIn(uid, review) {
  await setDoc(reviewDocument(uid, review.weekStart), review);
}
