import fs from "node:fs";

const source = JSON.parse(fs.readFileSync("src/data/nevfitExerciseCatalogue.v1.json", "utf8"));
const equipment = {
  barbell_ezbar: "barbell", bodyweight: "bodyweight", cable: "cable",
  dumbbell: "dumbbell", machine: "machine", band: "band",
  stability_ball: "stability ball", ab_wheel: "ab wheel",
};
const exercises = source.entries.map((entry) => ({
  id: entry.id, name: entry.displayName, bodyPart: entry.browseGroup,
  primaryMuscle: entry.primaryMuscles[0].replaceAll("_", " "),
  secondaryMuscles: entry.secondaryMuscles.map((item) => item.replaceAll("_", " ")),
  equipment: [equipment[entry.equipmentCategory], ...entry.accessoryEquipment.map((item) => equipment[item] ?? item)],
  movementPattern: entry.movementPattern,
}));
const target = "functions/src/rob/nevfitExerciseCatalogue.v1.json";
const output = JSON.stringify({ version: source.catalogueVersion, exercises }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== output) throw new Error("Rob Nevfit catalogue is out of sync");
} else fs.writeFileSync(target, output);
