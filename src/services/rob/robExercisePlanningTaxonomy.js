import { ROB_EXERCISE_PLANNING_EXCEPTIONS, ROB_EXERCISE_PLANNING_EXCEPTIONS_VERSION } from "./robExercisePlanningExceptions.js";

export const ROB_EXERCISE_PLANNING_TAXONOMY_VERSION = 1;
const INVOLVEMENT = Object.freeze({ unknown: 0, supporting: 1, meaningful: 2 });
const provenance = (value, confidence) => ({ value, confidence, provenance: "inferred_rule" });

// This is intentionally a narrow selection overlay, not an anatomical model.
// It distinguishes only isolation purposes that are unsafe to treat as freely
// interchangeable when a blueprint explicitly asks for one.
export const ROB_SELECTION_INTENTS = Object.freeze(["biceps_flexion", "triceps_extension", "knee_flexion", "knee_extension", "lateral_delt", "rear_delt", "anterior_delt"]);

export function normalizePlanningMuscle(value) {
  const name = String(value ?? "").toLowerCase();
  if (/shoulder/.test(name)) return "shoulders";
  if (/bicep|tricep|brachialis|forearm|arms?/.test(name)) return "arms";
  if (/chest|pectoral/.test(name)) return "chest";
  if (/lat|back|trapez/.test(name)) return "back";
  if (/quad|hamstring|calf|soleus|leg/.test(name)) return "legs";
  if (/glute/.test(name)) return "glutes";
  if (/abs|obliqu|serratus|core/.test(name)) return "core";
  return "unknown";
}

export function inferMovementPattern(entry) {
  const name = String(entry?.name ?? "").toLowerCase();
  if (/crawl|punch|cardio|jump rope/.test(name)) return provenance("conditioning", "low");
  if (/squat|lunge|leg press|step.?up/.test(name)) return provenance("knee_dominant", "medium");
  if (/deadlift|good morning|hip thrust|glute bridge|pull.?through/.test(name)) return provenance("hinge", "medium");
  if (/bench press|chest press|push.?up|dip/.test(name)) return provenance("horizontal_push", "medium");
  if (/shoulder press|overhead press|military press/.test(name)) return provenance("vertical_push", "medium");
  if (/row/.test(name)) return provenance("horizontal_pull", "medium");
  if (/pull.?up|pulldown/.test(name)) return provenance("vertical_pull", "medium");
  if (/plank|twist|crunch|woodchop|carry/.test(name)) return provenance("trunk", "medium");
  if (/curl|extension|raise|fly|calf/.test(name)) return provenance("isolation", "medium");
  return { value: "unknown", confidence: "low", provenance: "unknown" };
}

const inferredSecondary = (pattern, primary) => {
  const groups = [];
  if (pattern === "horizontal_push") groups.push(["shoulders", "meaningful"], ["arms", "meaningful"]);
  if (pattern === "vertical_push") groups.push(["arms", "meaningful"]);
  if (pattern === "horizontal_pull" || pattern === "vertical_pull") groups.push(["arms", "meaningful"]);
  if (pattern === "knee_dominant") groups.push(["glutes", "supporting"]);
  if (pattern === "hinge") groups.push(["glutes", "meaningful"]);
  return groups.filter(([group]) => group !== primary).map(([muscleGroup, involvement]) => ({ muscleGroup, involvement, confidence: "low", provenance: "inferred_rule" }));
};

const mergeSecondary = (items) => {
  const merged = new Map();
  for (const item of items) {
    if (item.muscleGroup === "unknown") continue;
    const current = merged.get(item.muscleGroup);
    if (!current) {
      merged.set(item.muscleGroup, { ...item, evidence: [item.provenance] });
      continue;
    }
    const provenanceRank = { manual_review: 3, source_normalized: 2, inferred_rule: 1, unknown: 0 };
    const preferred = INVOLVEMENT[item.involvement] > INVOLVEMENT[current.involvement]
      || (INVOLVEMENT[item.involvement] === INVOLVEMENT[current.involvement] && (provenanceRank[item.provenance] ?? 0) > (provenanceRank[current.provenance] ?? 0)) ? item : current;
    merged.set(item.muscleGroup, { ...preferred, evidence: [...new Set([...(current.evidence ?? [current.provenance]), item.provenance])].sort() });
  }
  return [...merged.values()].sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup));
};

