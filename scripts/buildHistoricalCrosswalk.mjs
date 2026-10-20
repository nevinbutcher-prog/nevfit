import fs from "node:fs";
import catalogue from "../src/data/nevfitExerciseCatalogue.v1.json" with { type: "json" };
import original from "../evaluation/nevfitLegacyExerciseCrosswalk.v1.json" with { type: "json" };

// Reviewed against recorded names, WGER snapshot equipment and the existing
// Nevfit catalogue. This script accepts only the private local preflight
// summary; the output contains aggregate names and counts, never document IDs.
const specs = [
  [20, "B", "arnold-press", "Dumbbell Arnold press is identified by the recorded name and WGER equipment."],
  [48, "C", "reverse-barbell-wrist-curl", "Routine has no recorded name; confirm the WGER reverse barbell wrist curl was intended."],
  [75, "C", "flat-dumbbell-bench-press", "Dumbbell bench press is recorded without an angle; confirm flat versus incline or decline."],
  [91, "B", "standing-barbell-curl", "Recorded barbell biceps curl and WGER barbell equipment align."],
  [129, "C", "incline-chest-press-machine", "One WGER ID has incline machine and generic chest press labels; split by actual movement."],
  [172, "B", "abdominal-crunch-machine", "Machine crunch movement matches the recorded name."],
  [184, "C", "conventional-barbell-deadlift", "Barbell deadlift is clear, but conventional versus another stance is unrecorded."],
  [202, "B", "concentration-curl", "Dumbbell concentration curl movement and equipment align."],
  [222, "B", "cable-face-pull", "Recorded face pull and WGER cable equipment align; anatomical category differences do not change the movement."],
  [237, "C", "standing-cable-chest-fly", "Cable fly path and angle are unrecorded; Nevfit has several variants."],
  [238, "C", "dumbbell-chest-fly", "Dumbbell fly angle is unrecorded; confirm standard flat fly."],
  [265, "D", null, "Generic glute bridge lacks a matching unweighted Nevfit identity; weighted and single-leg variants differ."],
  [272, "B", "hammer-curl", "WGER specifies dumbbells and the recorded hammer curl has no conflicting variant."],
  [348, "B", "dumbbell-lateral-raise", "WGER specifies dumbbells and the recorded lateral raise has no conflicting variant."],
  [354, "C", "underhand-lat-pulldown", "Generic lat pulldown does not establish the underhand grip; do not borrow the preferred reference."],
  [364, "A", "seated-leg-curl", "User confirmed all historical workouts were seated leg curls; saved routine reference uses the same source identity."],
  [369, "B", "leg-extension-machine", "Recorded leg extension and WGER identity match the machine movement."],
  [371, "C", "horizontal-leg-press", "Generic leg press does not distinguish horizontal, 45-degree or another machine."],
  [465, "B", "preacher-ez-bar-curl", "WGER SZ-bar equipment and recorded preacher curl match the EZ-bar variant."],
  [537, "B", "incline-dumbbell-bench-press", "Incline bench and dumbbell equipment are explicit."],
  [538, "B", "incline-barbell-bench-press", "Incline bench and barbell equipment are explicit."],
  [543, "C", "seated-shoulder-press-machine", "Machine press is clear but seated posture is unrecorded."],
  [567, "C", "seated-dumbbell-shoulder-press", "Dumbbell press is clear but seated versus standing is unrecorded."],
  [572, "B", "dumbbell-shrug", "Recorded shrug and WGER dumbbell equipment align."],
  [584, "B", "preacher-dumbbell-curl", "Single-arm preacher curl and WGER dumbbell equipment align."],
  [627, "B", "stiff-leg-deadlift", "Stiff-legged deadlift is explicitly recorded with barbell equipment."],
  [684, "B", "underhand-lat-pulldown", "Recorded underhand grip distinguishes this from generic wger-354."],
  [687, "C", "standing-barbell-overhead-press", "WGER identifies barbell but seated versus standing is unrecorded."],
  [702, "B", "single-leg-calf-raise", "Single-leg calf raise and unweighted WGER setup align."],
  [805, "C", "cable-triceps-pushdown-straight-bar", "Cable pushdown attachment is unrecorded; straight bar and rope must stay separate."],
  [926, "B", "pec-deck-fly", "Machine chest fly matches pec deck movement."],
  [1109, "C", "seated-biceps-curl-machine", "Recorded concentration curl machine conflicts with WGER cable concentration curl; verify equipment and movement."],
  [1117, "C", "close-grip-seated-cable-row", "Recorded seated cable row is not the old proposed seated row machine; grip is unrecorded."],
  [1185, "C", "cable-triceps-pushdown-straight-bar", "Cable pushdown attachment is unrecorded."],
  [1277, "B", "incline-dumbbell-bench-press", "Recorded incline dumbbell press is explicit despite missing WGER snapshot entry."],
  [1283, "B", "incline-bench-dumbbell-row", "Recorded incline chest-supported dumbbell row aligns with incline bench row."],
  [1370, "C", "dumbbell-romanian-deadlift", "Dumbbell deadlift is explicit but Romanian versus conventional hinge range is not."],
  [1372, "C", "seated-dip-machine", "Triceps dips do not establish use of a seated dip machine rather than parallel bars."],
  [1378, "C", "dual-cable-lateral-raise", "Cable lateral raise is clear, but single-arm versus dual cable is unrecorded."],
  [1381, "C", "rear-delt-row-machine", "Upper Back is too broad to establish rear-delt row machine."],
  [1424, "C", "seated-biceps-curl-machine", "Generic biceps curl machine does not establish seated machine configuration."],
  [1444, "C", "incline-dumbbell-bench-press", "Two records identify incline dumbbell press; four say Unknown exercise and must be excluded pending clarification."],
  [1466, "D", null, "Hack-squat-machine calf raise has no exact Nevfit identity; standing calf machine is different equipment."],
  [1470, "B", "single-arm-cable-lat-pulldown", "One-arm cable lat pulldown is explicit; half-kneeling setup can remain in the historical name."],
  [1486, "C", "cable-high-row", "Alternating high cable row may differ from the standard bilateral high row."],
  [1513, "B", "overhead-cable-triceps-extension", "Overhead cable triceps extension movement and equipment align."],
  [1519, "D", null, "Overhead EZ-bar triceps extension lacks a corresponding Nevfit identity; cable and dumbbell versions differ."],
  [1530, "D", null, "Lying dumbbell curl has no corresponding Nevfit identity; incline curl changes the movement setup."],
  [1551, "B", "push-up", "Recorded and WGER bodyweight push-up align."],
  [1567, "C", "hammer-curl", "Alternating dumbbell hammer curl lacks an explicit alternating Nevfit variant; confirm shared progression."],
  [1651, "B", "dumbbell-reverse-lunge", "Rear lunge and reverse lunge name the same dumbbell step direction."],
  [1652, "B", "dumbbell-romanian-deadlift", "Recorded Romanian deadlift and dumbbell equipment align."],
  [1654, "C", "lateral-raise-machine", "Recorded machine lateral raise conflicts with WGER gym-mat equipment metadata."],
  [1694, "B", "seated-chest-press-machine", "Flat machine chest press aligns with the seated chest press machine; verify machine style before approval."],
  [1726, "B", "straight-arm-cable-pulldown", "Straight-arm pulldown and WGER cable equipment align."],
  [1748, "B", "hip-abduction-machine", "Recorded machine hip abduction aligns with the general machine identity."],
  [1772, "B", "reverse-crunch", "Recorded and WGER bodyweight reverse crunch align."],
  [1801, "B", "barbell-back-squat", "Barbell full squat aligns with the general barbell back squat identity."],
  [1828, "D", null, "Abdominal draw-in has no corresponding Nevfit identity."],
  [1830, "D", null, "Barbell step-back lunge has no corresponding Nevfit identity; dumbbell reverse lunge differs."],
  [1893, "C", "standing-barbell-overhead-press", "Barbell overhead press is explicit, but standing versus seated is unrecorded."],
  [1900, "B", "rope-triceps-pushdown", "Recorded rope pushdown and WGER cable equipment align."],
  [1929, "C", "assisted-pull-up", "WGER specifies band assistance; verify Nevfit assisted pull-up should share this progression."],
  [1972, "B", "single-arm-cable-lat-pulldown", "Single-arm lat pulldown and WGER cable equipment align."],
  [2503, "C", "cable-face-pull", "Recorded Face Pulls lacks WGER snapshot metadata; confirm cable setup before merging with wger-222."],
  [2614, "C", "hip-adduction-machine", "Recorded Adductor Machine conflicts with WGER bodyweight Adductor Rock Backs identity."],
  [2627, "B", "seated-chest-press-machine", "Recorded machine chest press matches seated machine movement without an incline label."],
  [2659, "B", "alternating-dumbbell-curl", "Recorded alternating dumbbell curl and WGER equipment align."],
];

