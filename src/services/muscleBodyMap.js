import { MUSCLE_GROUPS } from "./muscleWorkload.js";

export const BODY_MAP_GROUP_IDS = MUSCLE_GROUPS.map(([id]) => id);

export function getBodyMapIntensity(value, max) {
  if (value <= 0 || max <= 0) return 0;
  if (value / max < 0.34) return 1;
  if (value / max < 0.67) return 2;
  return 3;
}

export function getBodyMapRegionValue(groupId, values) {
  return BODY_MAP_GROUP_IDS.includes(groupId) ? values?.[groupId] ?? 0 : null;
}
