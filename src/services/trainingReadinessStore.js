import { auth, db } from "./firebase.js";
import { captureTrainingReadinessFromFirestore } from "./trainingReadinessSource.js";

// Enumerate only known collection paths supported by current owner-only rules.
// No cache fallback, writes, collection discovery or privileged APIs.
export function exportTrainingReadiness(uid, stillMounted) {
  const isCurrent = () => auth.currentUser?.uid === uid && stillMounted();
  return captureTrainingReadinessFromFirestore({ uid, firestore: db, isCurrent });
}

export function downloadTrainingReadiness(exported) {
  if (auth.currentUser?.uid !== exported.account.uid) throw new Error("account_changed");
  const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `nevfit-training-readiness-${exported.capturedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
