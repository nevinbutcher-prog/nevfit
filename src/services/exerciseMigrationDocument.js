const copy = (value) => structuredClone(value);
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const at = (value, path) => path.split(".").reduce((current, key) => current?.[key], value);
const put = (value, path, next) => {
  const parts = path.split("."); const last = parts.pop();
  parts.reduce((current, key) => current[key], value)[last] = next;
};
const identity = (value, change, id) => change.kind === "exerciseNotes"
  ? Object.hasOwn(value.notes, id) : at(value, change.path) === id;
const backupDocument = (backup, kind, id) => kind === "completedWorkout" ? backup.completedWorkouts.find((item) => item.id === id)
  : kind === "program" ? backup.programs.find((item) => item.id === id)
    : kind === "activeWorkout" ? backup.activeWorkout : { notes: backup.exerciseNotes };
const project = (kind, document) => kind === "completedWorkout" ? { completedAt: document.completedAt, exercises: document.exercises }
  : kind === "program" ? document.days ?? document.routines
    : kind === "activeWorkout" ? document.activeWorkoutSession ?? document
      : document.notes;

// Used inside a Firestore transaction after reading the current document.
// Compare the entire relevant array with the retained backup, allowing only
// identity substitutions already performed by an interrupted run.
export function migrationDocumentUpdates({ kind, id, document, changes, backup, direction = "forward" }) {
  if (!["completedWorkout", "program", "activeWorkout", "exerciseNotes"].includes(kind)
    || !["forward", "rollback"].includes(direction) || !Array.isArray(changes) || !changes.length
    || changes.some((item) => item.kind !== kind || item.docId !== id)
    || new Set(changes.map((item) => item.path)).size !== changes.length) throw new Error("Invalid migration document group.");
  const expected = backupDocument(backup, kind, id);
  if (!expected || !document) throw new Error(`Migration document is missing: ${kind}/${id}`);
  const original = copy(document);
  for (const change of changes) {
    if (!identity(original, change, change.proposedNevfitId)) continue;
    if (kind === "exerciseNotes") {
      if (Object.hasOwn(original.notes, change.historicalWgerId)) throw new Error("Note target collision.");
      original.notes[change.historicalWgerId] = original.notes[change.proposedNevfitId];
      delete original.notes[change.proposedNevfitId];
    } else {
      put(original, change.path, change.historicalWgerId);
      if (kind === "program" && Array.isArray(original.days) && Array.isArray(original.routines)) {
        const mirror = change.path.replace(/^days\./, "routines.");
        if (at(original, mirror) !== change.proposedNevfitId) throw new Error("Program mirror identity differs.");
        put(original, mirror, change.historicalWgerId);
      }
    }
  }
  if (canonical(project(kind, original)) !== canonical(project(kind, expected)))
    throw new Error(`Document changed since backup: ${kind}/${id}`);
  if (kind === "program" && Array.isArray(original.days) && Array.isArray(original.routines)
    && canonical(original.routines) !== canonical(expected.routines ?? expected.days))
    throw new Error(`Program routines changed since backup: ${kind}/${id}`);
  const next = copy(document);
  let changed = false;
  for (const change of changes) {
    const from = direction === "forward" ? change.historicalWgerId : change.proposedNevfitId;
    const to = direction === "forward" ? change.proposedNevfitId : change.historicalWgerId;
    if (identity(next, change, to)) continue;
    if (!identity(next, change, from)) throw new Error(`Concurrent identity change: ${kind}/${id}`);
    if (kind === "exerciseNotes") {
      if (Object.hasOwn(next.notes, to)) throw new Error("Note target collision.");
      next.notes[to] = next.notes[from];
      delete next.notes[from];
    } else {
      put(next, change.path, to);
      if (kind === "program" && Array.isArray(next.days) && Array.isArray(next.routines)) {
        const mirror = change.path.replace(/^days\./, "routines.");
        if (at(next, mirror) !== from) throw new Error("Program mirror identity differs.");
        put(next, mirror, to);
      }
    }
    changed = true;
  }
  if (!changed) return null;
  if (kind === "program") return { ...(Array.isArray(next.days) ? { days: next.days } : {}), ...(Array.isArray(next.routines) ? { routines: next.routines } : {}) };
  if (kind === "activeWorkout") return { activeWorkoutSession: next.activeWorkoutSession };
  if (kind === "exerciseNotes") return { notes: next.notes };
  return { exercises: next.exercises };
}
