import { collection, doc, getDocFromServer, getDocsFromServer } from "firebase/firestore";
import { captureTrainingReadiness, TRAINING_BACKUP_COLLECTIONS } from "./trainingReadinessBackup.js";

// No app initialization or writes: callers supply the authenticated, mounted scope.
export function captureTrainingReadinessFromFirestore({ uid, firestore, isCurrent }) {
  return captureTrainingReadiness({
    uid, projectId: firestore.app.options.projectId, capturedAt: new Date().toISOString(), isCurrent, firestore,
    readDocuments: async () => {
      const [user, ...collections] = await Promise.all([
        getDocFromServer(doc(firestore, "users", uid)),
        ...TRAINING_BACKUP_COLLECTIONS.map((name) => getDocsFromServer(collection(firestore, "users", uid, name))),
      ]);
      const snapshots = [user, ...collections.flatMap((snapshot) => snapshot.docs)];
      if ([user, ...collections].some((snapshot) => snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) ||
          snapshots.some((snapshot) => snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)) throw new Error("unconfirmed_server_snapshot");
      return snapshots.map((snapshot) => ({ path: snapshot.ref.path, exists: snapshot.exists(), data: snapshot.exists() ? snapshot.data() : null }));
    },
  });
}
