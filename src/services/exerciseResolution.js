const DEFAULT_ALIASES = {
  "db": "dumbbell",
  "bb": "barbell",
  "lat raise": "lateral raise",
  "pulldown": "lat pulldown",
  "cable pushdown": "triceps pushdown",
  "db bench": "dumbbell bench press",
};

export function normalizeExerciseText(value, aliases = DEFAULT_ALIASES) {
  let text = typeof value === "string" ? value.toLowerCase() : "";
  text = text.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  Object.entries(aliases).sort(([first], [second]) => second.length - first.length).forEach(([from, to]) => {
    text = text.replace(new RegExp(`(^| )${from.replace(/ /g, "\\s+")}(?= |$)`, "g"), `$1${to}`);
  });
  return text.replace(/\s+/g, " ").trim();
}

const validProviderExercise = (exercise) => exercise && /^wger-[A-Za-z0-9._:-]+$/.test(exercise.id) && typeof exercise.name === "string";
const uniqueById = (exercises) => [...new Map(exercises.filter(validProviderExercise).map((exercise) => [exercise.id, exercise])).values()];
const tokensFor = (value, aliases) => normalizeExerciseText(value, aliases).split(" ").filter(Boolean);

function scoreExercise(requestedName, exercise, aliases) {
  const requested = tokensFor(requestedName, aliases);
  const candidate = tokensFor(exercise.name, aliases);
  if (!requested.length || !candidate.length) return 0;
  const overlap = requested.filter((token) => candidate.includes(token)).length;
  const sameTokens = overlap === requested.length && overlap === candidate.length;
  const orderBonus = requested.every((token, index) => candidate[index] === token) ? 0.05 : 0;
  // Requested-token coverage is intentionally used here: a close but not
  // identical candidate becomes ambiguous instead of disappearing.
  return Number(Math.min(1, overlap / requested.length + (sameTokens ? 0.35 : 0) + orderBonus).toFixed(3));
}

/**
 * Resolves an untrusted AI exercise description to provider identity. This
 * function never accepts an AI-supplied exercise ID as authoritative.
 */
export async function resolveProposedExercise({ requestedName, query, exerciseProvider, aliases = DEFAULT_ALIASES }) {
  const name = typeof requestedName === "string" ? requestedName.trim() : "";
  const search = typeof exerciseProvider === "function" ? exerciseProvider : null;
  if (!name || !search) return { status: "unresolved", exercise: null, candidates: [], confidence: "none" };

  const queries = [...new Set([query, name].filter((value) => typeof value === "string" && value.trim()))];
  const batches = await Promise.all(queries.map((value) => search(value)));
  const candidates = uniqueById(batches.flatMap((result) => Array.isArray(result) ? result : []));
  const normalizedName = normalizeExerciseText(name, aliases);
  const exact = candidates.filter((exercise) => normalizeExerciseText(exercise.name, aliases) === normalizedName);
  if (exact.length === 1) return { status: "resolved", exercise: exact[0], candidates: exact, confidence: "exact" };
  if (exact.length > 1) return { status: "ambiguous", exercise: null, candidates: exact, confidence: "none" };

  const scored = candidates.map((exercise) => ({ exercise, score: scoreExercise(name, exercise, aliases) })).filter(({ score }) => score >= 0.6).sort((first, second) => second.score - first.score || first.exercise.name.localeCompare(second.exercise.name));
  if (!scored.length) return { status: "unresolved", exercise: null, candidates: [], confidence: "none" };
  const best = scored[0];
  const next = scored[1];
  if (best.score >= 0.82 && (!next || best.score - next.score >= 0.4)) return { status: "resolved", exercise: best.exercise, candidates: [best.exercise], confidence: "high" };
  return { status: "ambiguous", exercise: null, candidates: scored.slice(0, 5).map(({ exercise }) => exercise), confidence: "none" };
}

export { DEFAULT_ALIASES as EXERCISE_RESOLUTION_ALIASES };
