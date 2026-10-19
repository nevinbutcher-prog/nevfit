import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const input = JSON.parse(readFileSync("evaluation/exercise-catalogue-mapping.json", "utf8"));
const review = JSON.parse(readFileSync("evaluation/exercise-metadata-review.json", "utf8"));
const taxonomy = JSON.parse(readFileSync("src/data/nevfitMuscleTaxonomy.v1.json", "utf8"));
const snapshot = JSON.parse(readFileSync("functions/src/rob/robExerciseCatalogue.v2.json", "utf8"));
const registryPath = "src/data/nevfitExerciseIdentityRegistry.v1.json";
const cataloguePath = "src/data/nevfitExerciseCatalogue.v1.json";
const crosswalkPath = "evaluation/nevfitLegacyExerciseCrosswalk.v1.json";
const validMuscles = new Set(taxonomy.muscles.map((item) => item.id));
const wger = new Map(snapshot.exercises.map((item) => [item.id, item]));
const historicalReview = new Map(review.records.map((item) => [item.id, item]));

function slug(name) { return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function unique(items) { return [...new Set(items)]; }
function seedRegistry() {
  if (existsSync(registryPath)) throw new Error("Identity registry already exists; edit it explicitly for additions or renamed sources");
  const entries = input.exercises.map((entry) => ({
    id: `nevfit-${slug(entry.displayName === "Preacher Dumbbell Curl Curl" ? "Preacher Dumbbell Curl" : entry.displayName)}`,
    sourceNameAtAssignment: entry.displayName,
    sourceName: entry.displayName,
  }));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Slug collision; assign distinct IDs manually");
  writeFileSync(registryPath, JSON.stringify({ registryVersion: 1, policy: "IDs are assigned once. Rename display names without changing IDs; add new entries explicitly.", entries }, null, 2) + "\n");
}
if (process.argv.includes("--seed-registry")) seedRegistry();
if (!existsSync(registryPath)) throw new Error("Missing committed identity registry; run --seed-registry once for the initial import");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const bySourceName = new Map(registry.entries.map((entry) => [entry.sourceName ?? entry.sourceNameAtAssignment, entry]));
if (bySourceName.size !== registry.entries.length || new Set(registry.entries.map((entry) => entry.id)).size !== registry.entries.length) throw new Error("Duplicate registry source names or IDs");

// Reconcile the committed row-level mapping with the supplied workbook. Row
// numbers are provenance only; registry IDs are looked up by assigned source name.
const workbookRaw = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", "scripts/readExerciseMaster.ps1", "-Json"], { encoding: "utf8", maxBuffer: 8_000_000 });
const workbook = JSON.parse(workbookRaw.replace(/^\uFEFF/, ""));
const sourceRows = workbook.find((sheet) => sheet.sheet === "Exercise Master")?.rows.slice(1) ?? [];
if (sourceRows.length !== input.exercises.length || sourceRows.some((row, index) => {
  const entry = input.exercises[index];
  const cell = (column) => String(row.cells[`${column}${row.row}`] ?? "").trim();
  const secondary = cell("D") === "—" ? null : cell("D") || null;
  return row.row !== entry.sourceRow || cell("A") !== entry.primaryBrowseGroup || cell("B") !== entry.equipment || cell("C") !== entry.displayName || secondary !== entry.secondaryMusclesProposed || (cell("F") || null) !== entry.historicalWgerId || (cell("G") || null) !== entry.preferredWgerIdRaw;
})) throw new Error("Workbook and checkpoint 048 mapping differ");

const browsePrimary = new Map([
  ["Back — Lats", ["lats"]], ["Back — Spinal erectors", ["spinal_erectors"]], ["Back — Upper/mid back", ["upper_mid_back"]],
  ["Biceps", ["biceps"]], ["Calves", ["calves"]], ["Chest", ["chest"]], ["Core — Abs", ["abdominals"]], ["Core — Obliques", ["obliques"]],
  ["Forearms / Grip", ["forearms"]], ["Glutes", ["glutes"]], ["Hamstrings", ["hamstrings"]], ["Quadriceps", ["quadriceps"]],
  ["Shoulders — Front delts", ["front_deltoids"]], ["Shoulders — Rear delts", ["rear_deltoids"]], ["Shoulders — Side delts", ["side_deltoids"]], ["Triceps", ["triceps"]],
]);
const secondaryTerms = new Map(Object.entries({
  "adductors": ["hip_adductors"], "anterior deltoids": ["front_deltoids"], "biceps": ["biceps"], "brachialis": ["brachialis"], "brachioradialis": ["brachioradialis"],
  "calves (gastrocnemius)": ["calves", "gastrocnemius"], "chest": ["chest"], "core": ["core_unspecified"], "forearm extensors": ["forearms", "forearm_extensors"],
  "forearm flexors": ["forearms", "forearm_flexors"], "forearm rotators": ["forearms", "forearm_rotators"], "glutes": ["glutes"],
  "gluteus medius/minimus": ["hip_abductors", "gluteus_medius_minimus"], "grip": ["forearms"], "hamstrings": ["hamstrings"], "hip flexors": ["hip_flexors"],
  "lats": ["lats"], "lateral deltoids": ["side_deltoids"], "lower trapezius": ["upper_mid_back", "lower_trapezius"], "mid back": ["upper_mid_back"],
  "mid trapezius": ["upper_mid_back", "mid_trapezius"], "mid traps": ["upper_mid_back", "mid_trapezius"], "obliques": ["obliques"],
  "quadratus lumborum": ["quadratus_lumborum"], "quads": ["quadriceps"], "rear deltoids": ["rear_deltoids"],
  "rectus abdominis": ["abdominals", "rectus_abdominis"], "rhomboids": ["upper_mid_back", "rhomboids"], "rotator cuff": ["rotator_cuff"],
  "serratus anterior": ["serratus_anterior"], "shoulders": ["deltoids_unspecified"], "spinal erectors": ["spinal_erectors"],
  "teres major": ["teres_major"], "transverse abdominis": ["abdominals", "transverse_abdominis"], "traps": ["upper_mid_back"],
  "triceps": ["triceps"], "upper back": ["upper_mid_back"], "upper trapezius": ["upper_mid_back", "upper_trapezius"],
}));
const subdivisionIds = new Set(["forearm_flexors", "forearm_extensors", "forearm_rotators", "gastrocnemius", "soleus", "gluteus_medius_minimus", "rectus_abdominis", "transverse_abdominis", "upper_trapezius", "mid_trapezius", "lower_trapezius"]);
function classify(entry) {
  const name = entry.displayName.toLowerCase();
  let primary = browsePrimary.get(entry.primaryBrowseGroup);
  if (entry.primaryBrowseGroup === "Adductors / Abductors") primary = /abduct|lateral band|hip raise/.test(name) ? ["hip_abductors"] : /cossack/.test(name) ? ["quadriceps", "hip_adductors"] : ["hip_adductors"];
  if (entry.primaryBrowseGroup === "Glutes" && /clamshell|hip abduction/.test(name)) primary = ["hip_abductors"];
  if (entry.primaryBrowseGroup.startsWith("Core") && /side bend|woodchop|pallof|torso rotation/.test(name)) primary = ["obliques"];
  if (name === "conventional barbell deadlift") primary = ["glutes", "hamstrings"];
  if (name === "barbell good morning") primary = ["hamstrings", "spinal_erectors"];
  if (!primary) throw new Error(`Unmapped browse group for ${entry.displayName}`);
  const terms = entry.secondaryMusclesProposed ? entry.secondaryMusclesProposed.split(";").map((item) => item.trim().toLowerCase()).filter(Boolean) : [];
  const all = terms.flatMap((term) => {
    const mapped = secondaryTerms.get(term);
    if (!mapped) throw new Error(`Unmapped proposed secondary term: ${term}`);
    return mapped;
  });
  const subdivisions = unique(all.filter((id) => subdivisionIds.has(id)));
  const secondary = unique(all.filter((id) => !primary.includes(id) && !subdivisions.includes(id)));
  if (name === "conventional barbell deadlift") secondary.push("spinal_erectors");
  for (const id of [...primary, ...secondary, ...subdivisions]) if (!validMuscles.has(id)) throw new Error(`Unknown muscle ID ${id}`);
  return { primaryMuscles: primary, secondaryMuscles: secondary, subdivisions };
}
const equipmentMap = { "Barbell / EZ-bar": "barbell_ezbar", Bodyweight: "bodyweight", Cable: "cable", Dumbbell: "dumbbell", Machine: "machine" };
function equipmentFor(entry) {
  if (entry.displayName === "Lateral Band Walk") return { category: "band", accessoryEquipment: [], discrepancy: "Master lists Bodyweight; movement names a band." };
  if (entry.displayName === "Stability Ball Leg Curl") return { category: "stability_ball", accessoryEquipment: [], discrepancy: "Master lists Bodyweight; movement names a stability ball." };
  if (entry.displayName === "Ab Wheel Rollout") return { category: "ab_wheel", accessoryEquipment: [], discrepancy: "Master lists Bodyweight; movement names an ab wheel." };
  const accessoryEquipment = [];
  if (/pull-up|chin-up|dead hang|towel hang/i.test(entry.displayName)) accessoryEquipment.push("pull_up_bar");
  if (entry.displayName === "Assisted Pull-up") accessoryEquipment.push("resistance_band");
  return { category: equipmentMap[entry.equipment], accessoryEquipment, discrepancy: null };
}
function movementPattern(name) {
  const n = name.toLowerCase();
  if (/hip adduct|copenhagen/.test(n)) return "hip_adduction";
  if (/hip abduct|lateral band walk|clamshell|side-lying hip raise/.test(n)) return "hip_abduction";
  if (/calf raise|calf press/.test(n)) return "calf_raise";
  if (/leg curl|hamstring curl|nordic hamstring/.test(n)) return "knee_flexion";
  if (/leg extension|reverse nordic/.test(n)) return "knee_extension";
  if (/deadlift|good morning|hip thrust|glute bridge|pull-through|back extension|superman|frog pump|glute drive/.test(n)) return /back extension|superman/.test(n) ? "back_extension" : "hinge";
  if (/glute kickback/.test(n)) return "hip_extension";
  if (/squat|lunge|step-up|leg press|cossack/.test(n)) return "squat_lunge";
  if (/pull-up|chin-up|pulldown/.test(n)) return "vertical_pull";
  if (/pullover/.test(n)) return "shoulder_extension";
  if (/row|shrug|scapular retraction|face pull/.test(n)) return "horizontal_pull";
  if (/triceps|skull crusher|jm press|pushdown|overhead extension/.test(n)) return "elbow_extension";
  if (/curl|biceps/.test(n)) return "elbow_flexion";
  if (/chest fly|pec deck|cable fly|dumbbell fly/.test(n)) return "chest_fly";
  if (/reverse fly|rear delt fly|rear delt raise/.test(n)) return "rear_delt_fly";
  if (/shoulder press|overhead press|arnold press|handstand push-up|pike push-up/.test(n)) return "vertical_push";
  if (/bench press|chest press|push-up|dip|floor press|decline dumbbell press|smith machine incline press/.test(n)) return "horizontal_push";
  if (/lateral raise|front raise/.test(n)) return "shoulder_raise";
  if (/pallof/.test(n)) return "core_anti_rotation";
  if (/plank|dead bug|ab wheel|hollow body/.test(n)) return "core_anti_extension";
  if (/twist|woodchop|torso rotation/.test(n)) return "core_rotation";
  if (/crunch|leg raise|knee raise|side bend/.test(n)) return "core_flexion";
  if (/carry|hang|grip|wrist|pronation|supination/.test(n)) return "carry_grip";
  return "other";
}
function variantTags(name) {
  const rules = [
    ["single_arm", /single.arm|one.arm/i], ["single_leg", /single.leg/i], ["seated", /seated/i], ["standing", /standing/i],
    ["incline", /incline/i], ["decline", /decline/i], ["horizontal", /horizontal/i], ["neutral_grip", /neutral.grip/i],
    ["wide_grip", /wide.grip/i], ["close_grip", /close.grip/i], ["underhand", /underhand/i], ["reverse_grip", /reverse.grip/i],
    ["overhead", /overhead/i], ["chest_supported", /chest.supported/i], ["high_to_low", /high.to.low/i], ["low_to_high", /low.to.high/i],
    ["smith_machine", /smith machine/i], ["plate_loaded", /plate.loaded/i], ["assisted", /assisted/i], ["iso_lateral", /iso.lateral/i],
    ["glute_emphasis", /glute emphasis/i], ["hamstring_emphasis", /hamstring emphasis/i], ["upper_back_emphasis", /upper.back emphasis/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(name)).map(([tag]) => tag);
}
const potentialDuplicates = new Map([
  ["Reverse Barbell Curl", "reverse_barbell_curl"], ["Barbell Reverse Curl", "reverse_barbell_curl"],
  ["Cable Face Pull", "face_pull"], ["Face Pull", "face_pull"],
  ["Dumbbell Side Bend", "dumbbell_side_bend"], ["Dumbbell Side Bend (Oblique Emphasis)", "dumbbell_side_bend"],
  ["Cable Woodchop", "cable_woodchop"], ["Cable Woodchop (High-to-low)", "cable_woodchop"], ["Cable Woodchop (Low-to-high)", "cable_woodchop"],
]);
const manualWgerRefs = new Map([
  ["Chin-up", "wger-152"], ["T-bar Row", "wger-919"], ["Inverted Row", "wger-1198"], ["Cross-body Hammer Curl", "wger-1502"],
  ["Incline Dumbbell Curl", "wger-204"], ["Seated Calf Raise Machine", "wger-2628"], ["Incline Barbell Bench Press", "wger-538"],
  ["Incline Dumbbell Bench Press", "wger-537"], ["Plank", "wger-458"], ["Pallof Press", "wger-1194"],
  ["Dumbbell Side Bend", "wger-1650"], ["Cable Wrist Curl", "wger-1771"], ["Dumbbell Farmer Carry", "wger-1116"],
  ["Reverse Nordic Curl", "wger-909"], ["Single-leg Leg Extension", "wger-71"], ["Smith Machine Squat", "wger-1747"],
  ["Cable Reverse Fly", "wger-1936"], ["Bent-over Dumbbell Reverse Fly", "wger-2643"], ["Incline Bench Rear Delt Fly", "wger-828"],
  ["Rope Triceps Pushdown", "wger-1900"], ["Dumbbell Triceps Kickback", "wger-655"],
]);
const chosenWgerIds = new Set();
const entries = input.exercises.map((entry) => {
  const registered = bySourceName.get(entry.displayName);
  if (!registered) throw new Error(`Unregistered source name: ${entry.displayName}`);
  const classified = classify(entry);
  const equipment = equipmentFor(entry);
  if (!equipment.category || !taxonomy.equipmentCategories.includes(equipment.category)) throw new Error(`Invalid equipment for ${entry.displayName}`);
  const pattern = movementPattern(entry.displayName);
  if (!taxonomy.movementPatterns.includes(pattern)) throw new Error(`Invalid movement pattern ${pattern}`);
  const reviewed = entry.historicalWgerId ? historicalReview.get(entry.historicalWgerId) : null;
  const automatic = !entry.historicalWgerId && entry.matchStatus === "strong_candidate" ? entry.suggestedWgerId : null;
  const selectedWgerId = manualWgerRefs.get(entry.displayName) ?? automatic;
  if (manualWgerRefs.has(entry.displayName) && entry.suggestedWgerId !== selectedWgerId) throw new Error(`Manual reference differs from candidate for ${entry.displayName}`);
  if (selectedWgerId && (!wger.has(selectedWgerId) || chosenWgerIds.has(selectedWgerId))) throw new Error(`Missing or shared selected WGER ID ${selectedWgerId}`);
  if (selectedWgerId) chosenWgerIds.add(selectedWgerId);
  const ambiguity = unique([
    ...entry.discrepancies,
    ...(entry.sourceReviewStatus.includes("Needs") ? ["anatomy_or_variant_review"] : []),
    ...(entry.sourceNotes ? [entry.sourceNotes] : []),
    ...(equipment.discrepancy ? [equipment.discrepancy] : []),
    ...(potentialDuplicates.has(entry.displayName) ? ["possible_duplicate_or_alias_review"] : []),
    ...(entry.displayName === "Preacher Dumbbell Curl Curl" ? ["source_name_typo_corrected"] : []),
  ]);
  return {
    id: registered.id,
    displayName: entry.displayName === "Preacher Dumbbell Curl Curl" ? "Preacher Dumbbell Curl" : entry.displayName,
    aliases: entry.displayName === "Preacher Dumbbell Curl Curl" ? [entry.displayName] : /Romanian Deadlift/.test(entry.displayName) ? [entry.displayName.replace("Romanian Deadlift", "RDL")] : [],
    browseGroup: entry.primaryBrowseGroup,
    ...classified,
    equipmentCategory: equipment.category,
    accessoryEquipment: equipment.accessoryEquipment,
    movementPattern: pattern,
    variantTags: variantTags(entry.displayName),
    possibleDuplicateGroup: potentialDuplicates.get(entry.displayName) ?? null,
    metadata: {
      status: reviewed?.reviewStatus === "partial_activation" ? "partially_reviewed" : "provisional",
      confidence: reviewed?.reviewStatus === "partial_activation" && !ambiguity.length ? "medium" : "low",
      ambiguities: ambiguity,
      provenance: { source: "user_master_spreadsheet", sourceRow: entry.sourceRow, classification: "spreadsheet_proposal_plus_conservative_nevfit_normalisation", reviewedFields: reviewed?.activatedFields ?? [] },
    },
    externalReferences: {
      wger: selectedWgerId ? { id: selectedWgerId, confidence: "medium", provenance: automatic ? "checkpoint_048_strong_candidate" : "checkpoint_050_manual_snapshot_review" } : null,
      candidateWgerId: entry.suggestedWgerId && !selectedWgerId ? entry.suggestedWgerId : null,
    },
  };
});
if (entries.length < 247 || registry.entries.length !== entries.length || new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Catalogue must retain the initial 247 entries and match unique registry identities");
const crosswalk = input.exercises.filter((entry) => entry.historicalWgerId).map((entry) => {
  const reviewed = historicalReview.get(entry.historicalWgerId);
  if (!reviewed) throw new Error(`Missing historical review for ${entry.historicalWgerId}`);
  const ambiguityStatus = /not a |conflict|generic|unverified|does not establish|does not specify|unspecified|preferred|equipment/i.test(reviewed.reason) ? "requires_variant_review" : "unresolved_history_context";
  return {
    nevfitId: bySourceName.get(entry.displayName).id,
    historicalWgerId: entry.historicalWgerId,
    preferredWgerId: entry.preferredWgerId,
    preferredWgerIdRaw: entry.preferredWgerIdRaw,
    mappingConfidence: reviewed.confidence,
    ambiguityStatus,
    automaticHistoryAttributionAllowed: false,
    provenance: { source: "user_supplied_historical_mapping", masterRow: entry.sourceRow, reviewVersion: review.reviewVersion },
    reviewReason: reviewed.reason,
  };
});
if (crosswalk.length !== 28 || new Set(crosswalk.map((row) => row.historicalWgerId)).size !== 28) throw new Error("Historical references must remain 28 distinct IDs");
writeFileSync(cataloguePath, JSON.stringify({ catalogueVersion: 1, identityRegistryVersion: registry.registryVersion, taxonomyVersion: taxonomy.taxonomyVersion, activationStatus: "offline_only", entries }, null, 2) + "\n");
writeFileSync(crosswalkPath, JSON.stringify({ crosswalkVersion: 1, activationStatus: "offline_only", relationships: crosswalk }, null, 2) + "\n");
const statusCounts = Object.fromEntries([...new Set(entries.map((entry) => entry.metadata.status))].map((status) => [status, entries.filter((entry) => entry.metadata.status === status).length]));
console.log(JSON.stringify({ total: entries.length, historical: crosswalk.length, wgerReferences: chosenWgerIds.size, missingWgerReferences: entries.length - chosenWgerIds.size, ...statusCounts }, null, 2));
