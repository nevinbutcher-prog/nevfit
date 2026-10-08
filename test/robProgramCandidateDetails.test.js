import test from "node:test";
import assert from "node:assert/strict";
import { createRobProgramCandidateDetails, formatProgramRestPeriod } from "../src/services/rob/robProgramCandidateDetails.js";

const generation = {
  status: "success",
  candidate: {
    explanation: "A balanced plan with extra shoulder work.",
    candidate: { proposalType: "create_program", program: {
      name: "Four Day Build", summary: "A practical hypertrophy split.", days: [
        { name: "Upper A", focus: "Chest, back and shoulders", exercises: [
          { exerciseRef: "Dumbbell bench press", sets: 3, repRange: "8-12", restSeconds: 120, note: "Leave one rep in reserve.", proposalGroupKey: "upper-pair" },
          { exerciseRef: "Cable row", sets: 3, repRange: "8-12", restSeconds: 120, note: null, proposalGroupKey: "upper-pair" },
        ] },
        { name: "Lower A", focus: "Quads and glutes", exercises: [{ exerciseRef: "Leg press", sets: 3, repRange: "10-15", restSeconds: 90, note: null, proposalGroupKey: null }] },
      ],
    } },
  },
};

test("candidate details expose complete read-only routines, prescriptions, notes, rests, and supersets", () => {
  const details = createRobProgramCandidateDetails(generation);
  assert.equal(details.name, "Four Day Build");
  assert.equal(details.explanation, "A balanced plan with extra shoulder work.");
  assert.equal(details.routines.length, 2);
  assert.deepEqual(details.routines[0].exercises[0], {
    key: "0-Dumbbell bench press", name: "Dumbbell bench press", prescription: "3 sets · 8-12", rest: "2m rest", note: "Leave one rep in reserve.", superset: "Superset 1",
  });
  assert.equal(details.routines[0].exercises[1].superset, "Superset 1");
  assert.equal(details.routines[1].exercises[0].superset, null);
  assert.equal(formatProgramRestPeriod(75), "1m 15s rest");
});

test("candidate detail inspection is transient and does not require a provider or persistence dependency", async () => {
  assert.equal(createRobProgramCandidateDetails({ status: "idle" }), null);
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/services/rob/robProgramCandidateDetails.js", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /firebase|firestore|localStorage|requestRob|saveProgram|setDoc|provider/i);
});