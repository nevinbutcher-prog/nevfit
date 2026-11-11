import {
  collection,
  doc,
  getDocs,
  getDocFromServer,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { validateBackup as validateBackupPayload } from "./backupPayload.js";
export { createBackup, validateBackup } from "./backupPayload.js";

const COLLECTION_BATCH_LIMIT = 450;

function getDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
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
  let pending = [];
  async function commitIfNeeded(force = false) {
    if (!pending.length || (!force && pending.length < COLLECTION_BATCH_LIMIT)) return;
    const operations = pending;
    await runTransaction(db, async (transaction) => {
      const model = await transaction.get(doc(db, "users", uid, "appState", "trainingModel"));
      if (model.exists()) throw new Error("Legacy import is blocked after independent-workout activation.");
      const revisionRef = doc(db, "users", uid, "appState", "trainingLegacyRevision");
      const revision = collectionName === "programs" ? await transaction.get(revisionRef) : null;
      for (const operation of operations) {
        if (operation.remove) transaction.delete(operation.ref); else transaction.set(operation.ref, operation.data);
      }
      if (revision) transaction.set(revisionRef, { revision: (revision.exists() ? revision.data().revision : 0) + 1 });
    });
    pending = [];
  }

  for (const existingDoc of existingSnapshot.docs) {
    pending.push({ ref: existingDoc.ref, remove: true });
    await commitIfNeeded();
  }

  for (const item of items) {
    const itemId = getItemId(item);
    const itemRef =
      collectionName === "programs"
        ? programDocument(uid, itemId)
        : completedWorkoutDocument(uid, itemId);

    pending.push({ ref: itemRef, data: toDocument(item) });
    await commitIfNeeded();
  }

  await commitIfNeeded(true);
}

export function exportBackupFile(backup) {
  downloadJson(`nevfit-backup-${getDateStamp()}.json`, backup);
}

async function writeLegacyState(uid, id, value) {
  await runTransaction(db, async (transaction) => {
    const model = await transaction.get(doc(db, "users", uid, "appState", "trainingModel"));
    if (model.exists()) throw new Error("Legacy import is blocked after independent-workout activation.");
    transaction.set(doc(db, "users", uid, "appState", id), value);
  });
}

export async function importBackup(uid, backup) {
  if (!validateBackupPayload(backup).valid) throw new Error("Unsupported or invalid legacy backup.");
  if ((await getDocFromServer(doc(db, "users", uid, "appState", "trainingModel"))).exists()) throw new Error("Legacy import is blocked after independent-workout activation.");
  await replaceCollection(
    uid,
    "programs",
    backup.programs,
    (program) => program.id,
    (program) => ({ ...program, updatedAt: serverTimestamp() }),
  );
  await writeLegacyState(uid, "planning", {
    ...backup.planning,
    updatedAt: serverTimestamp(),
  });
  await writeLegacyState(uid, "activeWorkout", {
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
  await writeLegacyState(uid, "health", {
    ...backup.health,
    updatedAt: serverTimestamp(),
  });
  await writeLegacyState(uid, "exerciseNotes", {
    notes: backup.exerciseNotes ?? {},
    updatedAt: serverTimestamp(),
  });
}