const roleFor = (pattern) => ({ horizontal_push: "compound", vertical_push: "compound", horizontal_pull: "compound", vertical_pull: "compound", knee_dominant: "compound", hinge: "compound", trunk: "trunk", conditioning: "conditioning", isolation: "isolation" }[pattern] ?? "unknown");
const setupFor = (entry) => {
  const equipment = Array.isArray(entry?.equipment) ? entry.equipment.join(" ").toLowerCase() : "";
  if (!equipment) return { value: "unknown", confidence: "low", provenance: "unknown" };
  if (/barbell|cable machine|machine|pull.?up/.test(equipment)) return provenance("medium", "low");
  return provenance("low", "low");
};
const conventionalityFor = (entry, pattern) => {
  const name = String(entry?.name ?? "").toLowerCase();
  if (/isometric|crawl|punch|complex|combo|behind.?the.?back/.test(name)) return provenance("specialist", "low");
  if (/single.?arm|single.?leg|incline|decline|wide.?grip|close.?grip|reverse.?grip|arnold|front/.test(name)) return provenance("variant", "low");
  return pattern === "unknown" ? { value: "unknown", confidence: "low", provenance: "unknown" } : provenance("standard", "low");
};
const selectionIntentFor = (entry, primary, pattern) => {
  const name = String(entry?.name ?? "").toLowerCase();
  if (pattern !== "isolation") return { value: "unknown", confidence: "low", provenance: "unknown" };
  if (primary === "arms") {
    if (/tricep|skull.?crusher|pushdown/.test(name)) return provenance("triceps_extension", "medium");
    if (/bicep|curl/.test(name)) return provenance("biceps_flexion", "medium");
  }
  if (primary === "legs") {
    if (/leg curl|hamstring curl/.test(name)) return provenance("knee_flexion", "medium");
    if (/leg extension|terminal knee extension/.test(name)) return provenance("knee_extension", "medium");
  }
  if (primary === "shoulders") {
    if (/rear delt|rear-delt|reverse fly/.test(name)) return provenance("rear_delt", "medium");
    if (/lateral raise|side lateral/.test(name)) return provenance("lateral_delt", "medium");
    if (/front raise/.test(name)) return provenance("anterior_delt", "medium");
  }
  return { value: "unknown", confidence: "low", provenance: "unknown" };
};
const fatigueTagsFor = (entry, pattern, role) => {
  const name = String(entry?.name ?? "").toLowerCase();
  const tags = new Set([pattern]);
  if (role === "compound") tags.add("compound_fatigue");
  if (pattern === "knee_dominant" || pattern === "hinge") tags.add("lower_body");
  if (pattern === "hinge" || /squat|good morning/.test(name)) tags.add("axial_or_bracing");
  if (pattern === "vertical_push" || /overhead/.test(name)) tags.add("overhead");
  if (/curl|pull.?up|pulldown|row/.test(name)) tags.add("elbow_flexion");
  if (/extension|press|dip/.test(name)) tags.add("elbow_extension");
  return [...tags].sort();
};
const sequencingTagsFor = (role, pattern) => {
  if (role === "compound") return ["perform_before_related_isolation", "fatigue_sensitive"];
  if (role === "isolation") return ["compatible_after_compound"];
  if (pattern === "trunk") return ["flexible_placement"];
  return [];
};
const matchingException = (entry) => {
  const exception = ROB_EXERCISE_PLANNING_EXCEPTIONS[entry?.id];
  return exception?.expectedName === entry?.name ? exception : null;
};

export function createRobExercisePlanningProfile(entry) {
  const exception = matchingException(entry);
  const inferredPattern = inferMovementPattern(entry);
  const movementPattern = exception?.movementPattern ? { value: exception.movementPattern, confidence: "high", provenance: "manual_review" } : inferredPattern;
  const primaryGroup = normalizePlanningMuscle(entry?.primaryMuscle ?? entry?.bodyPart);
  const primaryStimulus = primaryGroup === "unknown"
    ? { status: "unknown", contributions: [] }
    : { status: "known", contributions: [{ muscleGroup: primaryGroup, involvement: "primary", confidence: "medium", provenance: "source_normalized", sourceMuscle: entry.primaryMuscle }] };
  const sourceSecondary = Array.isArray(entry?.secondaryMuscles) ? entry.secondaryMuscles.map((sourceMuscle) => ({ muscleGroup: normalizePlanningMuscle(sourceMuscle), involvement: "supporting", confidence: "medium", provenance: "source_normalized", sourceMuscle })) : [];
  const secondary = mergeSecondary([...sourceSecondary, ...inferredSecondary(movementPattern.value, primaryGroup), ...(exception?.secondary ?? []).map((item) => ({ ...item, confidence: "high", provenance: "manual_review" }))]);
  const secondaryStimulus = { status: secondary.length ? (sourceSecondary.length ? "partial" : "inferred") : "unknown", contributions: secondary };
  const role = exception?.role ? { value: exception.role, confidence: "high", provenance: "manual_review" } : provenance(roleFor(movementPattern.value), movementPattern.confidence);
  const conventionality = exception?.conventionality ? { value: exception.conventionality, confidence: "high", provenance: "manual_review" } : conventionalityFor(entry, movementPattern.value);
  const selectionIntent = selectionIntentFor(entry, primaryGroup, movementPattern.value);
  const confidence = primaryStimulus.status === "unknown" || movementPattern.value === "unknown" ? "low" : exception ? "high" : secondaryStimulus.status === "unknown" ? "low" : "medium";
  return Object.freeze({
    taxonomyVersion: ROB_EXERCISE_PLANNING_TAXONOMY_VERSION,
    exerciseId: entry?.id ?? null,
    source: { catalogueRecord: "wger", sourceName: entry?.name ?? null },
    primaryStimulus,
    secondaryStimulus,
    movementPattern,
    role,
    selectionIntent,
    fatigueTags: fatigueTagsFor(entry, movementPattern.value, role.value),
    sequencingTags: sequencingTagsFor(role.value, movementPattern.value),
    setupDemand: setupFor(entry),
    conventionality,
    confidence,
  });
}

