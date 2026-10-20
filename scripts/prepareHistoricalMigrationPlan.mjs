import fs from "node:fs";
import { prepareExactExerciseMigration } from "../src/services/exerciseMigrationPreparation.js";

const [preflightPath, backupPath, approvalsPath, outputPath] = process.argv.slice(2);
if (!preflightPath || !backupPath || !approvalsPath?.endsWith(".local") || !outputPath?.endsWith(".local"))
  throw new Error("Usage: node scripts/prepareHistoricalMigrationPlan.mjs <fresh-preflight.json> <full-backup.json> <private-approvals.local> <private-output.local>");
if (fs.existsSync(outputPath)) throw new Error("Output already exists; retain prior plans and choose a new private filename.");
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const approvalManifest = JSON.parse(fs.readFileSync(approvalsPath, "utf8"));
const prepared = prepareExactExerciseMigration({ preflight, backup, approvalManifest });
fs.writeFileSync(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(), sourcePreflightCrosswalkVersion: preflight.crosswalkVersion,
  ...prepared,
}, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ confirmedOccurrences: prepared.review.confirmedOccurrenceCount,
  affectedDocuments: prepared.review.affectedDocumentCount,
  pendingStrongMappings: prepared.review.pendingStrongWgerIds.length,
  reviewComplete: prepared.review.reviewComplete,
  privateOutput: outputPath }, null, 2));
