import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase.js";
import { validateBackup } from "./backupPayload.js";
import { createExerciseMigrationPlan } from "./exerciseIdentityMigration.js";
import { loadMigrationAccountData } from "./exerciseMigrationPreflight.js";
import { migrationDocumentUpdates } from "./exerciseMigrationDocument.js";

// Deliberately not imported by the UI or deployed as a job. A separate
// authorisation and reviewed real-account plan are required before invocation.
const marker = (uid) => doc(db, "users", uid, "appState", "exerciseIdentityMigration");
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const identity = (item) => ({ completedAt: item.completedAt, exercises: item.exercises });
const sourceFor = (account, item) => item.kind === "completedWorkout" ? account.completedWorkouts.find((value) => value.id === item.docId)
  : item.kind === "program" ? account.programs.find((value) => value.id === item.docId)
    : item.kind === "activeWorkout" ? { activeWorkoutSession: account.activeWorkout } : { notes: account.exerciseNotes };
const hasIdentity = (source, item, target) => item.kind === "exerciseNotes"
  ? Object.hasOwn(source.notes, target) : at(source, item.path) === target;
const sameCollection = (a, b, project) => a.length === b.length && a.every((item) => {
  const other = b.find((candidate) => candidate.id === item.id);
  return other && canonical(project(item)) === canonical(project(other));
});
const withoutUpdatedAt = (value) => value && Object.fromEntries(Object.entries(value).filter(([key]) => key !== "updatedAt"));
const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)))))
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");

function assertBackupMatches(backup, account, plan) {
  const validation = validateBackup(backup);
  if (!validation.valid) throw new Error(validation.message);
  const original = structuredClone(account);
  for (const item of plan.confirmed) {
    const source = sourceFor(original, item);
    if (!source) throw new Error("A migration source document is missing.");
    if (!hasIdentity(source, item, item.historicalWgerId) && !hasIdentity(source, item, item.proposedNevfitId)) throw new Error("A migration identity changed unexpectedly.");
    if (hasIdentity(source, item, item.proposedNevfitId)) {
      if (item.kind === "exerciseNotes") {
        source.notes[item.historicalWgerId] = source.notes[item.proposedNevfitId];
        delete source.notes[item.proposedNevfitId];
      } else {
        put(source, item.path, item.historicalWgerId);
        if (item.kind === "program" && Array.isArray(source.days) && Array.isArray(source.routines)) put(source, item.path.replace(/^days\./, "routines."), item.historicalWgerId);
      }
    }
  }
  if (!sameCollection(backup.completedWorkouts, original.completedWorkouts, identity)
    || !sameCollection(backup.programs, original.programs, (item) => item.days ?? item.routines)
    || canonical(backup.activeWorkout) !== canonical(original.activeWorkout)
    || canonical(backup.exerciseNotes) !== canonical(original.exerciseNotes)
    || canonical(withoutUpdatedAt(backup.planning)) !== canonical(withoutUpdatedAt(original.planning))
    || canonical(withoutUpdatedAt(backup.health)) !== canonical(withoutUpdatedAt(original.health))) {
    throw new Error("The backup differs from the current account. Export and validate a fresh backup.");
  }
}

const refFor = (uid, kind, id) => kind === "completedWorkout" ? doc(db, "users", uid, "completedWorkouts", id)
  : kind === "program" ? doc(db, "users", uid, "programs", id) : doc(db, "users", uid, "appState", id);
const at = (value, path) => path.split(".").reduce((current, key) => current?.[key], value);
const put = (value, path, next) => {
  const parts = path.split("."); const last = parts.pop();
  parts.reduce((current, key) => current[key], value)[last] = next;
};

