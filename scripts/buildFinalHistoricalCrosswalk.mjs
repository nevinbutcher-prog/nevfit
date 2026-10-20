import fs from "node:fs";
import foundation from "../evaluation/nevfitHistoricalCrosswalk.v2.json" with { type: "json" };
import catalogue from "../src/data/nevfitExerciseCatalogue.v1.json" with { type: "json" };

// Explicit identity decisions in checkpoint 051C. These are not permission to
// execute a Firestore migration. The 33 class B proposals stay pending.
const userConfirmed = new Map(Object.entries({
  "wger-48": "nevfit-reverse-barbell-wrist-curl",
  "wger-75": "nevfit-flat-dumbbell-bench-press",
  "wger-129": "nevfit-incline-chest-press-machine",
  "wger-184": "nevfit-conventional-barbell-deadlift",
  "wger-237": "nevfit-high-to-low-cable-fly",
  "wger-238": "nevfit-dumbbell-chest-fly",
  "wger-354": "nevfit-underhand-lat-pulldown",
  "wger-371": "nevfit-horizontal-leg-press",
  "wger-543": "nevfit-seated-shoulder-press-machine",
  "wger-567": "nevfit-seated-dumbbell-shoulder-press",
  "wger-687": "nevfit-standing-barbell-overhead-press",
  "wger-805": "nevfit-cable-triceps-pushdown-straight-bar",
  "wger-1109": "nevfit-seated-biceps-curl-machine",
  "wger-1117": "nevfit-close-grip-seated-cable-row",
  "wger-1185": "nevfit-cable-triceps-pushdown-straight-bar",
  "wger-1370": "nevfit-dumbbell-romanian-deadlift",
  "wger-1372": "nevfit-seated-dip-machine",
  "wger-1378": "nevfit-dual-cable-lateral-raise",
  "wger-1381": "nevfit-rear-delt-row-machine",
  "wger-1424": "nevfit-seated-biceps-curl-machine",
  "wger-1444": "nevfit-incline-dumbbell-bench-press",
  "wger-1486": "nevfit-cable-high-row",
  "wger-1567": "nevfit-hammer-curl",
  "wger-1654": "nevfit-lateral-raise-machine",
  "wger-1893": "nevfit-standing-barbell-overhead-press",
  "wger-1929": "nevfit-assisted-pull-up",
  "wger-2503": "nevfit-cable-face-pull",
  "wger-2614": "nevfit-hip-adduction-machine",
}));
const specificReasons = {
  "wger-129": "User confirmed both Incline Chest Press Machine and generic Chest Press names were incline machine presses.",
  "wger-1444": "User confirmed all six workouts were incline dumbbell bench presses, including four saved as Unknown exercise; preserve those names.",
  "wger-687": "User confirmed standing barbell overhead press, shared with wger-1893.",
  "wger-1893": "User confirmed standing barbell overhead press, shared with wger-687.",
  "wger-805": "User confirmed straight-bar cable pushdown, shared with wger-1185.",
  "wger-1185": "User confirmed straight-bar cable pushdown, shared with wger-805.",
  "wger-1109": "User confirmed seated biceps curl machine, shared with wger-1424 despite conflicting WGER snapshot metadata.",
  "wger-1424": "User confirmed seated biceps curl machine, shared with wger-1109.",
  "wger-1486": "User confirmed alternating high cable row should share cable high row progression.",
  "wger-1567": "User confirmed alternating hammer curl should share hammer curl progression.",
  "wger-1929": "User confirmed assisted pull-ups share the Nevfit assisted pull-up identity; preserve original assistance and performance details.",
  "wger-2614": "User confirmed Hip Adduction Machine despite conflicting WGER bodyweight rock-back metadata.",
};

const input = process.argv[2];
if (!input?.endsWith(".local")) throw new Error("Pass the gitignored historical preflight summary .local path.");
const summary = JSON.parse(fs.readFileSync(input, "utf8"));
const observed = new Map(summary.groups.map((group) => [group.historicalWgerId, group]));
const allowedTargets = new Set(catalogue.entries.map((item) => item.id));
if (userConfirmed.size !== 28 || summary.groups.length !== 68 || foundation.relationships.length !== 69) throw new Error("Unexpected historical mapping foundation.");
const relationships = foundation.relationships.map((relation) => {
  const group = observed.get(relation.historicalWgerId);
  const estimate = { sourcePreflightDate: "2026-10-20", workoutOccurrences: group?.counts.completedWorkout ?? 0, routineReferences: group?.counts.program ?? 0, activeReferences: group?.counts.activeWorkout ?? 0, noteReferences: group?.counts.exerciseNotes ?? 0 };
  const confirmedTarget = userConfirmed.get(relation.historicalWgerId);
  if (!confirmedTarget) return { ...relation, historicalEstimate: estimate,
    approvalStatus: relation.reviewClass === "A" ? "identity_confirmed_execution_pending" : relation.reviewClass === "B" ? "pending_collective_user_approval" : relation.reviewClass === "D" ? "retain_legacy_identity" : "unobserved_unapproved" };
  if (relation.reviewClass !== "C" || !group || !allowedTargets.has(confirmedTarget)) throw new Error(`Invalid new user confirmation: ${relation.historicalWgerId}`);
  const reason = specificReasons[relation.historicalWgerId] ?? `User confirmed ${relation.historicalWgerId} represents ${confirmedTarget}.`;
  return { ...relation, nevfitId: confirmedTarget, reviewClass: "A", mappingConfidence: "user_confirmed",
    approvalStatus: "identity_confirmed_execution_pending", previousReviewReason: relation.reviewReason, reviewReason: reason,
    provenance: { ...relation.provenance, source: "user_confirmed_051c_brief", reviewVersion: 3 },
    historicalEstimate: estimate,
    userConfirmation: { confirmed: true, scope: ["completedWorkout", "program"], reason: `${reason} Identity approval only; production Firestore writes require separate authorisation.` },
  };
});
if ([...userConfirmed.keys()].some((id) => !observed.has(id))) throw new Error("A user confirmation lacks a historical occurrence.");
const classCounts = relationships.filter((item) => observed.has(item.historicalWgerId)).reduce((counts, item) => ({ ...counts, [item.reviewClass]: (counts[item.reviewClass] ?? 0) + 1 }), {});
if (classCounts.A !== 29 || classCounts.B !== 33 || classCounts.D !== 6 || classCounts.C) throw new Error("Final mapping classification mismatch.");
fs.writeFileSync("evaluation/nevfitHistoricalCrosswalk.v3.json", JSON.stringify({ crosswalkVersion: 3, activationStatus: "review_only", observedHistoricalIds: 68, relationships }, null, 2) + "\n");
console.log("Final crosswalk: 29 confirmed identities, 33 pending proposals, 6 retained legacy identities, 1 unobserved older candidate.");
