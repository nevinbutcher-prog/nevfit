import { Bytes, DocumentReference, GeoPoint, Timestamp, VectorValue } from "firebase/firestore";

const types = { bytes: Bytes, geopoint: GeoPoint, timestamp: Timestamp, vector: VectorValue };
const plain = (value) => value !== null && typeof value === "object" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function referenceScope(firestore) {
  // DocumentReference.toJSON contains only its relative path, not database identity.
  const database = firestore.toJSON().databaseId;
  if (typeof database?.projectId !== "string" || typeof database?.database !== "string") throw new Error("unsupported_reference_scope");
  return { projectId: database.projectId, databaseId: database.database };
}

// Every value is tagged, so user maps cannot be mistaken for codec metadata.
export function encodeFirestoreValue(value) {
  if (value === null) return { type: "null" };
  if (typeof value === "string" || typeof value === "boolean") return { type: typeof value, value };
  if (typeof value === "number") {
    const encoded = Number.isNaN(value) ? "NaN" : value === Infinity ? "+Infinity" :
      value === -Infinity ? "-Infinity" : Object.is(value, -0) ? "-0" : value;
    return { type: "number", value: encoded };
  }
  for (const [type, Constructor] of Object.entries(types)) {
    if (value instanceof Constructor) return { type, value: encodeFirestoreValue(value.toJSON()) };
  }
  if (value instanceof DocumentReference) return { type: "reference", database: referenceScope(value.firestore), value: encodeFirestoreValue(value.toJSON()) };
  if (Array.isArray(value)) return { type: "array", value: value.map(encodeFirestoreValue) };
  if (plain(value)) return { type: "map", value: Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, encodeFirestoreValue(value[key])]),
  ) };
  throw new Error("unsupported_firestore_value");
}

// Reconstruct values only; there is deliberately no persistence/restore operation.
export function decodeFirestoreValue(node, firestore) {
  if (!plain(node)) throw new Error("invalid_typed_value");
  if (node.type === "null") return null;
  if (node.type === "string" && typeof node.value === "string") return node.value;
  if (node.type === "boolean" && typeof node.value === "boolean") return node.value;
  if (node.type === "number") {
    const special = { NaN: NaN, "+Infinity": Infinity, "-Infinity": -Infinity, "-0": -0 };
    if (typeof node.value === "number" && Number.isFinite(node.value)) return node.value;
    if (Object.hasOwn(special, node.value)) return special[node.value];
  }
  if (node.type === "array" && Array.isArray(node.value)) return node.value.map((entry) => decodeFirestoreValue(entry, firestore));
  if (node.type === "map" && plain(node.value)) return Object.fromEntries(
    Object.keys(node.value).sort().map((key) => [key, decodeFirestoreValue(node.value[key], firestore)]),
  );
  if (Object.hasOwn(types, node.type)) return types[node.type].fromJSON(decodeFirestoreValue(node.value, firestore));
  if (node.type === "reference" && firestore) {
    const scope = referenceScope(firestore);
    if (node.database?.projectId !== scope.projectId || node.database?.databaseId !== scope.databaseId) throw new Error("reference_scope_mismatch");
    return DocumentReference.fromJSON(firestore, decodeFirestoreValue(node.value, firestore));
  }
  throw new Error("invalid_or_unsupported_typed_value");
}

// A separate JSON projection for 066, never substituted for the typed backup.
export function projectFirestoreValue(value) {
  if (value instanceof Timestamp) return { firestoreType: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (Array.isArray(value)) return value.map(projectFirestoreValue);
  if (plain(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, projectFirestoreValue(entry)]));
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return value;
  // Unexpected typed prescription/metadata fields must be reviewed, not silently flattened.
  throw new Error("noncanonical_planner_value");
}
