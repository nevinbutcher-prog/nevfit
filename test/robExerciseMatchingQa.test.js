import test from "node:test";
import assert from "node:assert/strict";
import { resolveProposedExercise } from "../src/services/exerciseResolution.js";

const fixture = [
  { requestedName: "Barbell Bench Press", expected: "resolved", selectedId: "wger-73", candidates: [{ id: "wger-73", name: "Bench Press", equipment: ["Barbell", "Bench"] }] },
  { requestedName: "Cable Flyes", expected: "ambiguous", candidates: [{ id: "wger-237", name: "Fly With Cable", equipment: ["Cable machine"] }, { id: "wger-1689", name: "Cable Fly Middle Chest", equipment: ["Cable machine"] }, { id: "wger-1690", name: "Cable Fly Upper Chest", equipment: ["Cable machine"] }] },
  { requestedName: "Lat Pulldown", expected: "resolved", selectedId: "wger-723", candidates: [{ id: "wger-723", name: "Wide-grip Pulldown", aliases: ["Lat Pulldown (Wide Grip)"], equipment: ["Cable machine"] }] },
  { requestedName: "Dumbbell Bent-Over Row", expected: "resolved", selectedId: "wger-2669", candidates: [{ id: "wger-2669", name: "Bent Over Dumbbell Rows (Two Arms)", equipment: ["Dumbbell"] }] },
  { requestedName: "Dumbbell Deadlift", expected: "resolved", selectedId: "wger-1370", candidates: [{ id: "wger-1370", name: "Dumbbell Deadlift", equipment: ["Dumbbell"] }] },
  { requestedName: "Seated Dumbbell Shoulder Press", expected: "ambiguous", candidates: [{ id: "wger-567", name: "Shoulder Press, Dumbbells", equipment: ["Dumbbell"] }] },
  // WGER currently exposes one unqualified Pull-ups record plus named variants; the base record is safe while variants remain distinct provider IDs.
  { requestedName: "Pull-ups", expected: "resolved", selectedId: "wger-475", candidates: [{ id: "wger-475", name: "Pull-ups", equipment: ["Pull-up bar"] }, { id: "wger-1695", name: "Pull-Ups (Wide Grip)" }, { id: "wger-1696", name: "Pull-Ups (Neutral Grip)" }] },
  { requestedName: "Plank", expected: "resolved", selectedId: "wger-458", candidates: [{ id: "wger-458", name: "Plank", equipment: ["none (bodyweight exercise)"] }] },
  { requestedName: "Russian Twists with Weight", expected: "ambiguous", candidates: [{ id: "wger-1193", name: "Russian Twist", equipment: ["Dumbbell", "Gym mat", "Swiss Ball"] }] },
  { requestedName: "Dumbbell Side Bends", expected: "resolved", selectedId: "wger-577", candidates: [{ id: "wger-577", name: "Side Dumbbell Trunk Flexion", aliases: ["Side bends"], equipment: ["Dumbbell"] }] },
  { requestedName: "Treadmill Sprints", expected: "unresolved", candidates: [{ id: "wger-530", name: "Run - Treadmill" }] },
  { requestedName: "Cable Woodchoppers", expected: "resolved", selectedId: "wger-145", candidates: [{ id: "wger-145", name: "Cable Woodchoppers", equipment: ["Cable machine"] }] },
  { requestedName: "Barbell Squat", expected: "resolved", selectedId: "wger-1801", candidates: [{ id: "wger-1801", name: "Barbell Full Squat", equipment: ["Barbell"] }] },
  { requestedName: "Leg Press Machine", expected: "ambiguous", candidates: [{ id: "wger-371", name: "Leg Press" }, { id: "wger-373", name: "Leg Presses (narrow)" }, { id: "wger-374", name: "Leg Presses (wide)" }] },
  { requestedName: "Seated Leg Curl", expected: "resolved", selectedId: "wger-2626", candidates: [{ id: "wger-2626", name: "Machine Seated Leg Curl" }] },
  { requestedName: "Calf Raises on Machine", expected: "ambiguous", candidates: [{ id: "wger-148", name: "Calf Raises on Hackenschmitt Machine" }] },
];

test("real-world 16-exercise QA fixture resolves only verified equivalents", async () => {
  let automatic = 0;
  let ambiguous = 0;
  let unresolved = 0;
  for (const entry of fixture) {
    const result = await resolveProposedExercise({ requestedName: entry.requestedName, exerciseProvider: async () => entry.candidates });
    assert.equal(result.status, entry.expected, entry.requestedName);
    if (entry.selectedId) assert.equal(result.exercise?.id, entry.selectedId, entry.requestedName);
    if (result.status === "resolved") automatic += 1;
    if (result.status === "ambiguous") ambiguous += 1;
    if (result.status === "unresolved") unresolved += 1;
  }
  assert.deepEqual({ automatic, ambiguous, unresolved }, { automatic: 10, ambiguous: 5, unresolved: 1 });
});

test("missing or conflicting provider equipment never establishes an automatic match", async () => {
  const missing = await resolveProposedExercise({ requestedName: "Barbell Bench Press", exerciseProvider: async () => [{ id: "wger-unknown", name: "Bench Press" }] });
  const conflicting = await resolveProposedExercise({ requestedName: "Barbell Bench Press", exerciseProvider: async () => [{ id: "wger-dumbbell", name: "Bench Press", equipment: ["Dumbbell"] }] });
  assert.equal(missing.status, "ambiguous");
  assert.equal(conflicting.status, "ambiguous");
});

test("identically named provider records stay ambiguous rather than selecting an arbitrary ID", async () => {
  const result = await resolveProposedExercise({ requestedName: "Pull-ups", exerciseProvider: async () => [{ id: "wger-475", name: "Pull-ups" }, { id: "wger-1695", name: "Pull-ups" }] });
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.candidates.map((entry) => entry.id), ["wger-475", "wger-1695"]);
});
