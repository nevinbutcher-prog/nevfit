import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSavedWorkoutLibrary } from "../src/services/savedWorkoutModel.js";
import { planLegacyWorkoutMigration } from "../src/services/savedWorkoutMigration.js";

const exercise = (id, extra = {}) => ({
  routineExerciseId: `row-${id}`, exerciseId: `wger-${id}`, sets: 3,
  repRange: "8-12", restSeconds: 120, note: "Controlled", displayNameOverride: "My name",
  supersetGroupId: null, ...extra,
});
const routine = (id, extra = {}) => ({ id, name: id, exercises: [], ...extra });
const program = (id, days, extra = {}) => ({ id, name: id, days, ...extra });
const plan = (legacyPrograms) => planLegacyWorkoutMigration({ accountId: "synthetic-account", legacyPrograms });
const codes = (result) => result.errors.map((error) => error.code);
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("legacy multi-workout mapping preserves prescriptions, metadata, stable IDs and order without mutation", () => {
  const days = [routine("upper", { exercises: [exercise(1, { supersetGroupId: "ss-1" }), exercise(2, { sets: 4, restSeconds: 90, supersetGroupId: "ss-1" })] }), routine("lower")];
  const input = freeze([program("p", days, { routines: structuredClone(days), description: "Original", createdAt: "2026-01-01", customMetadata: { keep: true } })]);
  const before = structuredClone(input);
  const result = plan(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.target.programs[0].workoutIds, ["upper", "lower"]);
  assert.equal(result.target.programs[0].description, "Original");
  assert.deepEqual(result.target.programs[0].customMetadata, { keep: true });
  assert.equal(Object.hasOwn(result.target.programs[0], "days"), false);
  assert.equal(Object.hasOwn(result.target.programs[0], "routines"), false);
  assert.deepEqual(result.target.workouts[0], { ...days[0], programId: "p", archived: false });
  assert.deepEqual(result.summary, { sourcePrograms: 1, targetPrograms: 1, targetWorkouts: 2, archivedPrograms: 0, archivedWorkouts: 0, remappedWorkoutIds: 0, addedRowIds: 0, addedSupersetAliases: 0 });
  assert.deepEqual(plan(input), result);
  result.target.workouts[0].exercises[0].note = "Changed result";
  result.target.programs[0].customMetadata.keep = false;
  assert.deepEqual(input, before);
});

test("routines-only aliases, archived/deleted metadata, empty programs and zero-workout accounts survive", () => {
  const result = plan([
    { id: "archived", name: "Old", archived: true, deleted: true, routines: [routine("old", { archived: true }), routine("retained", { archived: false })] },
    program("empty", []),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.target.programs[0].deleted, true);
  assert.equal(result.summary.archivedPrograms, 1);
  assert.equal(result.summary.archivedWorkouts, 1);
  assert.equal(result.target.workouts[1].archived, false, "program archival does not rewrite template status");
  assert.deepEqual(result.target.programs[1].workoutIds, []);
  assert.deepEqual(plan([]).target, { version: 1, programs: [], workouts: [] });
  assert.equal(validateSavedWorkoutLibrary({ version: 1, programs: [], workouts: [] }).valid, true);
});

test("cross-program routine collisions get deterministic non-merging IDs, reserving every original ID", () => {
  const reserved = "legacy-workout:p1:shared";
  const input = [program("p1", [routine("shared"), routine(reserved)]), program("p2", [routine("shared")])];
  const result = plan(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.target.programs[0].workoutIds, [`${reserved}:2`, reserved]);
  assert.deepEqual(result.target.programs[1].workoutIds, ["legacy-workout:p2:shared"]);
  assert.equal(result.summary.remappedWorkoutIds, 2);
  assert.equal(new Set(result.target.workouts.map((workout) => workout.id)).size, 3);
  assert.deepEqual(plan(input), result);
  const invalid = plan([program("p1", [routine("shared"), routine("shared")])]);
  assert.ok(codes(invalid).includes("duplicate_routine_in_program"));
  assert.equal(invalid.target, null);
  assert.deepEqual(invalid.mappings, []);
  const escaped = plan([program("p:1", [routine("a_b")]), program("p_3a_1", [routine("a_b")])]);
  assert.equal(escaped.ok, true);
  const ids = escaped.target.workouts.map((workout) => workout.id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids.every((id) => /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)));
});

test("independent templates may be standalone, but references and single ownership must agree", () => {
  const library = { version: 1, programs: [{ id: "p", name: "P", archived: false, workoutIds: ["owned"] }], workouts: [
    { ...routine("owned"), archived: false, programId: "p" },
    { ...routine("standalone"), archived: false, programId: null, exercises: [exercise(1)] },
  ] };
  assert.equal(validateSavedWorkoutLibrary(freeze(library)).valid, true);
  const invalid = structuredClone(library);
  invalid.programs.push({ id: "other", name: "Other", archived: false, workoutIds: ["owned", "standalone", "missing", "owned"] });
  invalid.workouts.push({ ...routine("owned"), archived: false, programId: "missing-owner" });
  const result = validateSavedWorkoutLibrary(invalid);
  for (const code of ["multiple_membership", "duplicate_membership", "ownership_mismatch", "missing_workout", "duplicate_workout_id"]) assert.ok(codes(result).includes(code), code);
});

test("missing legacy row IDs and group aliases are mapped explicitly; malformed data fails closed", () => {
  const entry = exercise(1);
  delete entry.routineExerciseId;
  delete entry.supersetGroupId;
  entry.groupId = "pair";
  const result = plan([program("p", [routine("r", { exercises: [entry, exercise(2, { supersetGroupId: "pair" })] })])]);
  assert.equal(result.ok, true);
  assert.equal(result.target.workouts[0].exercises[0].routineExerciseId, "legacy-row:r:1");
  assert.equal(result.target.workouts[0].exercises[0].supersetGroupId, "pair");
  assert.equal(result.summary.addedRowIds, 1);
  assert.equal(result.summary.addedSupersetAliases, 1);
  assert.deepEqual(result.adjustments.map((entry) => entry.code), ["added_row_id", "added_superset_alias"]);
  assert.deepEqual(entry, { exerciseId: "wger-1", sets: 3, repRange: "8-12", restSeconds: 120, note: "Controlled", displayNameOverride: "My name", groupId: "pair" });
  const aliasConflict = plan([program("p", [], { routines: [routine("unexpected")] })]);
  assert.ok(codes(aliasConflict).includes("conflicting_legacy_aliases"));
  const invalid = plan([program("p", [routine("r", { exercises: [exercise(1, { exerciseId: "unknown", sets: "3" })] })])]);
  assert.equal(invalid.target, null);
  assert.ok(codes(invalid).includes("invalid_exercise_id"));
  assert.ok(codes(invalid).includes("invalid_sets"));
  assert.ok(invalid.errors.every((error) => typeof error.path === "string"));
  assert.equal(planLegacyWorkoutMigration({ legacyPrograms: [] }).ok, false);
  assert.equal(plan([{ ...program("p", []), createdAt: new Date() }]).target, null);
});

test("foundation has no persistence dependency or direct App import", () => {
  for (const file of ["savedWorkoutModel.js", "savedWorkoutMigration.js"]) {
    const source = readFileSync(new URL(`../src/services/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:from|import)\s*["'][^"']*(?:firebase|Store|backupService)/);
    assert.doesNotMatch(source, /\b(?:fetch|setDoc|writeBatch|deleteDoc|localStorage|sessionStorage)\s*[.(]/);
  }
  assert.doesNotMatch(readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), /savedWorkout(?:Model|Migration)/);
});
