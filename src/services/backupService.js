import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const BACKUP_VERSION = 1;
const COLLECTION_BATCH_LIMIT = 450;

function getDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function programDocument(uid, programId) {
  return doc(db, "users", uid, "programs", programId);
}

function completedWorkoutDocument(uid, workoutId) {
  return doc(db, "users", uid, "completedWorkouts", workoutId);
}

async function replaceCollection(uid, collectionName, items, getItemId, toDocument) {
  const collectionRef = collection(db, "users", uid, collectionName);
  const existingSnapshot = await getDocs(collectionRef);
  let batch = writeBatch(db);
  let operations = 0;

  async function commitIfNeeded(force = false) {
    if (!operations || (!force && operations < COLLECTION_BATCH_LIMIT)) {
      return;
    }

    await batch.commit();
    batch = writeBatch(db);
    operations = 0;
  }

  for (const existingDoc of existingSnapshot.docs) {
    batch.delete(existingDoc.ref);
    operations += 1;
    await commitIfNeeded();
  }

  for (const item of items) {
    const itemId = getItemId(item);
    const itemRef =
      collectionName === "programs"
        ? programDocument(uid, itemId)
        : completedWorkoutDocument(uid, itemId);

    batch.set(itemRef, toDocument(item));
    operations += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);
}

export function createBackup({
  programs,
  planning,
  activeWorkout,
  completedWorkouts,
  health,
}) {
  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    programs,
    planning,
    activeWorkout,
    completedWorkouts,
    health,
  };
}

export function exportBackupFile(backup) {
  downloadJson(`nevfit-backup-${getDateStamp()}.json`, backup);
}

export function validateBackup(value) {
  if (!isPlainObject(value)) {
    return {
      valid: false,
      message: "Backup file must contain a JSON object.",
    };
  }

  if (value.version !== BACKUP_VERSION) {
    return {
      valid: false,
      message: "Backup version is not supported.",
    };
  }

  if (typeof value.exportedAt !== "string" || !value.exportedAt.trim()) {
    return { valid: false, message: "Backup is missing export metadata." };
  }

  if (!Array.isArray(value.programs)) {
    return { valid: false, message: "Backup is missing programs." };
  }

  if (!isPlainObject(value.planning)) {
    return { valid: false, message: "Backup is missing planning data." };
  }

  if (!Object.hasOwn(value, "activeWorkout")) {
    return { valid: false, message: "Backup is missing active workout data." };
  }

  if (value.activeWorkout !== null && !isPlainObject(value.activeWorkout)) {
    return {
      valid: false,
      message: "Backup active workout data is invalid.",
    };
  }

  if (!Array.isArray(value.completedWorkouts)) {
    return {
      valid: false,
      message: "Backup is missing completed workout history.",
    };
  }

  if (!isPlainObject(value.health)) {
    return { valid: false, message: "Backup is missing health data." };
  }

  return { valid: true, message: "" };
}

export async function importBackup(uid, backup) {
  await replaceCollection(
    uid,
    "programs",
    backup.programs,
    (program) => program.id,
    (program) => ({ ...program, updatedAt: serverTimestamp() }),
  );
  await setDoc(doc(db, "users", uid, "appState", "planning"), {
    ...backup.planning,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "users", uid, "appState", "activeWorkout"), {
    activeWorkoutSession: backup.activeWorkout ?? null,
    updatedAt: serverTimestamp(),
  });
  await replaceCollection(
    uid,
    "completedWorkouts",
    backup.completedWorkouts,
    (workout) => workout.id,
    (workout) => ({ ...workout }),
  );
  await setDoc(doc(db, "users", uid, "appState", "health"), {
    ...backup.health,
    updatedAt: serverTimestamp(),
  });
}