const input = process.argv[2];
if (!input || !input.endsWith(".local")) throw new Error("Pass the private gitignored preflight summary .local path.");
const summary = JSON.parse(fs.readFileSync(input, "utf8"));
const prior = new Map(original.relationships.map((item) => [item.historicalWgerId, item]));
const allowed = new Set(catalogue.entries.map((item) => item.id));
const indexed = new Map(specs.map(([id, reviewClass, slug, reviewReason]) => [`wger-${id}`, { reviewClass, nevfitId: slug ? `nevfit-${slug}` : null, reviewReason }]));
if (indexed.size !== specs.length || indexed.size !== summary.groups.length || summary.groups.some((item) => !indexed.has(item.historicalWgerId)))
  throw new Error("Reviewed specifications must cover every observed historical ID exactly once.");
const relationships = summary.groups.map((group) => {
  const spec = indexed.get(group.historicalWgerId);
  if (spec.nevfitId && !allowed.has(spec.nevfitId)) throw new Error(`Unknown Nevfit target: ${spec.nevfitId}`);
  return {
    historicalWgerId: group.historicalWgerId,
    nevfitId: spec.nevfitId,
    reviewClass: spec.reviewClass,
    mappingConfidence: { A: "user_confirmed", B: "strong_proposed", C: "requires_clarification", D: "no_safe_match" }[spec.reviewClass],
    historicalRecordedNames: group.recordedNames.filter(({ name }) => name).map(({ name }) => name),
    historicalNameMissingReferences: group.recordedNames.find(({ name }) => !name)?.count ?? 0,
    evidence: { wgerSnapshotName: group.historicalWger?.name ?? null, wgerSnapshotEquipment: group.historicalWger?.equipment ?? [], priorCrosswalkTarget: prior.get(group.historicalWgerId)?.nevfitId ?? null },
    provenance: { source: "private_2026_10_20_preflight_aggregate", reviewVersion: 2, priorCrosswalk: prior.has(group.historicalWgerId) },
    reviewReason: spec.reviewReason,
    ...(spec.reviewClass === "A" ? { userConfirmation: { confirmed: true, scope: ["completedWorkout", "program"], reason: "User confirmed all wger-364 workouts used seated leg curl; same identity is saved in a routine. Identity decision only; no live migration authorisation." } } : {}),
  };
});
// Preserve the one older candidate not observed in this account's preflight.
const unobserved = original.relationships.filter((item) => !indexed.has(item.historicalWgerId));
if (unobserved.length !== 1 || unobserved[0].historicalWgerId !== "wger-1012") throw new Error("Unexpected unobserved foundation relationship.");
relationships.push({ historicalWgerId: "wger-1012", nevfitId: unobserved[0].nevfitId, reviewClass: "C", mappingConfidence: "requires_clarification", historicalRecordedNames: [], historicalNameMissingReferences: 0, evidence: { wgerSnapshotName: null, wgerSnapshotEquipment: [], priorCrosswalkTarget: unobserved[0].nevfitId }, provenance: { source: "original_crosswalk_only", reviewVersion: 2, priorCrosswalk: true }, reviewReason: "Foundation crosswalk identity is not observed in this account's preflight; retain without migration approval." });
relationships.sort((a, b) => Number(a.historicalWgerId.slice(5)) - Number(b.historicalWgerId.slice(5)));
fs.writeFileSync("evaluation/nevfitHistoricalCrosswalk.v2.json", JSON.stringify({ crosswalkVersion: 2, activationStatus: "review_only", observedHistoricalIds: summary.groups.length, relationships }, null, 2) + "\n");
console.log(`Reviewed ${summary.groups.length} observed IDs; retained ${unobserved.length} unobserved older relationship.`);
