import test from "node:test";
import assert from "node:assert/strict";
import { persistProgramDrafts } from "../src/services/programPersistence.js";

const programs = [{ id: "program-1", days: [] }];

test("program persistence writes the local fallback before cloud", async () => {
  const events = [];
  const result = await persistProgramDrafts(
    programs,
    { uid: "user-1" },
    "save-program",
    {
      persistLocal: (value) => events.push(["local", value]),
      saveCloud: async (uid, value) => events.push(["cloud", uid, value]),
      logSync: () => {},
    },
  );
  assert.equal(result, true);
  assert.deepEqual(events.map(([event]) => event), ["local", "cloud"]);
  assert.equal(events[1][1], "user-1");
});

test("cloud failure preserves the local write and returns a non-throwing failure", async () => {
  let localValue = null;
  const logs = [];
  const result = await persistProgramDrafts(
    programs,
    { uid: "user-1" },
    "save-program",
    {
      persistLocal: (value) => {
        localValue = value;
      },
      saveCloud: async () => {
        throw new Error("offline");
      },
      logSync: (...values) => logs.push(values),
    },
  );
  assert.equal(result, false);
  assert.equal(localValue, programs);
  assert.equal(logs.at(-1)[3], "failure");
});

test("signed-out persistence remains local-only", async () => {
  let cloudCalls = 0;
  const result = await persistProgramDrafts(programs, null, "save-program", {
    persistLocal: () => {},
    saveCloud: async () => {
      cloudCalls += 1;
    },
    logSync: () => {},
  });
  assert.equal(result, true);
  assert.equal(cloudCalls, 0);
});
