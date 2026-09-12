import test from "node:test";
import assert from "node:assert/strict";
import {
  maybeNormalizeCloudProgram,
  toProgramDocument,
} from "../src/services/programData.js";

test("cloud normalization loads legacy routines as days and preserves builder fields", () => {
  const date = new Date("2026-09-12T01:02:03.000Z");
  const routine = {
    id: "routine-a",
    name: "Routine A",
    exercises: [{
      routineExerciseId: "row-1",
      exerciseId: "wger-1",
      sets: 3,
      repRange: "8-12",
      restSeconds: 120,
      displayNameOverride: "Machine Press",
      note: "Controlled",
      supersetGroupId: "ss-1",
    }],
  };
  const normalized = maybeNormalizeCloudProgram({
    id: "program-1",
    routines: [routine],
    createdAt: { toDate: () => date },
  });
  assert.equal(normalized.days[0], routine);
  assert.equal(normalized.days[0].exercises[0].routineExerciseId, "row-1");
  assert.equal(normalized.days[0].exercises[0].displayNameOverride, "Machine Press");
  assert.equal(normalized.createdAt, date.toISOString());
});

test("program serialization writes compatible days/routines without mutating input", () => {
  const program = {
    id: "program-1",
    name: "Program",
    days: [{ id: "routine-a", name: "A", exercises: [] }],
  };
  const before = structuredClone(program);
  let timestamp = 0;
  const document = toProgramDocument(program, () => `server-${++timestamp}`);
  assert.deepEqual(document.days, program.days);
  assert.deepEqual(document.routines, program.days);
  assert.equal(document.updatedAt, "server-1");
  assert.equal(document.createdAt, "server-2");
  assert.deepEqual(program, before);
});

test("invalid cloud program shapes fail safely", () => {
  assert.equal(maybeNormalizeCloudProgram(null), null);
  assert.equal(maybeNormalizeCloudProgram({ id: "program-1" }), null);
});
