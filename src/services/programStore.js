import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  writeBatch,
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
  await setDoc(
    programDocument(uid, program.id),
    toProgramDocument(program, serverTimestamp),
    { merge: true },
  );
}

export async function savePrograms(uid, programs) {
  const batch = writeBatch(db);

  programs.forEach((program) => {
    batch.set(
      programDocument(uid, program.id),
      toProgramDocument(program, serverTimestamp),
      { merge: true },
    );
  });

  await batch.commit();
}

export async function migrateLocalProgramsToCloud(uid, localPrograms) {
  await savePrograms(uid, localPrograms);
}
