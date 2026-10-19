import { readFileSync, writeFileSync } from "node:fs";

const mapping = JSON.parse(readFileSync("evaluation/exercise-catalogue-mapping.json", "utf8"));
const snapshot = JSON.parse(readFileSync("functions/src/rob/robExerciseCatalogue.v2.json", "utf8"));
const source = new Map(snapshot.exercises.map((entry) => [entry.id, entry]));

// Each enabled field is an explicit review decision. Omitted fields retain WGER data.
// Preferred external IDs are intentionally never used here.
const decisions = {
  "wger-1929": { reason: "Historical source specifies a resistance band; master says bodyweight. Assistance setup and secondaries need review." },
  "wger-354": { reason: "Historical WGER entry is a generic lat pulldown; underhand grip belongs to an unapproved preferred reference." },
  "wger-222": { fields: ["displayName", "equipment"], reason: "Facepull and cable equipment align; upper-back versus rear-delt emphasis and rotator-cuff involvement remain unsettled." },
  "wger-572": { fields: ["displayName", "equipment"], reason: "Dumbbell shrug identity and equipment align; WGER shoulders conflicts with the master's upper-back browse group." },
  "wger-1117": { reason: "Historical entry is a seated cable row, while the master specifies an unspecified row machine." },
  "wger-1012": { fields: ["displayName", "equipment", "primaryMuscles", "secondaryMuscles"], secondaryMuscles: ["Brachialis"], reason: "Alternating dumbbell curl, biceps and brachialis agree with snapshot; brachioradialis remains proposed only." },
  "wger-1109": { reason: "Historical entry is Cable Concentration Curl, not a seated biceps curl machine; preferred ID is unapproved." },
  "wger-1466": { reason: "Snapshot names a hack-squat-machine calf raise; master does not specify that machine style." },
  "wger-237": { reason: "Cable fly identity and chest agree, but the high-to-low cable path and anterior-delt secondary are unverified." },
  "wger-129": { reason: "Generic Chest Press snapshot does not establish incline angle or machine style; preferred ID is unapproved." },
  "wger-926": { reason: "Machine chest fly snapshot does not establish the pec-deck variant; preferred ID is unapproved." },
  "wger-2627": { reason: "Machine chest press snapshot does not establish seated setup or secondary involvement." },
  "wger-172": { fields: ["displayName", "equipment", "primaryMuscles"], reason: "Snapshot names machine crunches and abs; no secondary claim is activated." },
  "wger-1748": { fields: ["displayName", "equipment", "primaryMuscles"], reason: "Machine hip abduction and broad glute classification align; glute subdivisions remain proposed." },
  "wger-1652": { fields: ["displayName", "equipment", "primaryMuscles"], reason: "Exact dumbbell Romanian deadlift, dumbbell equipment and hamstrings agree; glutes/erectors not activated as secondary." },
  "wger-364": { fields: ["displayName", "primaryMuscles"], reason: "User's historical identity names Seated Leg Curl; WGER only confirms generic leg curl and hamstrings. Seated machine setup and calf secondary need review. Preferred wger-2626 is not substituted." },
  "wger-1651": { fields: ["displayName", "equipment"], reason: "Rear/reverse dumbbell lunge identity and equipment align; WGER glutes conflicts with master's quadriceps primary." },
  "wger-371": { reason: "Generic Leg Press snapshot does not establish horizontal machine; WGER hamstrings primary conflicts with master's quadriceps." },
  "wger-369": { fields: ["displayName", "equipment", "primaryMuscles"], reason: "Leg extension and quadriceps align; machine category is supported by the master and the ACE seated leg-extension reference." },
  "wger-20": { fields: ["displayName", "equipment", "primaryMuscles", "secondaryMuscles"], secondaryMuscles: ["Triceps"], reason: "Arnold shoulder press, dumbbell equipment, shoulders and triceps agree; anterior/lateral subdivision remains proposed." },
  "wger-543": { reason: "Machine shoulder press snapshot does not establish seated setup; deltoid subdivision needs review." },
  "wger-1381": { reason: "Historical WGER entry is generic Upper Back, insufficient for a rear-delt row machine interpretation." },
  "wger-1378": { reason: "Cable lateral raise agrees broadly, but the dual-cable variant and upper-trap secondary are unverified." },
  "wger-348": { fields: ["displayName", "equipment", "primaryMuscles"], reason: "Lateral raise, dumbbell equipment and broad shoulders agree; exact delt head and upper-trap secondary remain proposed." },
  "wger-1654": { reason: "Snapshot equipment says Gym mat despite Machine Lateral Raise name; equipment conflict requires review." },
  "wger-805": { reason: "Cable triceps pushdown agrees broadly, but straight-bar attachment is not established by WGER." },
  "wger-1513": { fields: ["displayName", "equipment", "primaryMuscles"], reason: "Overhead cable triceps extension, cable equipment and triceps agree." },
  "wger-1372": { reason: "Historical entry is generic triceps dips, not a seated dip machine; preferred ID text is unconfirmed." },
};

