import { encodeFirestoreValue, decodeFirestoreValue } from "./firestoreValueCodec.js";
import { createTrainingReadinessReport } from "./trainingReadinessReport.js";

export const TRAINING_BACKUP_COLLECTIONS = Object.freeze(["programs", "completedWorkouts", "appState"]);
const coverage = {
  scope: "known_account_documents_only",
  collections: TRAINING_BACKUP_COLLECTIONS,
  includesUserDocument: true,
  exhaustiveAccountBackup: false,
  testedDestructiveRestore: false,
  cutoverAllowed: false,
  limitations: [
    "Browser SDK cannot enumerate unknown or nested subcollections.",
    "Separate server queries are not one atomic account snapshot; pause edits on all devices.",
    "Only SDK-observed values are preserved; original integer/double wire distinctions or pre-existing numeric precision loss cannot be recovered.",
    "No destructive restore or full-account recovery has been tested. This file is not a v1/v2 Settings import.",
  ],
};
const canonicalJson = (value) => JSON.stringify(value, function (key, item) {
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((field) => [field, item[field]])) : item;
});
const digest = async (value) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value))))]
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");

function validatePaths(uid, documents) {
  if (typeof uid !== "string" || !uid || uid.includes("/") || uid !== uid.trim() || !Array.isArray(documents)) throw new Error("invalid_account_scope");
  const root = `users/${uid}`;
  const seen = new Set();
  for (const entry of documents) {
    const parts = entry.path?.split("/") ?? [];
    if (seen.has(entry.path) || typeof entry.exists !== "boolean" ||
        !(entry.path === root || (parts.length === 4 && parts[0] === "users" && parts[1] === uid && TRAINING_BACKUP_COLLECTIONS.includes(parts[2]) && parts[3] && entry.exists))) {
      throw new Error("invalid_document_scope");
    }
    seen.add(entry.path);
  }
  if (!seen.has(root)) throw new Error("missing_user_document_inventory");
}
function encodeDocuments(documents) {
  return documents.map((entry) => ({ path: entry.path, exists: entry.exists,
    value: entry.exists ? encodeFirestoreValue(entry.data) : null,
  })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function fingerprintTrainingDocuments(documents) {
  return digest(encodeDocuments(documents));
}
function countsFor(documents) {
  return Object.fromEntries(["user", ...TRAINING_BACKUP_COLLECTIONS].map((kind) => [kind,
    documents.filter((entry) => entry.exists && (kind === "user" ? entry.path.split("/").length === 2 : entry.path.split("/")[2] === kind)).length,
  ]));
}
async function manifestFor(body) {
  return {
    sha256: await digest(body),
    counts: countsFor(body.documents),
    documentHashes: await Promise.all(body.documents.map(async (entry) => ({ path: entry.path, sha256: await digest(entry) }))),
  };
}

export async function verifyTrainingReadinessExport(exported, { uid, projectId, sourceDocuments, firestore } = {}) {
  const { manifest, ...body } = exported;
  if (body.format !== "nevfit-training-readiness" || body.version !== 1 || body.account?.uid !== uid ||
      !projectId || body.account.projectId !== projectId || body.account.databaseId !== "(default)" ||
      canonicalJson(body.coverage) !== canonicalJson(coverage)) throw new Error("invalid_export_identity_or_coverage");
  validatePaths(uid, body.documents);
  if (canonicalJson(manifest) !== canonicalJson(await manifestFor(body))) throw new Error("export_integrity_mismatch");
  const decoded = body.documents.map((entry) => ({ path: entry.path, exists: entry.exists,
    data: entry.exists ? decodeFirestoreValue(entry.value, firestore) : null,
  }));
  if (canonicalJson(encodeDocuments(decoded)) !== canonicalJson(body.documents)) throw new Error("typed_roundtrip_mismatch");
  if (sourceDocuments) {
    validatePaths(uid, sourceDocuments);
    if (canonicalJson(encodeDocuments(sourceDocuments)) !== canonicalJson(body.documents)) throw new Error("fetched_source_mismatch");
  }
  if (canonicalJson(createTrainingReadinessReport(uid, decoded)) !== canonicalJson(body.preflight)) throw new Error("preflight_mismatch");
  return { documentCount: body.documents.length, counts: manifest.counts, sha256: manifest.sha256,
    typedRoundTrip: true, matchesFetchedSources: Boolean(sourceDocuments) };
}

export async function createTrainingReadinessExport({ uid, projectId, capturedAt, documents }, firestore) {
  validatePaths(uid, documents);
  if (!projectId || typeof capturedAt !== "string" || !Number.isFinite(Date.parse(capturedAt))) throw new Error("invalid_capture_metadata");
  const body = {
    format: "nevfit-training-readiness", version: 1, account: { uid, projectId, databaseId: "(default)" }, capturedAt,
    coverage: structuredClone(coverage), documents: encodeDocuments(documents), preflight: createTrainingReadinessReport(uid, documents),
  };
  const exported = { ...body, manifest: await manifestFor(body) };
  // Verify the actual JSON representation, rather than only the in-memory graph.
  await verifyTrainingReadinessExport(JSON.parse(JSON.stringify(exported)), { uid, projectId, sourceDocuments: documents, firestore });
  return exported;
}

// Dependency injection keeps cancellation/read-failure checks testable without account access.
export async function captureTrainingReadiness({ uid, projectId, capturedAt, readDocuments, isCurrent, firestore }) {
  if (!isCurrent()) throw new Error("account_changed");
  const documents = await readDocuments();
  if (!isCurrent()) throw new Error("account_changed");
  const exported = await createTrainingReadinessExport({ uid, projectId, capturedAt, documents }, firestore);
  if (!isCurrent()) throw new Error("account_changed");
  return exported;
}
