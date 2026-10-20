import fs from "node:fs";
import crosswalk from "../evaluation/nevfitHistoricalCrosswalk.v2.json" with { type: "json" };
import catalogue from "../src/data/nevfitExerciseCatalogue.v1.json" with { type: "json" };

const input = process.argv[2];
if (!input || !input.endsWith(".local")) throw new Error("Pass the private gitignored preflight summary .local path.");
const summary = JSON.parse(fs.readFileSync(input, "utf8"));
const reviewed = new Map(crosswalk.relationships.map((item) => [item.historicalWgerId, item]));
const names = new Map(catalogue.entries.map((item) => [item.id, item.displayName]));
const byClass = Object.fromEntries("ABCD".split("").map((value) => [value, []]));
for (const group of summary.groups) byClass[reviewed.get(group.historicalWgerId).reviewClass].push(group);
const totals = Object.fromEntries(Object.entries(byClass).map(([key, groups]) => [key, {
  ids: groups.length,
  workouts: groups.reduce((sum, item) => sum + item.counts.completedWorkout, 0),
  routines: groups.reduce((sum, item) => sum + item.counts.program, 0),
}]));
const safe = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const row = (group, detail = false) => {
  const relation = reviewed.get(group.historicalWgerId);
  const observed = group.recordedNames.filter(({ name }) => name).map(({ name }) => name).join("; ") || "No saved name (routine only)";
  const target = relation.nevfitId ? `${relation.nevfitId} (${names.get(relation.nevfitId)})` : "Retain WGER identity";
  return `| ${group.historicalWgerId} | ${safe(observed)} | ${safe(target)} | ${group.counts.completedWorkout} / ${group.counts.program} |${detail ? ` ${safe(relation.reviewReason)} |` : ""}`;
};
const lines = [
  "# Checkpoint 051B — Historical exercise identity review",
  "",
  "Source: private read-only account preflight dated 2026-10-20; Nevfit 247-exercise catalogue; committed WGER snapshot; original 28-entry crosswalk. This report contains aggregate exercise identity information only. It has no account or document identifiers or workout details.",
  "",
  "## Summary",
  "",
  "The preflight contains 60 completed workouts, 330 historical workout exercise references and 45 saved routine references. There are no active workout or note references. It contains 68 distinct WGER IDs: 27 from the original crosswalk and 41 additional IDs. The expanded crosswalk also retains `wger-1012` from the original crosswalk with zero observed references.",
  "",
  "| Class | Observed IDs | Workout references | Routine references | Treatment |",
  "| --- | ---: | ---: | ---: | --- |",
  `| A — user confirmed | ${totals.A.ids} | ${totals.A.workouts} | ${totals.A.routines} | Include in a future reviewed plan; no live write authorised. |`,
  `| B — strong proposal | ${totals.B.ids} | ${totals.B.workouts} | ${totals.B.routines} | Seek mapping approval before migration. |`,
  `| C — clarify | ${totals.C.ids} | ${totals.C.workouts} | ${totals.C.routines} | Hold until movement or equipment is resolved. |`,
  `| D — no safe match | ${totals.D.ids} | ${totals.D.workouts} | ${totals.D.routines} | Retain the historical identity. |`,
  "",
  `The confirmed plus strong proposed group covers **${totals.A.workouts + totals.B.workouts} workout and ${totals.A.routines + totals.B.routines} routine references** if all B proposals are approved and a fresh preflight still matches. Only the A relationship has prior user confirmation (${totals.A.workouts} workout and ${totals.A.routines} routine reference). C could add at most ${totals.C.workouts} workout and ${totals.C.routines} routine references after clarification; four \`wger-1444\` workouts labelled “Unknown exercise” cannot be assigned from their saved name. These are aggregate potential counts, not an approved or executed migration.`,
  "",
  "## A — user confirmed",
  "",
  "| WGER ID | Recorded names | Proposed Nevfit ID | Workouts / routines |",
  "| --- | --- | --- | ---: |",
  ...byClass.A.map((group) => row(group)),
  "",
  "The user confirmed that every historical `wger-364` workout used a seated leg curl machine. The original completed workout name remains “Leg Curl”; only its identity would change in an eventual approved migration. This confirmation is an identity mapping decision, not Firestore execution approval.",
  "",
  "## B — strong proposed matches (mapping approval pending)",
  "",
  "| WGER ID | Recorded names | Proposed Nevfit ID | Workouts / routines |",
  "| --- | --- | --- | ---: |",
  ...byClass.B.map((group) => row(group)),
  "",
  "## C — material clarification needed",
  "",
  "| WGER ID | Recorded names | Candidate Nevfit ID | Workouts / routines | Uncertainty |",
  "| --- | --- | --- | ---: | --- |",
  ...byClass.C.map((group) => row(group, true)),
  "",
  "`wger-1012` is also C in the crosswalk but has no reference in this account preflight and is excluded from these counts.",
  "",
  "## D — no safe existing Nevfit identity",
  "",
  "| WGER ID | Recorded names | Proposed treatment | Workouts / routines | Gap |",
  "| --- | --- | --- | ---: | --- |",
  ...byClass.D.map((group) => row(group, true)),
  "",
  "## Consolidated user questions",
  "",
  "1. **Press and hinge variants:** For `wger-75`, was the dumbbell bench press flat, incline or decline? For `wger-129`, were the two “Chest Press” references flat or incline, and should saved routines follow either? For `wger-184` and `wger-1370`, were these conventional barbell and Romanian dumbbell deadlifts respectively?",
  "2. **Leg press and upper-body posture:** Was `wger-371` horizontal, 45-degree or another leg press? Were `wger-543`, `wger-567`, `wger-687` and `wger-1893` seated or standing presses?",
  "3. **Cable paths and handles:** Which angles or grips were used for `wger-237`, `wger-354`, `wger-805`, `wger-1117`, `wger-1185` and `wger-1378`? In particular, keep generic lat pulldown distinct from confirmed underhand `wger-684`, and cable row distinct from a row machine.",
  "4. **Machines versus bodyweight or cable:** Were `wger-1109` and `wger-1424` seated curl machines, `wger-1372` a seated dip machine, and `wger-1381` a rear-delt row machine? The saved `wger-2614` name says “Adductor Machine” while WGER metadata says bodyweight adductor rock backs; which was performed?",
  "5. **Missing or generic history:** What exercise was performed in the four `wger-1444` workouts labelled “Unknown exercise”? Can `wger-2503` be confirmed as a cable face pull? The two `wger-1444` incline dumbbell press records can be reviewed separately. A `wger-48` saved routine has no recorded name; was it reverse barbell wrist curl?",
  "6. **Remaining variant decisions:** Was `wger-238` a standard flat dumbbell fly? Should alternating high cable row (`wger-1486`) and alternating dumbbell hammer curl (`wger-1567`) share the proposed standard identities? Was `wger-1654` a machine lateral raise despite conflicting WGER metadata? Was band-assisted `wger-1929` intended to share the Nevfit assisted pull-up progression?",
  "",
  "The D group is a catalogue gap or a movement that differs materially from available variants; it can remain visible under its WGER identity. No new catalogue entry is proposed in this checkpoint.",
  "",
  "## Review and migration boundary",
  "",
  "A fresh read-only preflight and current full backup are required before any future migration. B and resolved C relationships need explicit mapping approval; exact occurrence exclusions remain possible. The migration writer and rollback are separate controlled actions and this checkpoint does not authorise running them on the real account. User acceptance follows independent code review and verification.",
  "",
];
fs.writeFileSync("evaluation/nevfit-historical-mapping-review.md", lines.join("\n"));
console.log(`Review report written with ${summary.groups.length} observed historical IDs.`);
