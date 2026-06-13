const WGER_API_BASE_URL = "https://wger.de/api/v2";
const DEFAULT_SETS = 3;
const DEFAULT_REP_RANGE = "8-12";
const DEFAULT_REST_SECONDS = 120;
const ENGLISH_LANGUAGE_ID = 2;
const SEARCH_POOL_LIMIT = 1500;
let wgerExercisePoolPromise = null;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripHtml(value) {
  return normalizeText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFilterValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(value) {
  return normalizeFilterValue(value).split(" ").filter(Boolean);
}

function getCanonicalText(value) {
  return normalizeFilterValue(value);
}

function hasTokenPhrase(value, queryTokens) {
  if (!queryTokens.length) {
    return false;
  }

  const tokens = getSearchTokens(value);

  return tokens.some((_, index) =>
    queryTokens.every(
      (queryToken, queryIndex) => tokens[index + queryIndex] === queryToken,
    ),
  );
}

function hasTokenPrefix(value, queryTokens) {
  if (!queryTokens.length) {
    return false;
  }

  const tokens = getSearchTokens(value);

  return tokens.some((_, index) =>
    queryTokens.every((queryToken, queryIndex) =>
      tokens[index + queryIndex]?.startsWith(queryToken),
    ),
  );
}

function hasSafeSubstringMatch(value, normalizedQuery) {
  return normalizedQuery.length >= 4 && getCanonicalText(value).includes(normalizedQuery);
}

function isProbablyEnglishExerciseName(name) {
  const tokens = getSearchTokens(name);
  const nonEnglishTokens = new Set([
    "agarre",
    "avec",
    "con",
    "de",
    "der",
    "die",
    "et",
    "lento",
    "maniglia",
    "mit",
    "monolaterale",
    "ohne",
    "prono",
    "seduto",
    "sin",
    "sur",
  ]);

  return !tokens.some((token) => nonEnglishTokens.has(token));
}

function getNamedValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return normalizeText(value);
  }

  return normalizeText(value.name_en) || normalizeText(value.name);
}

function getNamedValues(values) {
  return Array.isArray(values)
    ? values.map(getNamedValue).filter(Boolean)
    : [];
}

function getAliasValues(translation) {
  if (!Array.isArray(translation?.aliases)) {
    return [];
  }

  return translation.aliases
    .map((alias) => normalizeText(alias.alias ?? alias.name ?? alias))
    .filter(Boolean);
}

function getWgerTranslation(sourceExercise) {
  if (!Array.isArray(sourceExercise.translations)) {
    return null;
  }

  return (
    sourceExercise.translations.find(
      (translation) => translation.language === ENGLISH_LANGUAGE_ID,
    ) ??
    sourceExercise.translations.find((translation) =>
      normalizeText(translation.name),
    ) ??
    null
  );
}

function valuesMatchFilter(values = [], filterValue) {
  const normalizedFilter = normalizeFilterValue(filterValue);

  if (!normalizedFilter || normalizedFilter === "all") {
    return true;
  }

  return values.some((value) => {
    const normalizedValue = normalizeFilterValue(value);

    return (
      normalizedValue === normalizedFilter ||
      normalizedValue.includes(normalizedFilter) ||
      normalizedFilter.includes(normalizedValue)
    );
  });
}

function normalizeMuscleName(value) {
  const normalizedValue = normalizeFilterValue(value);

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.includes("pectoralis") || normalizedValue === "chest") {
    return "Chest";
  }

  if (normalizedValue.includes("latissimus") || normalizedValue === "lats") {
    return "Lats";
  }

  if (
    normalizedValue.includes("trapezius") ||
    normalizedValue.includes("erector") ||
    normalizedValue === "back"
  ) {
    return "Back";
  }

  if (
    normalizedValue.includes("deltoid") ||
    normalizedValue.includes("shoulder")
  ) {
    return normalizedValue.includes("posterior") ? "Rear Delts" : "Shoulders";
  }

  if (normalizedValue.includes("biceps")) {
    return "Biceps";
  }

  if (normalizedValue.includes("triceps")) {
    return "Triceps";
  }

  if (normalizedValue.includes("quadriceps") || normalizedValue === "quads") {
    return "Quads";
  }

  if (
    normalizedValue.includes("hamstring") ||
    normalizedValue.includes("biceps femoris")
  ) {
    return "Hamstrings";
  }

  if (normalizedValue.includes("glute")) {
    return "Glutes";
  }

  if (
    normalizedValue.includes("gastrocnemius") ||
    normalizedValue.includes("soleus") ||
    normalizedValue.includes("calf")
  ) {
    return "Calves";
  }

  if (
    normalizedValue.includes("rectus abdominis") ||
    normalizedValue.includes("oblique") ||
    normalizedValue.includes("abs") ||
    normalizedValue.includes("abdominal")
  ) {
    return "Abs";
  }

  return normalizeText(value);
}

function normalizeEquipmentName(value) {
  const normalizedValue = normalizeFilterValue(value);

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.includes("barbell")) {
    return "Barbell";
  }

  if (normalizedValue.includes("dumbbell")) {
    return "Dumbbell";
  }

  if (normalizedValue.includes("cable")) {
    return "Cable";
  }

  if (normalizedValue.includes("machine")) {
    return "Machine";
  }

  if (
    normalizedValue.includes("bodyweight") ||
    normalizedValue.includes("none")
  ) {
    return "Bodyweight";
  }

  if (normalizedValue.includes("kettlebell")) {
    return "Kettlebell";
  }

  if (normalizedValue.includes("band")) {
    return "Band";
  }

  return normalizeText(value);
}