export function createRobExercisePlanningTaxonomy(catalogue) {
  const exercises = Array.isArray(catalogue?.exercises) ? catalogue.exercises : [];
  return Object.freeze({ taxonomyVersion: ROB_EXERCISE_PLANNING_TAXONOMY_VERSION, reviewedExceptionsVersion: ROB_EXERCISE_PLANNING_EXCEPTIONS_VERSION, catalogueVersion: catalogue?.version ?? null, profiles: exercises.map(createRobExercisePlanningProfile) });
}

export function planningOverlap(first, second) {
  const muscles = (profile) => new Set([...(profile?.primaryStimulus?.contributions ?? []), ...(profile?.secondaryStimulus?.contributions ?? [])].map((item) => item.muscleGroup));
  const sharedMuscles = [...muscles(first)].filter((group) => muscles(second).has(group));
  const firstTags = new Set(first?.fatigueTags ?? []);
  return { sharedMuscles, sharedFatigueTags: (second?.fatigueTags ?? []).filter((tag) => firstTags.has(tag)) };
}

export function auditRobExercisePlanningTaxonomy(catalogue) {
  const taxonomy = createRobExercisePlanningTaxonomy(catalogue);
  const unknown = { primaryStimulus: [], secondaryStimulus: [], movementPattern: [], role: [], setupDemand: [] };
  const contradictions = [];
  for (const profile of taxonomy.profiles) {
    for (const field of Object.keys(unknown)) if (profile[field]?.status === "unknown" || profile[field]?.value === "unknown") unknown[field].push(profile.exerciseId);
    if (profile.role.value === "compound" && profile.movementPattern.value === "unknown") contradictions.push({ exerciseId: profile.exerciseId, code: "compound_without_pattern" });
    if (profile.role.value === "isolation" && ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "knee_dominant", "hinge"].includes(profile.movementPattern.value)) contradictions.push({ exerciseId: profile.exerciseId, code: "isolation_with_compound_pattern" });
    const source = (catalogue?.exercises ?? []).find((entry) => entry.id === profile.exerciseId);
    const name = String(source?.name ?? "").toLowerCase();
    const expectedPrimary = /lateral raise|front raise|rear delt/.test(name) ? "shoulders" : /biceps? curl/.test(name) ? "arms" : /triceps? extension/.test(name) ? "arms" : null;
    if (expectedPrimary && profile.primaryStimulus.contributions[0]?.muscleGroup !== expectedPrimary) contradictions.push({ exerciseId: profile.exerciseId, code: "name_primary_conflict", expectedPrimary, sourcePrimary: profile.primaryStimulus.contributions[0]?.muscleGroup ?? "unknown" });
  }
  const sourceIds = new Set((catalogue?.exercises ?? []).map((entry) => entry.id));
  const staleReviewedExceptions = Object.keys(ROB_EXERCISE_PLANNING_EXCEPTIONS).filter((id) => !matchingException((catalogue?.exercises ?? []).find((entry) => entry.id === id))).map((id) => ({ exerciseId: id, code: sourceIds.has(id) ? "reviewed_name_changed" : "reviewed_id_missing" }));
  const summary = (items) => ({ count: items.length, sampleExerciseIds: items.slice(0, 20) });
  const coverage = Object.fromEntries(Object.entries(unknown).map(([field, items]) => [field, { known: taxonomy.profiles.length - items.length, unknown: items.length }]));
  const lowConfidence = taxonomy.profiles.filter((profile) => profile.confidence === "low").map((profile) => profile.exerciseId);
  return { taxonomyVersion: taxonomy.taxonomyVersion, catalogueVersion: taxonomy.catalogueVersion, recordCount: taxonomy.profiles.length, confidence: Object.fromEntries(["high", "medium", "low"].map((level) => [level, taxonomy.profiles.filter((profile) => profile.confidence === level).length])), coverage, lowConfidence: summary(lowConfidence), unknown: Object.fromEntries(Object.entries(unknown).map(([field, items]) => [field, summary(items)])), contradictions, staleReviewedExceptions };
}
