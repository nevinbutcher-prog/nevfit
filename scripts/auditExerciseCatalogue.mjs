// Offline, read-only inventory of the committed Rob catalogue.
// Usage: node scripts/auditExerciseCatalogue.mjs
import catalogue from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };
import { readFile } from "node:fs/promises";
import { createRobExercisePlanningTaxonomy } from "../src/services/rob/robExercisePlanningTaxonomy.js";
import { buildRobExerciseCatalogue, selectRobGenerationCandidates } from "../src/services/rob/robExerciseCatalogue.js";

const rows = catalogue.exercises;
if (process.argv[2] === "--selection") {
  const requirements = { environment: "commercial_gym", equipment: ["machines", "cables", "dumbbells", "barbell", "bench", "pull_up_equipment"], priorities: ["balanced"] };
  const full = buildRobExerciseCatalogue({ requirements });
  const selected = selectRobGenerationCandidates(full, requirements);
  console.log(JSON.stringify({ eligibleAfterNameDedupe: full.entries.length, selected: selected.entries.length, selectedIdsAndNames: selected.entries.map(({ id, name }) => [id, name]) }, null, 2));
  process.exit(0);
}
const frequencies = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
if (process.argv[2] === "--prototype") {
  const prototype = JSON.parse(await readFile(new URL("../evaluation/exercise-curation-prototype.json", import.meta.url), "utf8"));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = prototype.exercises;
  if (!Array.isArray(items) || new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Prototype IDs missing or repeated");
  for (const item of items) {
    const source = byId.get(item.id);
    if (!source || source.name !== item.displayName) throw new Error(`Unmatched catalogue ID/name: ${item.id}`);
    if (!item.provenance?.primary || !item.provenance?.secondary || !item.provenance?.equipment) throw new Error(`Missing mapping provenance: ${item.id}`);
    if (!Array.isArray(item.primaryStimulus) || !Array.isArray(item.secondaryParticipation) || !Array.isArray(item.ambiguities)) throw new Error(`Invalid mapping fields: ${item.id}`);
  }
  console.log(JSON.stringify({ prototypeEntries: items.length, validCatalogueIds: items.length, confidence: frequencies(items.map((item) => item.confidence)), primaryMapped: items.filter((item) => item.primaryStimulus.length).length, secondaryMapped: items.filter((item) => item.secondaryParticipation.length).length }, null, 2));
  process.exit(0);
}
if (process.argv[2] === "--match") {
  const query = process.argv[3];
  if (!query) throw new Error("Pass a name query after --match");
  console.log(rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase())).map((row) => [row.id, row.name, row.equipment.join("/"), row.primaryMuscle, row.secondaryMuscles.join("/")].join(" | ")).join("\n"));
  process.exit(0);
}
if (process.argv[2] === "--ids") {
  const wanted = new Set(process.argv.slice(3));
  console.log(rows.filter((row) => wanted.has(row.id)).map((row) => [row.id, row.name, row.equipment.join("/"), row.primaryMuscle, row.secondaryMuscles.join("/")].join(" | ")).join("\n"));
  process.exit(0);
}
const count = (test) => rows.filter(test).length;
const groups = (key) => Object.values(Object.groupBy(rows, key)).filter((items) => items.length > 1).map((items) => items.map(({ id, name, equipment, primaryMuscle }) => ({ id, name, equipment, primaryMuscle })));
const exactName = groups((row) => row.name.toLowerCase().trim());
const taxonomy = createRobExercisePlanningTaxonomy(catalogue).profiles;
const result = {
  snapshot: catalogue.source,
  entries: rows.length,
  uniqueIds: new Set(rows.map((row) => row.id)).size,
  duplicateIds: groups((row) => row.id),
  emptyName: count((row) => !row.name?.trim()),
  nonAsciiNames: rows.filter((row) => /[^\x00-\x7f]/.test(row.name)).map(({ id, name }) => ({ id, name })),
  noEquipment: count((row) => !row.equipment?.length),
  nameSaysMachine: count((row) => /machine|leg press|leg extension|leg curl|hack squat|pec.?deck/i.test(row.name)),
  nameSaysMachineNoEquipment: count((row) => /machine|leg press|leg extension|leg curl|hack squat|pec.?deck/i.test(row.name) && !row.equipment?.length),
  equipment: frequencies(rows.flatMap((row) => row.equipment)),
  primaryMuscle: frequencies(rows.map((row) => row.primaryMuscle || "<empty>")),
  noPrimaryMuscle: count((row) => !row.primaryMuscle?.trim()),
  primarySameAsBodyPart: count((row) => row.primaryMuscle === row.bodyPart),
  bodyPart: frequencies(rows.map((row) => row.bodyPart || "<empty>")),
  noSecondary: count((row) => !row.secondaryMuscles?.length),
  secondaryMuscle: frequencies(rows.flatMap((row) => row.secondaryMuscles)),
  exactNameDuplicateGroups: exactName,
  exactNameDuplicateGroupCount: exactName.length,
  exactNameDuplicateRecordCount: exactName.reduce((sum, group) => sum + group.length, 0),
  exactFullRecordDuplicates: groups((row) => JSON.stringify([row.name.toLowerCase().trim(), row.equipment.map((x) => x.toLowerCase()).sort(), row.primaryMuscle, row.secondaryMuscles.map((x) => x.toLowerCase()).sort(), row.bodyPart])),
  exactFullRecordDuplicateGroupCount: groups((row) => JSON.stringify([row.name.toLowerCase().trim(), row.equipment.map((x) => x.toLowerCase()).sort(), row.primaryMuscle, row.secondaryMuscles.map((x) => x.toLowerCase()).sort(), row.bodyPart])).length,
  exactFullRecordDuplicateRecordCount: groups((row) => JSON.stringify([row.name.toLowerCase().trim(), row.equipment.map((x) => x.toLowerCase()).sort(), row.primaryMuscle, row.secondaryMuscles.map((x) => x.toLowerCase()).sort(), row.bodyPart])).reduce((sum, group) => sum + group.length, 0),
  taxonomy: {
    confidence: frequencies(taxonomy.map((row) => row.confidence)),
    primaryUnknown: taxonomy.filter((row) => row.primaryStimulus.status === "unknown").length,
    secondaryStatus: frequencies(taxonomy.map((row) => row.secondaryStimulus.status)),
    movementUnknown: taxonomy.filter((row) => row.movementPattern.value === "unknown").length,
    selectionIntent: frequencies(taxonomy.map((row) => row.selectionIntent.value)),
  },
};
console.log(JSON.stringify(result, null, 2));
