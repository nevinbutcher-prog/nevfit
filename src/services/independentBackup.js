import { encodeFirestoreValue } from "./firestoreValueCodec.js";

function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, omitUndefined(entry)]),
  );
  return value;
}

export function createIndependentBackup({ uid, projectId, runtime, planning, activeWorkout, completedWorkouts, health, exerciseNotes, exportedAt = new Date().toISOString() }) {
  if (runtime.mode !== "v2") throw new Error("independent_mode_required");
  return { format: "nevfit-independent-training-backup", version: 3, account: { uid, projectId }, exportedAt,
    restoreSupported: false,
    data: encodeFirestoreValue(omitUndefined({ library: runtime.library, trainingModel: runtime.marker, planning, activeWorkout, completedWorkouts, health, exerciseNotes })),
  };
}
