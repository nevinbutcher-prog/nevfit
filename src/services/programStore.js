import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  maybeNormalizeCloudProgram,
  toProgramDocument,
} from "./programData";

export { maybeNormalizeCloudProgram } from "./programData";

function programsCollection(uid) {
  return collection(db, "users", uid, "programs");
}

function programDocument(uid, programId) {
  return doc(db, "users", uid, "programs", programId);
}

export async function loadCloudPrograms(uid) {
  const snapshot = await getDocsFromServer(programsCollection(uid));
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) throw new Error("unconfirmed_cloud_programs");

  const programs = snapshot.docs
    .map((programSnapshot) =>
      maybeNormalizeCloudProgram({
        id: programSnapshot.id,
        ...programSnapshot.data(),
      }),
    );
  if (programs.some((program) => !program)) throw new Error("invalid_cloud_programs");
  return programs;
}

export async function saveProgram(uid, program) {
  await savePrograms(uid, [program]);
}

export async function savePrograms(uid, programs) {
  await runTransaction(db, async (transaction) => {
    const model = await transaction.get(doc(db, "users", uid, "appState", "trainingModel"));
    const revisionRef = doc(db, "users", uid, "appState", "trainingLegacyRevision");
    const revision = await transaction.get(revisionRef);
    if (model.exists()) throw new Error("training_mode_changed_refresh_required");
    const previous = revision.exists() ? revision.data().revision : 0;
    if (!Number.isSafeInteger(previous) || previous < 0) throw new Error("invalid_legacy_training_revision");
    programs.forEach((program) => transaction.set(programDocument(uid, program.id), toProgramDocument(program, serverTimestamp), { merge: true }));
    transaction.set(revisionRef, { revision: previous + 1 });
  });
}

export async function migrateLocalProgramsToCloud(uid, localPrograms) {
  await savePrograms(uid, localPrograms);
}
