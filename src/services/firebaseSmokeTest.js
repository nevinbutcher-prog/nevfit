import { db } from "./firebase";
import { collection, limit, getDocs, query } from "firebase/firestore";

export async function runFirebaseSmokeTest() {
  const testQuery = query(collection(db, "_smokeTest"), limit(1));
  const snapshot = await getDocs(testQuery);

  console.log("Firebase connected. Smoke test docs:", snapshot.size);

  return snapshot.size;
}
