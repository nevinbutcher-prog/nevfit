import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const workbook = "Nevfit_Exercise_Master_Research_Draft-NB Program.xlsx";
const raw = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", "scripts/readExerciseMaster.ps1", "-Path", workbook, "-Json"], { encoding: "utf8", maxBuffer: 8_000_000 });
const sheets = JSON.parse(raw.replace(/^\uFEFF/, ""));
const source = sheets.find((sheet) => sheet.sheet === "Exercise Master");
const snapshot = JSON.parse(readFileSync("functions/src/rob/robExerciseCatalogue.v2.json", "utf8"));
const byId = new Map(snapshot.exercises.map((entry) => [entry.id, entry]));

const synonyms = new Map(Object.entries({ dumbbells: "dumbbell", dumbell: "dumbbell", dumbells: "dumbbell", curls: "curl", raises: "raise", rows: "row", pullups: "pullup", pullup: "pullup", pulldowns: "pulldown", pull: "pull", downs: "down", tricep: "triceps", bicep: "biceps", pressdowns: "pushdown", flyes: "fly", flies: "fly", romanian: "romanian", rear: "reverse" }));
const stop = new Set(["with", "on", "the", "and", "using", "of", "for", "a"]);
const generic = new Set(["machine", "cable", "dumbbell", "barbell", "bodyweight", "seated", "standing", "single", "arm", "leg", "one", "two", "up", "down", "bench", "supported", "plate", "loaded"]);
function tokens(value) {
  return String(value ?? "").toLowerCase().replace(/pull[- ]?ups?/g, "pullup").replace(/pull[- ]?downs?/g, "pulldown").replace(/push[- ]?downs?/g, "pushdown").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((token) => token && !stop.has(token)).map((token) => synonyms.get(token) ?? token);
}
function equipmentRelation(wanted, candidate) {
  const requested = wanted.toLowerCase();
  const available = `${candidate.name} ${(candidate.equipment ?? []).join(" ")}`.toLowerCase();
  if (requested.includes("dumbbell")) return available.includes("dumbbell") ? "supported" : candidate.equipment.length ? "conflict" : "unverified";
  if (requested.includes("barbell") || requested.includes("ez-bar")) return /barbell|ez.bar/.test(available) ? "supported" : candidate.equipment.length ? "conflict" : "unverified";
  if (requested.includes("cable")) return available.includes("cable") ? "supported" : candidate.equipment.length ? "conflict" : "unverified";
  if (requested.includes("machine")) return /machine|leg press|pec deck/.test(available) ? "name_only_or_supported" : candidate.equipment.length ? "conflict" : "unverified";
  if (requested.includes("bodyweight")) return /bodyweight|pull.up bar|dip bar/.test(available) ? "supported" : candidate.equipment.length ? "unverified" : "unverified";
  return "unverified";
}
function rank(name, equipment, candidate) {
  const a = [...new Set(tokens(name))];
  const b = [...new Set(tokens(candidate.name))];
  const intersection = a.filter((token) => b.includes(token)).length;
  const overlap = intersection / Math.max(a.length, b.length, 1);
  const movementShared = a.some((token) => !generic.has(token) && b.includes(token));
  const exact = a.join(" ") === b.join(" ");
  const relation = equipmentRelation(equipment, candidate);
  const contradictoryCalfRaise = a.includes("raise") && b.includes("raise") && a.includes("calf") !== b.includes("calf");
  const score = overlap + (exact ? 0.25 : 0) + (relation === "supported" ? 0.1 : 0) - (relation === "conflict" ? 0.35 : 0) - (contradictoryCalfRaise ? 0.6 : 0);
  return { candidate, score, exact, relation, overlap, movementShared };
}
function cell(row, column) { return String(row.cells[`${column}${row.row}`] ?? "").trim(); }
function expectedPrimary(group) {
  if (group.startsWith("Back — Lats")) return ["Lats", "Back"];
  if (group.startsWith("Back —")) return ["Back", "Trapezius", "Hamstrings"];
  if (group.startsWith("Shoulders —")) return ["Shoulders"];
  if (group.startsWith("Core — Abs")) return ["Abs"];
  if (group.startsWith("Core — Obliques")) return ["Obliquus externus abdominis", "Abs"];
  return ({ Biceps: ["Biceps", "Brachialis", "Arms"], Calves: ["Calves", "Soleus"], Chest: ["Chest"], "Forearms / Grip": ["Arms", "Brachialis"], Glutes: ["Glutes"], Hamstrings: ["Hamstrings", "Glutes"], Quadriceps: ["Quads", "Legs"], Triceps: ["Triceps", "Arms"], "Adductors / Abductors": ["Glutes", "Legs"] })[group] ?? [];
}
const entries = source.rows.slice(1).map((row) => {
  const name = cell(row, "C");
  const equipment = cell(row, "B");
  const historical = cell(row, "F") || null;
  const preferredRaw = cell(row, "G") || null;
  const preferred = preferredRaw && /^wger-\d+$/.test(preferredRaw) ? preferredRaw : null;
  const ranked = snapshot.exercises.map((candidate) => rank(name, equipment, candidate)).sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  const best = ranked.find((item) => item.score >= 0.7 && item.overlap >= 0.7 && item.movementShared);
  const suggested = best ?? null;
  const alternatives = ranked.filter((item) => item.candidate.id !== suggested?.candidate.id && item.score >= 0.7 && item.overlap >= 0.7 && item.movementShared).slice(0, 3);
  const protectedExisting = Boolean(historical);
  const strong = !protectedExisting && suggested?.exact && suggested.relation === "supported" && (!expectedPrimary(cell(row, "A")).length || expectedPrimary(cell(row, "A")).includes(suggested.candidate.primaryMuscle));
  const status = protectedExisting ? "protected_existing_id" : strong ? "strong_candidate" : suggested ? "needs_review" : "no_suitable_match";
  const discrepancy = [];
  if (suggested?.relation === "conflict") discrepancy.push("equipment_conflict");
  if (suggested?.relation === "unverified" || suggested?.relation === "name_only_or_supported") discrepancy.push("equipment_not_verified_from_source");
  if (suggested && !suggested.exact) discrepancy.push("name_or_variant_differs");
  const expected = expectedPrimary(cell(row, "A"));
  if (suggested && expected.length && !expected.includes(suggested.candidate.primaryMuscle)) discrepancy.push("candidate_primary_muscle_disagrees_with_browse_group");
  if (historical && preferred && historical !== preferred) discrepancy.push("historical_and_preferred_ids_differ");
  if (preferredRaw && !preferred) discrepancy.push("preferred_id_is_unconfirmed_text");
  const historicalEntry = historical ? byId.get(historical) : null;
  if (historical && !historicalEntry) discrepancy.push("historical_id_missing_from_snapshot");
  if (preferred && !byId.has(preferred)) discrepancy.push("preferred_id_missing_from_snapshot");
  if (historical && historicalEntry && historicalEntry.name.toLowerCase() !== name.toLowerCase()) discrepancy.push("historical_source_name_differs");
  if (historicalEntry && expected.length && !expected.includes(historicalEntry.primaryMuscle)) discrepancy.push("historical_primary_muscle_disagrees_with_browse_group");
  return {
    sourceRow: row.row,
    canonicalIdentity: null,
    displayName: name,
    aliases: [],
    primaryBrowseGroup: cell(row, "A"),
    equipment,
    secondaryMusclesProposed: cell(row, "D") === "—" ? null : cell(row, "D"),
    sourceReviewStatus: cell(row, "E"),
    sourceMatchStatus: cell(row, "H"),
    sourceNotes: cell(row, "I"),
    historicalWgerId: historical,
    historicalWgerName: historicalEntry?.name ?? null,
    historicalWgerPrimaryMuscle: historicalEntry?.primaryMuscle ?? null,
    historicalWgerEquipment: historicalEntry?.equipment ?? [],
    preferredWgerId: preferred,
    preferredWgerIdRaw: preferredRaw,
    preferredWgerName: preferred ? byId.get(preferred)?.name ?? null : null,
    suggestedWgerId: suggested?.candidate.id ?? null,
    suggestedWgerName: suggested?.candidate.name ?? null,
    candidateConfidence: suggested ? strong ? "medium" : "low" : "none",
    matchStatus: status,
    matchEvidence: suggested ? `Snapshot name token overlap ${suggested.overlap.toFixed(2)}; equipment ${suggested.relation}; ${suggested.exact ? "normalised name exact" : "variant requires review"}. Heuristic only; movement not independently verified.` : "No candidate passed conservative name/equipment threshold; requires manual search.",
    alternativeCandidates: alternatives.map(({ candidate, relation }) => ({ id: candidate.id, name: candidate.name, equipmentRelation: relation })),
    candidateWgerPrimaryMuscle: suggested?.candidate.primaryMuscle ?? null,
    candidateWgerEquipment: suggested?.candidate.equipment ?? [],
    discrepancies: discrepancy,
    provenance: { master: `${workbook}:Exercise Master!${row.row}`, historicalId: historical ? "user_supplied" : null, preferredId: preferredRaw ? "user_supplied_unapproved" : null, suggestion: suggested ? "offline_name_equipment_heuristic" : null },
  };
});
const suggestedGroups = new Map();
for (const entry of entries) {
  if (entry.suggestedWgerId) suggestedGroups.set(entry.suggestedWgerId, [...(suggestedGroups.get(entry.suggestedWgerId) ?? []), entry.sourceRow]);
}
for (const entry of entries) {
  const siblings = suggestedGroups.get(entry.suggestedWgerId) ?? [];
  if (siblings.length > 1) {
    entry.discrepancies.push("suggested_id_shared_by_distinct_master_rows");
    entry.conflictingSourceRows = siblings.filter((row) => row !== entry.sourceRow);
    if (entry.matchStatus === "strong_candidate") {
      entry.matchStatus = "needs_review";
      entry.candidateConfidence = "low";
    }
  }
}
if (entries.length !== 247 || entries.filter((entry) => entry.historicalWgerId).length !== 28) throw new Error("Unexpected workbook row or historical ID count");
writeFileSync("evaluation/exercise-catalogue-mapping.json", JSON.stringify({ schemaVersion: 1, purpose: "Offline proposal; no production consumer", sourceWorkbook: workbook, wgerSnapshotVersion: snapshot.version, exercises: entries }, null, 2) + "\n");
const counts = Object.fromEntries(["protected_existing_id", "strong_candidate", "needs_review", "no_suitable_match"].map((status) => [status, entries.filter((entry) => entry.matchStatus === status).length]));
console.log(JSON.stringify({ total: entries.length, ...counts, preferred: entries.filter((entry) => entry.preferredWgerIdRaw).length, historicalMissing: entries.filter((entry) => entry.discrepancies.includes("historical_id_missing_from_snapshot")).length, preferredMissing: entries.filter((entry) => entry.discrepancies.includes("preferred_id_missing_from_snapshot")).length, equipment: Object.fromEntries([...new Set(entries.map((entry) => entry.equipment))].map((value) => [value, entries.filter((entry) => entry.equipment === value).length])), groups: Object.fromEntries([...new Set(entries.map((entry) => entry.primaryBrowseGroup))].map((value) => [value, entries.filter((entry) => entry.primaryBrowseGroup === value).length])) }, null, 2));
