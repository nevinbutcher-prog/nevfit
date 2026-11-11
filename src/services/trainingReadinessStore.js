import { collection, doc, getDocFromServer, getDocsFromServer } from "firebase/firestore";
import { auth, db, firebaseApp } from "./firebase.js";
import { captureTrainingReadiness, TRAINING_BACKUP_COLLECTIONS } from "./trainingReadinessBackup.js";

// Enumerate only known collection paths supported by current owner-only rules.
// No cache fallback, writes, collection discovery or privileged APIs.
export function exportTrainingReadiness(uid, stillMounted) {
  const isCurrent = () => auth.currentUser?.uid === uid && stillMounted();
  return captureTrainingReadiness({
    uid, projectId: firebaseApp.options.projectId, capturedAt: new Date().toISOString(), isCurrent, firestore: db,
    readDocuments: async () => {
      const [user, ...collections] = await Promise.all([
        getDocFromServer(doc(db, "users", uid)),
        ...TRAINING_BACKUP_COLLECTIONS.map((name) => getDocsFromServer(collection(db, "users", uid, name))),
      ]);
      const snapshots = [user, ...collections.flatMap((snapshot) => snapshot.docs)];
      if ([user, ...collections].some((snapshot) => snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) ||
          snapshots.some((snapshot) => snapshot.metadata.hasPendingWrites)) throw new Error("unconfirmed_server_snapshot");
      return snapshots.map((snapshot) => ({ path: snapshot.ref.path, exists: snapshot.exists(), data: snapshot.exists() ? snapshot.data() : null }));
    },
  });
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
