import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeExerciseNotes } from "./exerciseNotes";

const storageKey = (uid) => `nevfit_exercise_notes_${uid}`;
const pendingKey = (uid) => `nevfit_exercise_notes_pending_${uid}`;
const notesDocument = (uid) => doc(db, "users", uid, "appState", "exerciseNotes");

export function loadCachedExerciseNotes(uid) {
  try {
    return normalizeExerciseNotes(JSON.parse(window.localStorage.getItem(storageKey(uid))));
  } catch {
    return {};
  }
}

export function cacheExerciseNotes(uid, notes, pending = false) {
  window.localStorage.setItem(storageKey(uid), JSON.stringify(notes));
  if (pending) {
    window.localStorage.setItem(pendingKey(uid), "true");
  } else {
    window.localStorage.removeItem(pendingKey(uid));
  }
}

export async function loadExerciseNotes(uid) {
  if (window.localStorage.getItem(pendingKey(uid)) === "true") {
    const pendingNotes = loadCachedExerciseNotes(uid);
    await saveExerciseNotes(uid, pendingNotes);
    return pendingNotes;
  }

  const snapshot = await getDoc(notesDocument(uid));
  if (snapshot.exists()) {
    const notes = normalizeExerciseNotes(snapshot.data().notes);
    cacheExerciseNotes(uid, notes);
    return notes;
  }

  const notes = loadCachedExerciseNotes(uid);
  if (Object.keys(notes).length) {
    await saveExerciseNotes(uid, notes);
  }
  return notes;
}

export async function saveExerciseNotes(uid, notes) {
  await setDoc(notesDocument(uid), {
    notes: normalizeExerciseNotes(notes),
    updatedAt: serverTimestamp(),
  });
  if (JSON.stringify(loadCachedExerciseNotes(uid)) === JSON.stringify(notes)) {
    window.localStorage.removeItem(pendingKey(uid));
  }
}