export async function executeApprovedExerciseMigration({ uid, plan, decisions, backup, explicitApproval }) {
  if (explicitApproval !== "approved-after-real-account-review" || plan?.uid !== uid || !plan.confirmed?.length || plan.conflicts?.length)
    throw new Error("A reviewed account plan and separate migration approval are required.");
  const account = await loadMigrationAccountData(uid);
  assertBackupMatches(backup, account, plan);
  const current = createExerciseMigrationPlan({ ...account, decisions });
  const remainingExpected = plan.confirmed.filter((item) => hasIdentity(sourceFor(account, item), item, item.historicalWgerId));
  if (canonical(current.confirmed) !== canonical(remainingExpected)) throw new Error("Account identities changed since the reviewed dry run.");
  const planHash = await digest({ uid, confirmed: plan.confirmed });
  const backupHash = await digest(backup);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(marker(uid));
    const state = snapshot.data();
    if (state && state.planHash !== planHash) throw new Error("A different migration already exists for this account.");
    if (state?.status === "verified") throw new Error("This migration was already completed.");
    if (!state) transaction.set(marker(uid), { version: 1, planHash, backupHash, status: "in_progress", startedAt: new Date().toISOString() });
  });
  const groups = new Map();
  for (const item of plan.confirmed) {
    const key = `${item.kind}/${item.docId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [key, changes] of groups) {
    const [kind, id] = key.split("/");
    await runTransaction(db, async (transaction) => {
      const ref = refFor(uid, kind, id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error(`Migration document disappeared: ${key}`);
      const updates = migrationDocumentUpdates({ kind, id, document: snapshot.data(), changes, backup });
      if (updates) transaction.update(ref, updates);
    });
  }
  const after = await loadMigrationAccountData(uid);
  assertBackupMatches(backup, after, plan);
  const remaining = plan.confirmed.filter((item) => !hasIdentity(sourceFor(after, item), item, item.proposedNevfitId));
  if (remaining.length || after.completedWorkouts.length !== account.completedWorkouts.length) throw new Error("Post-migration verification failed; retain backup and resume or rollback.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(marker(uid));
    if (snapshot.data()?.planHash !== planHash) throw new Error("Migration marker changed.");
    transaction.update(marker(uid), { status: "verified", verifiedAt: new Date().toISOString() });
  });
  return { planHash, backupHash, affectedDocuments: groups.size, migratedOccurrences: plan.confirmed.length };
}

export async function getExerciseMigrationStatus(uid) {
  const snapshot = await getDoc(marker(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function rollbackApprovedExerciseMigration({ uid, plan, backup, explicitApproval }) {
  if (explicitApproval !== "approved-migration-rollback" || plan?.uid !== uid || !plan.confirmed?.length)
    throw new Error("A reviewed rollback plan and approval are required.");
  const planHash = await digest({ uid, confirmed: plan.confirmed });
  const state = await getExerciseMigrationStatus(uid);
  if (state?.planHash !== planHash || state.status === "rolled_back") throw new Error("No matching migration is available to roll back.");
  const before = await loadMigrationAccountData(uid);
  assertBackupMatches(backup, before, plan);
  const groups = new Map();
  for (const item of plan.confirmed) {
    const key = `${item.kind}/${item.docId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [key, changes] of groups) {
    const [kind, id] = key.split("/");
    await runTransaction(db, async (transaction) => {
      const ref = refFor(uid, kind, id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error(`Rollback document disappeared: ${key}`);
      const updates = migrationDocumentUpdates({ kind, id, document: snapshot.data(), changes, backup, direction: "rollback" });
      if (updates) transaction.update(ref, updates);
    });
  }
  const restored = await loadMigrationAccountData(uid);
  assertBackupMatches(backup, restored, plan);
  if (plan.confirmed.some((item) => !hasIdentity(sourceFor(restored, item), item, item.historicalWgerId)))
    throw new Error("Rollback verification failed; retain the backup and manifest.");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(marker(uid));
    if (snapshot.data()?.planHash !== planHash) throw new Error("Migration marker changed.");
    transaction.update(marker(uid), { status: "rolled_back", rolledBackAt: new Date().toISOString() });
  });
  return { planHash, restoredOccurrences: plan.confirmed.length };
}
