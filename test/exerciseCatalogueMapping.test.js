import test from "node:test";
import assert from "node:assert/strict";
import mapping from "../evaluation/exercise-catalogue-mapping.json" with { type: "json" };
import snapshot from "../functions/src/rob/robExerciseCatalogue.v2.json" with { type: "json" };

test("master row coverage, ID provenance and collision warnings", () => {
  const entries = mapping.exercises;
  const ids = new Set(snapshot.exercises.map((entry) => entry.id));
  assert.equal(entries.length, 247);
  assert.deepEqual(entries.map((entry) => entry.sourceRow), Array.from({ length: 247 }, (_, index) => index + 2));
  assert.equal(entries.filter((entry) => entry.historicalWgerId).length, 28);
  assert.equal(entries.filter((entry) => entry.matchStatus === "protected_existing_id").length, 28);
  assert.equal(entries.filter((entry) => entry.preferredWgerIdRaw).length, 6);
  assert.equal(entries.filter((entry) => entry.preferredWgerId).length, 5);
  for (const entry of entries) {
    if (entry.historicalWgerId) assert.ok(ids.has(entry.historicalWgerId), `historical row ${entry.sourceRow}`);
    if (entry.preferredWgerId) assert.ok(ids.has(entry.preferredWgerId), `preferred row ${entry.sourceRow}`);
    if (entry.suggestedWgerId) assert.ok(ids.has(entry.suggestedWgerId), `suggested row ${entry.sourceRow}`);
    assert.equal(entry.canonicalIdentity, null);
  }
  const groups = new Map();
  for (const entry of entries) if (entry.suggestedWgerId) groups.set(entry.suggestedWgerId, [...(groups.get(entry.suggestedWgerId) ?? []), entry]);
  for (const siblings of groups.values()) if (siblings.length > 1) {
    for (const entry of siblings) {
      assert.ok(entry.discrepancies.includes("suggested_id_shared_by_distinct_master_rows"));
      assert.notEqual(entry.matchStatus, "strong_candidate");
    }
  }
});
