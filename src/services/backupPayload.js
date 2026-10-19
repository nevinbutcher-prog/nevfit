import { normalizeExerciseNotes } from "./exerciseNotes.js";

const BACKUP_VERSION = 2;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createBackup({ programs, planning, activeWorkout, completedWorkouts, health, exerciseNotes }) {
  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    programs,
    planning,
    activeWorkout,
    completedWorkouts,
    health,
    exerciseNotes,
  };
}

export function validateBackup(value) {
  if (!isPlainObject(value)) return { valid: false, message: "Backup file must contain a JSON object." };
  if (value.version !== 1 && value.version !== BACKUP_VERSION) return { valid: false, message: "Backup version is not supported." };
  if (typeof value.exportedAt !== "string" || !value.exportedAt.trim()) return { valid: false, message: "Backup is missing export metadata." };
  if (!Array.isArray(value.programs)) return { valid: false, message: "Backup is missing programs." };
  if (!isPlainObject(value.planning)) return { valid: false, message: "Backup is missing planning data." };
  if (!Object.hasOwn(value, "activeWorkout")) return { valid: false, message: "Backup is missing active workout data." };
  if (value.activeWorkout !== null && !isPlainObject(value.activeWorkout)) return { valid: false, message: "Backup active workout data is invalid." };
  if (!Array.isArray(value.completedWorkouts)) return { valid: false, message: "Backup is missing completed workout history." };
  if (!isPlainObject(value.health)) return { valid: false, message: "Backup is missing health data." };
  if (value.version === 2 && (!isPlainObject(value.exerciseNotes) || Object.keys(normalizeExerciseNotes(value.exerciseNotes)).length !== Object.keys(value.exerciseNotes).length)) return { valid: false, message: "Backup exercise notes are invalid." };
  return { valid: true, message: "" };
}
