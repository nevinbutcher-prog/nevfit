import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase.js";
import { createExerciseMigrationPlan } from "./exerciseIdentityMigration.js";

// Reads raw account documents. No write API is imported into this module.
export async function loadMigrationAccountData(uid) {
  if (typeof uid !== "string" || !uid.trim()) throw new Error("Sign in before running the preflight.");
  const [programs, workouts, active, notes, planning, health] = await Promise.all([
    getDocs(collection(db, "users", uid, "programs")),
    getDocs(collection(db, "users", uid, "completedWorkouts")),
    getDoc(doc(db, "users", uid, "appState", "activeWorkout")),
    getDoc(doc(db, "users", uid, "appState", "exerciseNotes")),
    getDoc(doc(db, "users", uid, "appState", "planning")),
    getDoc(doc(db, "users", uid, "appState", "health")),
  ]);
  return {
    uid,
    programs: programs.docs.map((item) => ({ ...item.data(), id: item.id })),
    completedWorkouts: workouts.docs.map((item) => ({ ...item.data(), id: item.id })),
    activeWorkout: active.exists() ? active.data().activeWorkoutSession ?? null : null,
    exerciseNotes: notes.exists() ? notes.data().notes ?? {} : {},
    planning: planning.exists() ? planning.data() : null,
    health: health.exists() ? health.data() : null,
  };
}

export async function runExerciseMigrationPreflight(uid, decisions = []) {
  return createExerciseMigrationPlan({ ...(await loadMigrationAccountData(uid)), decisions });
}

export function downloadExerciseMigrationPlan(plan) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nevfit-exercise-migration-dry-run-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
