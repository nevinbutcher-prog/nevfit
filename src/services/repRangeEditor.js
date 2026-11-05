// A generous input guard, separate from AI prescription limits.
export const MAX_EDITOR_REPS = 999;

export function parseEditorRepCount(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= MAX_EDITOR_REPS ? count : null;
}

export function parseEditorRepRange(value) {
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(String(value).trim());
  if (!match) return null;
  const min = parseEditorRepCount(match[1]);
  const max = parseEditorRepCount(match[2]);
  return min !== null && max !== null && min <= max ? { min, max } : null;
}

export function updateEditorRepRange(value, bound, count) {
  const next = parseEditorRepCount(count);
  if (next === null || !["min", "max"].includes(bound)) return null;
  const current = parseEditorRepRange(value) ?? { min: next, max: next };
  const min = bound === "min" ? next : Math.min(current.min, next);
  const max = bound === "max" ? next : Math.max(current.max, next);
  return `${min}-${max}`;
}
