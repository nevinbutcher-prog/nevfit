import fs from "node:fs";
import crosswalk from "../evaluation/nevfitHistoricalCrosswalk.v3.json" with { type: "json" };
import catalogue from "../src/data/nevfitExerciseCatalogue.v1.json" with { type: "json" };

const names = new Map(catalogue.entries.map((item) => [item.id, item.displayName]));
const pending = crosswalk.relationships.filter((item) => item.reviewClass === "B");
if (pending.length !== 33 || pending.some((item) => item.approvalStatus !== "pending_collective_user_approval"))
  throw new Error("Strong mapping approval set changed unexpectedly.");
const safe = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = [
  "# Checkpoint 051C — collective strong mapping approval",
  "",
  "These 33 relationships are **proposals**. None has been marked user confirmed or authorised for a production Firestore migration. Counts are historical estimates from the 2026-10-20 read-only preflight and must be refreshed before any migration.",
  "",
  "| WGER ID | Observed saved name | Proposed Nevfit ID | Workout / routine references | Evidence or caveat |",
  "| --- | --- | --- | ---: | --- |",
  ...pending.map((item) => `| ${item.historicalWgerId} | ${safe(item.historicalRecordedNames.join("; ") || "No saved name")} | ${item.nevfitId} (${safe(names.get(item.nevfitId))}) | ${item.historicalEstimate.workoutOccurrences} / ${item.historicalEstimate.routineReferences} | ${safe(item.reviewReason)} |`),
  "",
  "## Collective decision for the user",
  "",
  "After reviewing the table, the user may state: **“I approve the 33 strong proposed identity mappings above, except [list any WGER IDs to exclude].”** An excluded ID remains under its WGER identity. An individual workout or routine occurrence may also be excluded during final plan review. Approval of identity mappings does **not** authorise a production Firestore migration; that requires a separate decision after a fresh backup, preflight and independent plan review.",
  "",
  "The 29 other observed mappings were explicitly confirmed in the 051C brief. The six no-match IDs retain their WGER identities. The unobserved `wger-1012` remains unapproved and is not part of this decision.",
  "",
];
fs.writeFileSync("evaluation/nevfit-strong-mapping-approval.md", lines.join("\n"));
console.log("Wrote 33 pending strong mapping proposals.");
