import fs from "node:fs";
import catalogue from "../src/data/nevfitExerciseCatalogue.v1.json" with { type: "json" };
import original from "../evaluation/nevfitLegacyExerciseCrosswalk.v1.json" with { type: "json" };
import wger from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath || !outputPath.endsWith(".local"))
  throw new Error("Pass the private preflight JSON path and a gitignored .local output path.");
const plan = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!Array.isArray(plan.occurrences) || !plan.counts) throw new Error("Invalid preflight plan.");
const byWger = new Map(wger.exercises.map((item) => [item.id, item]));
const prior = new Map(original.relationships.map((item) => [item.historicalWgerId, item]));
const normal = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const groups = new Map();
for (const occurrence of plan.occurrences) {
  const id = occurrence.historicalWgerId;
  if (!/^wger-[0-9]+$/.test(id)) throw new Error("Unexpected historical WGER ID.");
  if (!groups.has(id)) groups.set(id, { historicalWgerId: id, historicalWger: byWger.get(id) ?? null, priorRelationship: prior.get(id) ?? null, names: new Map(), counts: { completedWorkout: 0, program: 0, activeWorkout: 0, exerciseNotes: 0 } });
  const group = groups.get(id);
  group.counts[occurrence.kind]++;
  const name = occurrence.recordedName ?? "";
  group.names.set(name, (group.names.get(name) ?? 0) + 1);
}
const result = [...groups.values()].map((group) => {
  const names = [...group.names].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const exactCandidates = catalogue.entries.filter((item) => [item.displayName, ...item.aliases].some((value) =>
    names.some(({ name }) => name && normal(value) === normal(name))));
  return { historicalWgerId: group.historicalWgerId, historicalWger: group.historicalWger,
    priorRelationship: group.priorRelationship, recordedNames: names, counts: group.counts,
    exactNameCandidates: exactCandidates.map((item) => ({ id: item.id, name: item.displayName, equipment: item.equipmentCategory, variantTags: item.variantTags })) };
}).sort((a, b) => Number(a.historicalWgerId.slice(5)) - Number(b.historicalWgerId.slice(5)));
fs.writeFileSync(outputPath, JSON.stringify({ baseline: plan.counts, distinctHistoricalIds: result.length, groups: result }, null, 2) + "\n");
process.stdout.write(`Grouped ${plan.occurrences.length} references into ${result.length} historical IDs. Private analysis: ${outputPath}\n`);
