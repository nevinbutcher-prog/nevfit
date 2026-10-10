// Usage: node scripts/refreshRobCatalogue.mjs path/to/wger-exerciseinfo.json
// Deliberately offline: download/review the WGER response separately, then commit
// the generated diff and version bump with its tests. Follow it with
// `node scripts/auditRobExercisePlanningTaxonomy.mjs`; reviewed planning
// exceptions apply only when the refreshed ID and display name still agree.
import { readFile, writeFile } from "node:fs/promises";

const input = process.argv[2];
if (!input) throw new Error("Provide a captured WGER exerciseinfo JSON file.");
const payload = JSON.parse(await readFile(input, "utf8"));
const value = (item) => typeof item === "string" ? item.trim() : (item?.name_en ?? item?.name ?? "").trim();
const exercises = (payload.results ?? []).map((source) => {
  const translation = source.translations?.find((entry) => entry.language === 2);
  const name = value(translation?.name).replace(/\s*\([^)]*\)\s*$/, "");
  return name ? { id: `wger-${source.id}`, name, equipment: (source.equipment ?? []).map(value).filter(Boolean), primaryMuscle: (source.muscles ?? []).map(value).find(Boolean) ?? value(source.category) ?? "Exercise", secondaryMuscles: (source.muscles_secondary ?? []).map(value).filter(Boolean), bodyPart: value(source.category) ?? "Exercise", source: "wger" } : null;
}).filter(Boolean);
await writeFile(new URL("../functions/src/rob/robExerciseCatalogue.v2.json", import.meta.url), `${JSON.stringify({ version: 2, source: { provider: "wger", language: 2, capturedAt: new Date().toISOString().slice(0, 10), recordCount: exercises.length }, exercises }, null, 2)}\n`);