const historical = mapping.exercises.filter((entry) => entry.historicalWgerId);
if (historical.length !== 28 || Object.keys(decisions).length !== 28) throw new Error("Expected exactly 28 reviewed historical IDs");
const rows = historical.map((entry) => {
  const id = entry.historicalWgerId;
  const decision = decisions[id];
  const wger = source.get(id);
  if (!decision || !wger) throw new Error(`Missing review or WGER source for ${id}`);
  const fields = decision.fields ?? [];
  const record = {
    id,
    sourceRow: entry.sourceRow,
    proposedDisplayName: entry.displayName,
    proposedEquipment: entry.equipment,
    proposedPrimaryBrowseGroup: entry.primaryBrowseGroup,
    proposedSecondaryMuscles: entry.secondaryMusclesProposed,
    preferredWgerIdRaw: entry.preferredWgerIdRaw,
    historicalWgerName: wger.name,
    historicalWgerEquipment: wger.equipment,
    historicalWgerPrimaryMuscle: wger.primaryMuscle,
    historicalWgerSecondaryMuscles: wger.secondaryMuscles,
    reviewStatus: fields.length ? "partial_activation" : "review_only",
    activatedFields: fields,
    confidence: fields.length ? "medium_for_listed_fields" : "low",
    reason: decision.reason,
    provenance: ["user_master_row", "committed_wger_snapshot", ...(id === "wger-369" ? ["ace_seated_leg_extension"] : [])],
  };
  return record;
});

const fieldValue = (entry, decision, field) => {
  if (field === "displayName") return entry.displayName;
  if (field === "equipment") return [entry.equipment === "Cable" ? "Cable" : entry.equipment];
  if (field === "primaryMuscles") {
    if (entry.primaryBrowseGroup.startsWith("Shoulders")) return ["Shoulders"];
    if (entry.primaryBrowseGroup.startsWith("Core")) return ["Abs"];
    return [entry.primaryBrowseGroup];
  }
  if (field === "secondaryMuscles") return decision.secondaryMuscles;
  throw new Error(`Unknown overlay field ${field}`);
};
const entries = historical.filter((entry) => decisions[entry.historicalWgerId].fields?.length).map((entry) => {
  const id = entry.historicalWgerId;
  const decision = decisions[id];
  return {
    id,
    aliases: [],
    ...Object.fromEntries(decision.fields.map((field) => [field, fieldValue(entry, decision, field)])),
    subdivisions: [],
    reviewStatus: "partial_activation",
    confidence: "medium_for_listed_fields",
    provenance: { masterRow: entry.sourceRow, wgerSnapshotVersion: snapshot.version, reviewReason: decision.reason },
  };
});

writeFileSync("evaluation/exercise-metadata-review.json", JSON.stringify({ reviewVersion: 1, sourceMappingSchemaVersion: mapping.schemaVersion, records: rows }, null, 2) + "\n");
writeFileSync("src/data/exerciseMetadataOverlay.v1.json", JSON.stringify({ metadataVersion: 1, runtimeIdNamespace: "wger", entries }, null, 2) + "\n");
console.log(JSON.stringify({ reviewed: rows.length, activated: entries.length, excluded: rows.length - entries.length, ids: entries.map((entry) => entry.id) }, null, 2));