function matchesFilters(exercise, filters = {}) {
  const equipment = normalizeFilterValue(filters.equipment);
  const muscle = normalizeFilterValue(filters.muscle);

  if (
    equipment &&
    equipment !== "all" &&
    !valuesMatchFilter(exercise.equipment ?? [], equipment)
  ) {
    return false;
  }

  if (
    muscle &&
    muscle !== "all" &&
    !valuesMatchFilter(
      [
        exercise.bodyPart,
        exercise.primaryMuscle,
        ...(exercise.secondaryMuscles ?? []),
      ],
      muscle,
    )
  ) {
    return false;
  }

  return true;
}

function normalizeWgerExercise(sourceExercise) {
  const translation = getWgerTranslation(sourceExercise);
  const muscles = getNamedValues(sourceExercise.muscles)
    .map(normalizeMuscleName)
    .filter(Boolean);
  const secondaryMuscles = getNamedValues(sourceExercise.muscles_secondary)
    .map(normalizeMuscleName)
    .filter(Boolean);
  const category = getNamedValue(sourceExercise.category) || "Exercise";
  const primaryMuscle = muscles[0] ?? category;
  const id = String(sourceExercise.id ?? sourceExercise.uuid ?? "");
  const name = normalizeText(translation?.name);
  const aliases = getAliasValues(translation);

  if (!id || !translation || !name || !isProbablyEnglishExerciseName(name)) {
    return null;
  }

  return {
    id: `wger-${id}`,
    name,
    category,
    bodyPart: category,
    primaryMuscle,
    secondaryMuscles,
    equipment: getNamedValues(sourceExercise.equipment)
      .map(normalizeEquipmentName)
      .filter(Boolean),
    aliases,
    defaultSets: DEFAULT_SETS,
    defaultRepRange: DEFAULT_REP_RANGE,
    defaultRestSeconds: DEFAULT_REST_SECONDS,
    source: "wger",
    sourceId: id,
    ...(translation?.description_source || translation?.description
      ? {
          instructions:
            normalizeText(translation.description_source) ||
            stripHtml(translation.description),
        }
      : {}),
  };
}

function getExerciseMatchScore(exercise, query) {
  const normalizedQuery = getCanonicalText(query);
  const queryTokens = getSearchTokens(query);
  const normalizedName = getCanonicalText(exercise.name);
  const aliasValues = exercise.aliases ?? [];
  const normalizedAliases = aliasValues.map(getCanonicalText);

  if (!normalizedQuery || !normalizedName) {
    return null;
  }

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedName.startsWith(`${normalizedQuery} `)) {
    return 1;
  }

  if (hasTokenPhrase(exercise.name, queryTokens)) {
    return 2;
  }

  if (hasTokenPrefix(exercise.name, queryTokens)) {
    return 3;
  }

  if (normalizedAliases.some((alias) => alias === normalizedQuery)) {
    return 4;
  }

  if (aliasValues.some((alias) => hasTokenPhrase(alias, queryTokens))) {
    return 5;
  }

  if (aliasValues.some((alias) => hasTokenPrefix(alias, queryTokens))) {
    return 6;
  }

  return hasSafeSubstringMatch(exercise.name, normalizedQuery) ? 7 : null;
}

function sortBySearchRelevance(firstExercise, secondExercise, query) {
  const firstScore = getExerciseMatchScore(firstExercise, query);
  const secondScore = getExerciseMatchScore(secondExercise, query);

  if (firstScore !== secondScore) {
    return firstScore - secondScore;
  }

  return firstExercise.name.localeCompare(secondExercise.name);
}

export function normalizeExercise(sourceExercise) {
  if (!sourceExercise) {
    return null;
  }

  if (
    sourceExercise.source === "wger" &&
    sourceExercise.id &&
    sourceExercise.name &&
    Array.isArray(sourceExercise.equipment)
  ) {
    return {
      ...sourceExercise,
      defaultSets: sourceExercise.defaultSets ?? DEFAULT_SETS,
      defaultRepRange: sourceExercise.defaultRepRange ?? DEFAULT_REP_RANGE,
      defaultRestSeconds:
        sourceExercise.defaultRestSeconds ?? DEFAULT_REST_SECONDS,
    };
  }

  if (
    sourceExercise.source === "wger" ||
    sourceExercise.id?.startsWith?.("wger-")
  ) {
    return normalizeWgerExercise(sourceExercise);
  }

  return null;
}

async function fetchWgerExercisePool() {
  const searchParams = new URLSearchParams({
    language: String(ENGLISH_LANGUAGE_ID),
    limit: String(SEARCH_POOL_LIMIT),
  });
  const response = await fetch(`${WGER_API_BASE_URL}/exerciseinfo/?${searchParams}`);

  if (!response.ok) {
    throw new Error("wger exercise search failed");
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.map(normalizeWgerExercise).filter(Boolean);
}

export async function searchExercises(query = "", filters = {}) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [];
  }

  wgerExercisePoolPromise ??= fetchWgerExercisePool();

  let wgerResults;

  try {
    wgerResults = await wgerExercisePoolPromise;
  } catch (error) {
    wgerExercisePoolPromise = null;
    throw error;
  }

  return wgerResults
    .filter((exercise) => getExerciseMatchScore(exercise, normalizedQuery) !== null)
    .filter((exercise) => matchesFilters(exercise, filters))
    .sort((firstExercise, secondExercise) =>
      sortBySearchRelevance(firstExercise, secondExercise, normalizedQuery),
    )
    .slice(0, 100);
}

export async function getExerciseById(id) {
  if (!id?.startsWith?.("wger-")) {
    return null;
  }

  const sourceId = id.replace(/^wger-/, "");
  const response = await fetch(`${WGER_API_BASE_URL}/exerciseinfo/${sourceId}/`);

  if (!response.ok) {
    return null;
  }

  return normalizeWgerExercise(await response.json());
}
