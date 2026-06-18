import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

function programsCollection(uid) {
  return collection(db, "users", uid, "programs");
}

function programDocument(uid, programId) {
  return doc(db, "users", uid, "programs", programId);
}

function serializeTimestamp(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return value;
}

export function maybeNormalizeCloudProgram(program) {
  if (!program || typeof program !== "object") {
    return null;
  }

  const routines = Array.isArray(program.routines) ? program.routines : null;
  const days = Array.isArray(program.days) ? program.days : routines;

  if (!days) {
    return null;
  }

  return {
    ...program,
    days,
    ...(typeof program.createdAt !== "undefined"
      ? { createdAt: serializeTimestamp(program.createdAt) }
      : {}),
    ...(typeof program.updatedAt !== "undefined"
      ? { updatedAt: serializeTimestamp(program.updatedAt) }
      : {}),
  };
}

function toProgramDocument(program) {
  const { days, routines, ...programFields } = program;
  const nextRoutines = Array.isArray(routines) ? routines : days;

  return {
    ...programFields,
    ...(Array.isArray(days) ? { days } : {}),
    ...(Array.isArray(nextRoutines) ? { routines: nextRoutines } : {}),
    updatedAt: serverTimestamp(),
    createdAt: program.createdAt ?? serverTimestamp(),
  };
}

export async function loadCloudPrograms(uid) {
  const snapshot = await getDocs(programsCollection(uid));

  return snapshot.docs
    .map((programSnapshot) =>
      maybeNormalizeCloudProgram({
        id: programSnapshot.id,
        ...programSnapshot.data(),
      }),
    )
    .filter(Boolean);
}

export async function saveProgram(uid, program) {
  await setDoc(programDocument(uid, program.id), toProgramDocument(program), {
    merge: true,
  });
}

export async function savePrograms(uid, programs) {
  const batch = writeBatch(db);

  programs.forEach((program) => {
    batch.set(programDocument(uid, program.id), toProgramDocument(program), {
      merge: true,
    });
  });

  await batch.commit();
}

export async function migrateLocalProgramsToCloud(uid, localPrograms) {
  await savePrograms(uid, localPrograms);
}
