import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { BODY_MAP_GROUP_IDS, getBodyMapIntensity, getBodyMapRegionValue } from "../src/services/muscleBodyMap.js";

test("body regions use workload group IDs and resolve zero and selected intensities", () => {
  const component = readFileSync(new URL("../src/components/MuscleBodyMap.jsx", import.meta.url), "utf8");
  const pathIds = [...component.matchAll(/\["([a-z_]+)", "M/g)].map((match) => match[1]);
  assert.ok(pathIds.length >= BODY_MAP_GROUP_IDS.length);
  assert.deepEqual([...new Set(pathIds)].sort(), [...BODY_MAP_GROUP_IDS].sort());
  assert.equal(getBodyMapRegionValue("shoulders", { shoulders: 9 }), 9);
  assert.equal(getBodyMapRegionValue("shoulders", {}), 0);
  assert.equal(getBodyMapRegionValue("unknown", {}), null);
  assert.deepEqual([0, 1, 5, 10].map((value) => getBodyMapIntensity(value, 10)), [0, 1, 2, 3]);
  assert.match(component, /aria-pressed=\{onSelect \? selectedId === id/);
  assert.match(component, /onKeyDown=\{onSelect/);
  assert.match(component, /data-region-id=\{id\} data-side=/);
  assert.match(component, /role=\{onSelect \? "button"/);
  assert.match(component, /tabIndex=\{onSelect \? 0/);
  assert.match(component, /aria-label=\{onSelect \? `\$\{orientation\}/);
  assert.match(component, /event\.key === "Enter" \|\| event\.key === " "/);
});
