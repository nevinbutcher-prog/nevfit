import { exerciseCatalog } from "../data/exerciseCatalog.js";

const WGER_API_BASE_URL = "https://wger.de/api/v2";
const DEFAULT_SETS = 3;
const DEFAULT_REP_RANGE = "8-12";
const DEFAULT_REST_SECONDS = 120;
const ENGLISH_LANGUAGE_ID = 2;

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

function getExerciseSearchText(exercise) {
  return [
    exercise.name,
    exercise.category,
    exercise.bodyPart,
    exercise.primaryMuscle,
    ...(exercise.secondaryMuscles ?? []),
    ...(exercise.equipment ?? []),
    exercise.instructions,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function valuesMatchFilter(values, filterValue) {
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

function matchesFilters(exercise, filters = {}) {
  const query = normalizeText(filters.query).toLowerCase();
  const equipment = normalizeFilterValue(filters.equipment);
  const muscle = normalizeFilterValue(filters.muscle);

  if (query && !getExerciseSearchText(exercise).includes(query)) {
    return false;
  }

  if (
    equipment &&
    equipment !== "all" &&
    !valuesMatchFilter(exercise.equipment, equipment)
  ) {
    return false;
  }

  if (
    muscle &&
    muscle !== "all" &&
    !valuesMatchFilter(
      [exercise.bodyPart, exercise.primaryMuscle, ...exercise.secondaryMuscles],
      muscle,
    )
  ) {
    return false;
  }

  return true;
}

function normalizeLocalExercise(sourceExercise) {
  return {
    id: sourceExercise.id,
    name: sourceExercise.name,
    category: sourceExercise.category ?? "Exercise",
    bodyPart: sourceExercise.bodyPart ?? sourceExercise.category ?? "Exercise",
    primaryMuscle: sourceExercise.primaryMuscle ?? "General",
    secondaryMuscles: sourceExercise.secondaryMuscles ?? [],
    equipment: sourceExercise.equipment ?? [],
    defaultSets: sourceExercise.defaultSets ?? DEFAULT_SETS,
    defaultRepRange: sourceExercise.defaultRepRange ?? DEFAULT_REP_RANGE,
    defaultRestSeconds:
      sourceExercise.defaultRestSeconds ?? DEFAULT_REST_SECONDS,
    source: "local",
    sourceId: sourceExercise.sourceId ?? sourceExercise.id,
    ...(sourceExercise.instructions
      ? { instructions: sourceExercise.instructions }
      : {}),
  };
}

function normalizeWgerExercise(sourceExercise) {
  const translation = getWgerTranslation(sourceExercise);
  const muscles = getNamedValues(sourceExercise.muscles);
  const secondaryMuscles = getNamedValues(sourceExercise.muscles_secondary);
  const category = getNamedValue(sourceExercise.category) || "Exercise";
  const primaryMuscle = muscles[0] ?? category;
  const id = String(sourceExercise.id ?? sourceExercise.uuid ?? "");
  const name = normalizeText(sourceExercise.name) || normalizeText(translation?.name);

  if (!id || !name) {
    return null;
  }

  return {
    id: `wger-${id}`,
    name,
    category,
    bodyPart: category,
    primaryMuscle,
    secondaryMuscles,
    equipment: getNamedValues(sourceExercise.equipment),
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

export function normalizeExercise(sourceExercise) {
  if (!sourceExercise) {
    return null;
  }

  if (
    sourceExercise.source &&
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

  return normalizeLocalExercise(sourceExercise);
}

export function getLocalExerciseCatalog() {
  return exerciseCatalog.map(normalizeLocalExercise);
}

async function searchWgerExercises(query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [];
  }

  const searchParams = new URLSearchParams({
    language: String(ENGLISH_LANGUAGE_ID),
    limit: "200",
    term: normalizedQuery,
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
  const localResults = getLocalExerciseCatalog().filter((exercise) =>
    matchesFilters(exercise, { ...filters, query }),
  );

  try {
    const wgerResults = await searchWgerExercises(query);
    const mergedResults = [...wgerResults, ...localResults];
    const dedupedResults = Array.from(
      new Map(mergedResults.map((exercise) => [exercise.id, exercise])).values(),
    );

    return dedupedResults.filter((exercise) =>
      matchesFilters(exercise, { ...filters, query }),
    );
  } catch {
    return localResults;
  }
}

export async function getExerciseById(id) {
  const localExercise = getLocalExerciseCatalog().find(
    (exercise) => exercise.id === id,
  );

  if (localExercise || !id?.startsWith?.("wger-")) {
    return localExercise ?? null;
  }

  const sourceId = id.replace(/^wger-/, "");
  const response = await fetch(`${WGER_API_BASE_URL}/exerciseinfo/${sourceId}/`);

  if (!response.ok) {
    return null;
  }

  return normalizeWgerExercise(await response.json());
}
