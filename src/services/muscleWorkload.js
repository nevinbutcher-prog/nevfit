import catalogue from "../data/nevfitExerciseCatalogue.v1.json" with { type: "json" };

export const MUSCLE_GROUPS = [
  ["chest", "Chest"], ["back", "Back"], ["shoulders", "Shoulders"],
  ["biceps", "Biceps"], ["triceps", "Triceps"], ["forearms", "Forearms"],
  ["quadriceps", "Quads"], ["hamstrings", "Hamstrings"],
  ["glutes", "Glutes"], ["calves", "Calves"], ["core", "Core"],
  ["hip_adductors", "Adductors"], ["hip_abductors", "Abductors"],
];

export const DEFAULT_WORKLOAD_PERIOD = "last-seven-days";

// Historical WGER IDs stay intact. This reviewed movement is a calf raise;
// the mapping is analytics-only and never inferred from an exercise name.
const legacyWorkloadAttributions = new Map([
  ["wger-1466", { primary: ["calves"], secondary: [] }],
]);

const muscleRollups = {
  chest: "chest", serratus_anterior: "chest",
  lats: "back", upper_mid_back: "back", spinal_erectors: "back",
  teres_major: "back", upper_trapezius: "back", mid_trapezius: "back",
  lower_trapezius: "back", rhomboids: "back", quadratus_lumborum: "back",
  front_deltoids: "shoulders", side_deltoids: "shoulders",
  rear_deltoids: "shoulders", deltoids_unspecified: "shoulders", rotator_cuff: "shoulders",
  biceps: "biceps", brachialis: "biceps", triceps: "triceps",
  forearms: "forearms", brachioradialis: "forearms", forearm_flexors: "forearms",
  forearm_extensors: "forearms", forearm_rotators: "forearms",
  quadriceps: "quadriceps", hamstrings: "hamstrings", glutes: "glutes",
  gluteus_medius_minimus: "glutes", calves: "calves", gastrocnemius: "calves",
  soleus: "calves", abdominals: "core", obliques: "core",
  rectus_abdominis: "core", transverse_abdominis: "core",
  hip_flexors: "core", hip_adductors: "hip_adductors", hip_abductors: "hip_abductors",
};
const catalogueById = new Map(catalogue.entries.map((entry) => [entry.id, entry]));

export function getMuscleGroupId(muscleId) {
  return muscleRollups[muscleId] ?? null;
}

export function getWorkloadWindow(period, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  if (period === "last-seven-days") start.setDate(start.getDate() - 6);
  else {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (period === "last-week") start.setDate(start.getDate() - 7);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function getWorkloadGroups(exerciseId) {
  const legacyGroups = legacyWorkloadAttributions.get(exerciseId);
  if (legacyGroups) return {
    primary: [...legacyGroups.primary], secondary: [...legacyGroups.secondary],
  };
  const entry = catalogueById.get(exerciseId);
  if (!entry) return null;
  const primary = new Set((entry.primaryMuscles ?? []).map(getMuscleGroupId).filter(Boolean));
  if (primary.size === 0) return null;
  const secondary = new Set((entry.secondaryMuscles ?? []).map(getMuscleGroupId).filter(Boolean));
  for (const id of primary) secondary.delete(id);
  return { primary: [...primary], secondary: [...secondary] };
}

export function isCompletedWorkingSet(set) {
  if (!set || set.completed === false) return false;
  const reps = Number(set.reps);
  const weight = set.weight;
  return set.reps !== "" && Number.isFinite(reps) && reps > 0 &&
    (weight === "" || weight == null || (Number.isFinite(Number(weight)) && Number(weight) >= 0));
}

export function calculateMuscleWorkload(workouts, period = DEFAULT_WORKLOAD_PERIOD, now = new Date()) {
  const window = getWorkloadWindow(period, now);
  const groupMap = new Map(MUSCLE_GROUPS.map(([id, label]) => [id, {
    id, label, weightedSets: 0, completedSets: 0, exercises: new Map(),
  }]));
  const unattributed = new Map();
  let totalWorkingSets = 0;
  for (const workout of workouts ?? []) {
    const date = new Date(workout?.completedAt);
    if (!Number.isFinite(date.getTime()) || date < window.start || date >= window.end) continue;
    for (const exercise of workout.exercises ?? []) {
      const setCount = (exercise.sets ?? []).filter(isCompletedWorkingSet).length;
      if (!setCount) continue;
      totalWorkingSets += setCount;
      const id = exercise.exerciseId;
      const name = exercise.exerciseName || catalogueById.get(id)?.displayName || "Unknown exercise";
      const groups = getWorkloadGroups(id);
      if (!groups) {
        const key = `${id ?? "unknown"}:${name}`;
        const previous = unattributed.get(key);
        unattributed.set(key, { id, name, completedSets: setCount + (previous?.completedSets ?? 0) });
        continue;
      }
      for (const [groupIds, factor] of [[groups.primary, 1], [groups.secondary, 0.5]]) {
        for (const groupId of groupIds) {
          const group = groupMap.get(groupId);
          group.weightedSets += setCount * factor;
          group.completedSets += setCount;
          const key = `${id}:${name}`;
          const previous = group.exercises.get(key);
          group.exercises.set(key, {
            id, name, completedSets: setCount + (previous?.completedSets ?? 0),
            weightedSets: setCount * factor + (previous?.weightedSets ?? 0), factor,
          });
        }
      }
    }
  }
  const groups = [...groupMap.values()].map((group) => ({
    ...group, exercises: [...group.exercises.values()].sort((a, b) => b.weightedSets - a.weightedSets),
  })).sort((a, b) => b.weightedSets - a.weightedSets || a.label.localeCompare(b.label));
  const unattributedExercises = [...unattributed.values()].sort((a, b) => b.completedSets - a.completedSets);
  return {
    period, window, groups, totalWorkingSets,
    unattributedSets: unattributedExercises.reduce((sum, item) => sum + item.completedSets, 0),
    unattributedExercises,
  };
}
