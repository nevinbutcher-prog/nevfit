import { useEffect, useRef, useState } from "react";
import {
  signInWithGoogle,
  signOutUser,
  subscribeToAuthChanges,
} from "./services/auth";
import { runFirebaseSmokeTest } from "./services/firebaseSmokeTest";
import { ensureUserProfile } from "./services/userProfile";
import { starterProgram, starterPrograms } from "./data/programs";
import { weekSchedule } from "./data/weekSchedule";
import { getExerciseById, searchExercises } from "./services/exerciseProvider";

const SCHEDULE_STORAGE_KEY = "nevfit_schedule";
const PROGRAMS_STORAGE_KEY = "nevfit_programs";
const COMPLETED_WORKOUTS_STORAGE_KEY = "nevfit_completed_workouts";
const ACTIVE_WORKOUT_STORAGE_KEY = "nevfit_active_workout";
const ACTIVE_PROGRAM_STORAGE_KEY = "nevfit_active_program";
const CYCLE_START_DATE_STORAGE_KEY = "nevfit_cycle_start_date";
const CYCLE_LENGTH_WEEKS_STORAGE_KEY = "nevfit_cycle_length_weeks";
const STEPS_STORAGE_KEY = "nevfit_steps";
const RUNS_STORAGE_KEY = "nevfit_runs";
const WEEKLY_RUN_TARGET_STORAGE_KEY = "nevfit_weekly_run_target";
const DEFAULT_REST_SECONDS = 120;
const DEFAULT_CYCLE_LENGTH_WEEKS = 12;
const DEFAULT_WEEKLY_RUN_TARGET = 2;
const workoutNumberInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";
const routineEditorInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";
const routineEditorSelectClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400";

const getProgramDay = (dayId, programDefinitions) =>
  programDefinitions
    .flatMap((program) => program.days)
    .find((day) => day.id === dayId && !day.archived);

const getExerciseFromLibrary = (exerciseId, exerciseLibrary) =>
  exerciseLibrary.find((exercise) => exercise.id === exerciseId);

const defaultProgramId = starterProgram.id;
const dayIdsByDateIndex = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const isWgerExerciseId = (exerciseId) => exerciseId?.startsWith?.("wger-");
let hasRunFirebaseSmokeTest = false;

const setFeedbackStyles = {
  below: "border-red-500/70 bg-red-500/10 text-red-200 focus:border-red-400",
  within:
    "border-amber-400/70 bg-amber-400/10 text-amber-100 focus:border-amber-300",
  top: "border-emerald-400/80 bg-emerald-400/10 text-emerald-100 focus:border-emerald-300",
};

const setFeedbackLabels = {
  below: "Below target",
  within: "Target hit",
  top: "Top range",
};

const exerciseFeedbackStyles = {
  incomplete: "border-slate-700 bg-slate-900/80 text-slate-300",
  below: "border-red-500/60 bg-red-500/10 text-red-200",
  target: "border-amber-400/60 bg-amber-400/10 text-amber-100",
  progress: "border-emerald-400/70 bg-emerald-400/10 text-emerald-100",
};

function isValidSchedule(value) {
  return (
    Array.isArray(value) &&
    value.length === weekSchedule.length &&
    value.every((day, index) => {
      const defaultDay = weekSchedule[index];

      return (
        day &&
        day.id === defaultDay.id &&
        day.label === defaultDay.label &&
        (day.routineDayId === null || typeof day.routineDayId === "string") &&
        typeof day.note === "string"
      );
    })
  );
}

function loadStoredSchedule() {
  try {
    const storedSchedule = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);

    if (!storedSchedule) {
      return weekSchedule;
    }

    const parsedSchedule = JSON.parse(storedSchedule);

    return isValidSchedule(parsedSchedule) ? parsedSchedule : weekSchedule;
  } catch {
    return weekSchedule;
  }
}

function persistSchedule(schedule) {
  window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
}

function normalizeRoutineExercise(value) {
  if (
    !(
      value &&
      typeof value.exerciseId === "string" &&
      value.exerciseId.trim() &&
      isWgerExerciseId(value.exerciseId.trim())
    )
  ) {
    return null;
  }

  const sets = Number(value.sets);
  const restSeconds =
    value.restSeconds === null ||
    value.restSeconds === "" ||
    typeof value.restSeconds === "undefined"
      ? null
      : Number(value.restSeconds);

  if (!Number.isInteger(sets) || sets < 1 || sets > 12) {
    return null;
  }

  if (
    restSeconds !== null &&
    (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600)
  ) {
    return null;
  }

  const supersetGroupId =
    typeof value.supersetGroupId === "string" && value.supersetGroupId.trim()
      ? value.supersetGroupId.trim()
      : typeof value.groupId === "string" && value.groupId.trim()
        ? value.groupId.trim()
        : null;

  return {
    exerciseId: value.exerciseId.trim(),
    sets,
    repRange:
      typeof value.repRange === "string" && value.repRange.trim()
        ? value.repRange.trim()
        : "8-12",
    restSeconds,
    ...(typeof value.displayNameOverride === "string" &&
    value.displayNameOverride.trim()
      ? { displayNameOverride: value.displayNameOverride.trim() }
      : {}),
    ...(typeof value.note === "string" && value.note.trim()
      ? { note: value.note.trim() }
      : {}),
    supersetGroupId,
  };
}

function normalizeRoutineDay(value, fallbackDay = null) {
  if (
    !(
      value &&
      typeof value.id === "string" &&
      value.id.trim() &&
      typeof value.name === "string" &&
      value.name.trim()
    )
  ) {
    return null;
  }

  if (!Array.isArray(value.exercises)) {
    return null;
  }

  const exercises = cleanOrphanedSupersetGroups(
    value.exercises.map(normalizeRoutineExercise).filter(Boolean),
  );

  return {
    id: fallbackDay?.id ?? value.id.trim(),
    name: fallbackDay?.name ?? value.name.trim(),
    exercises,
    ...(fallbackDay ? {} : { archived: value.archived === true }),
  };
}

function normalizeProgram(value, fallbackProgram = null) {
  if (
    !(
      value &&
      typeof value.id === "string" &&
      value.id.trim() &&
      typeof value.name === "string" &&
      value.name.trim()
    )
  ) {
    return null;
  }

  if (!Array.isArray(value.days)) {
    return null;
  }

  const days = value.days
    .map((day, index) => {
      const defaultDay = fallbackProgram?.days?.[index] ?? null;
      return normalizeRoutineDay(day, defaultDay);
    })
    .filter(Boolean);

  return {
    id: fallbackProgram?.id ?? value.id.trim(),
    name: fallbackProgram?.name ?? value.name.trim(),
    days,
    ...(fallbackProgram ? {} : { archived: value.archived === true }),
  };
}

function normalizeProgramDefinitions(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.every((item) => item && Array.isArray(item.days))) {
    const normalizedPrograms = value
      .map((program) => normalizeProgram(program))
      .filter(Boolean);

    return normalizedPrograms.length ? normalizedPrograms : null;
  }

  if (value.every((item) => item && Array.isArray(item.exercises))) {
    const legacyProgram = normalizeProgram(
      {
        id: defaultProgramId,
        name: starterProgram.name,
        days: value,
      },
      starterProgram,
    );

    return legacyProgram ? [legacyProgram] : null;
  }

  return null;
}

function loadStoredPrograms() {
  try {
    const storedPrograms = window.localStorage.getItem(PROGRAMS_STORAGE_KEY);

    if (!storedPrograms) {
      return normalizeProgramDefinitions(starterPrograms) ?? starterPrograms;
    }

    const parsedPrograms = JSON.parse(storedPrograms);

    return normalizeProgramDefinitions(parsedPrograms) ?? starterPrograms;
  } catch {
    return starterPrograms;
  }
}

function persistPrograms(programDefinitions) {
  window.localStorage.setItem(
    PROGRAMS_STORAGE_KEY,
    JSON.stringify(programDefinitions),
  );
}

function loadStoredActiveProgramId() {
  try {
    const storedProgramId = window.localStorage.getItem(
      ACTIVE_PROGRAM_STORAGE_KEY,
    );

    return storedProgramId || defaultProgramId;
  } catch {
    return defaultProgramId;
  }
}

function loadStoredCycleStartDate() {
  try {
    const storedCycleStartDate = window.localStorage.getItem(
      CYCLE_START_DATE_STORAGE_KEY,
    );

    return storedCycleStartDate || "";
  } catch {
    return "";
  }
}

function loadStoredCycleLengthWeeks() {
  try {
    const storedCycleLengthWeeks = window.localStorage.getItem(
      CYCLE_LENGTH_WEEKS_STORAGE_KEY,
    );
    const parsedCycleLengthWeeks = Number(storedCycleLengthWeeks);

    return Number.isInteger(parsedCycleLengthWeeks) &&
      parsedCycleLengthWeeks > 0
      ? parsedCycleLengthWeeks
      : "";
  } catch {
    return "";
  }
}

function createProgramId(programName, existingPrograms) {
  const slug = programName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  const baseId = `custom-${slug || "program"}`;
  let nextId = `${baseId}-${suffix}`;
  let index = 2;

  while (existingPrograms.some((program) => program.id === nextId)) {
    nextId = `${baseId}-${suffix}-${index}`;
    index += 1;
  }

  return nextId;
}

function createProgramDayId(programId, dayName, existingPrograms) {
  const slug = dayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  const baseId = `${programId}-${slug || "day"}`;
  let nextId = `${baseId}-${suffix}`;
  let index = 2;
  const existingDayIds = new Set(
    existingPrograms.flatMap((program) => program.days.map((day) => day.id)),
  );

  while (existingDayIds.has(nextId)) {
    nextId = `${baseId}-${suffix}-${index}`;
    index += 1;
  }

  return nextId;
}

function createSupersetGroupId() {
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);

  return `ss-${suffix}`;
}

function cleanOrphanedSupersetGroups(exercises) {
  const groupCounts = exercises.reduce((counts, exercise) => {
    if (!exercise.supersetGroupId) {
      return counts;
    }

    counts.set(
      exercise.supersetGroupId,
      (counts.get(exercise.supersetGroupId) ?? 0) + 1,
    );

    return counts;
  }, new Map());

  return exercises.map((exercise) =>
    exercise.supersetGroupId &&
    (groupCounts.get(exercise.supersetGroupId) ?? 0) < 2
      ? { ...exercise, supersetGroupId: null }
      : exercise,
  );
}

function areRoutineDaysEqual(firstRoutineDay, secondRoutineDay) {
  return JSON.stringify(firstRoutineDay) === JSON.stringify(secondRoutineDay);
}

function getCurrentWeekdayId() {
  const currentWeekdayId = dayIdsByDateIndex[new Date().getDay()];

  return weekSchedule.some((day) => day.id === currentWeekdayId)
    ? currentWeekdayId
    : (weekSchedule[0]?.id ?? null);
}

function getTodayDateInputValue() {
  return getDateInputValue(new Date());
}

function getYesterdayDateInputValue() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getDateInputValue(yesterday);
}

function getDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStartOfWeek(date, firstDayId = weekSchedule[0]?.id ?? "mon") {
  const firstDayIndex = dayIdsByDateIndex.indexOf(firstDayId);
  const normalizedFirstDayIndex = firstDayIndex >= 0 ? firstDayIndex : 1;
  const startOfWeek = new Date(date);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(
    startOfWeek.getDate() -
      ((startOfWeek.getDay() - normalizedFirstDayIndex + 7) % 7),
  );

  return startOfWeek;
}

function getCompletedWorkoutsThisWeek(completedWorkouts) {
  const startOfWeek = getStartOfWeek(new Date());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return completedWorkouts.filter((workout) => {
    if (
      !workout.exercises.some((exercise) =>
        exercise.sets.some(hasMeaningfulLoggedEffort),
      )
    ) {
      return false;
    }

    const completedAt = new Date(workout.completedAt);

    return (
      !Number.isNaN(completedAt.getTime()) &&
      completedAt >= startOfWeek &&
      completedAt < endOfWeek
    );
  }).length;
}

function isSameDateInputValue(dateInputValue, date) {
  if (!dateInputValue) {
    return false;
  }

  const candidateDate = new Date(date);

  return (
    !Number.isNaN(candidateDate.getTime()) &&
    getDateInputValue(candidateDate) === dateInputValue
  );
}

function isValidDateInputValue(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function normalizeStoredSteps(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([date, steps]) => [date, Number(steps)])
      .filter(
        ([date, steps]) =>
          isValidDateInputValue(date) &&
          Number.isInteger(steps) &&
          steps >= 0,
      ),
  );
}

function loadStoredSteps() {
  try {
    const storedSteps = window.localStorage.getItem(STEPS_STORAGE_KEY);

    return storedSteps ? normalizeStoredSteps(JSON.parse(storedSteps)) : {};
  } catch {
    return {};
  }
}

function persistSteps(stepsByDate) {
  window.localStorage.setItem(STEPS_STORAGE_KEY, JSON.stringify(stepsByDate));
}

function getStepAverageForLastSevenDays(stepsByDate) {
  const today = new Date();
  const values = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - index);

    return stepsByDate[getDateInputValue(date)];
  }).filter((steps) => Number.isInteger(steps));

  if (values.length === 0) {
    return null;
  }

  return Math.round(
    values.reduce((total, steps) => total + steps, 0) / values.length,
  );
}

function getRecentStepEntries(stepsByDate) {
  return Object.entries(stepsByDate)
    .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate))
    .slice(0, 7)
    .map(([date, steps]) => ({ date, steps }));
}

function formatStepEntryDate(dateInputValue) {
  const date = new Date(`${dateInputValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateInputValue;
  }

  return date.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function normalizeStoredRuns(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((run) => {
      if (!run || typeof run !== "object" || !isValidDateInputValue(run.date)) {
        return null;
      }

      const distanceKm =
        run.distanceKm === null ||
        typeof run.distanceKm === "undefined" ||
        run.distanceKm === ""
          ? null
          : Number(run.distanceKm);
      const durationMinutes =
        run.durationMinutes === null ||
        typeof run.durationMinutes === "undefined" ||
        run.durationMinutes === ""
          ? null
          : Number(run.durationMinutes);

      if (
        (distanceKm !== null &&
          (!Number.isFinite(distanceKm) || distanceKm <= 0)) ||
        (durationMinutes !== null &&
          (!Number.isFinite(durationMinutes) || durationMinutes <= 0))
      ) {
        return null;
      }

      return {
        id:
          typeof run.id === "string" && run.id.trim()
            ? run.id
            : `run-${run.date}-${Date.now()}`,
        date: run.date,
        distanceKm,
        durationMinutes,
        notes: typeof run.notes === "string" ? run.notes : "",
      };
    })
    .filter(Boolean);
}

function loadStoredRuns() {
  try {
    const storedRuns = window.localStorage.getItem(RUNS_STORAGE_KEY);

    return storedRuns ? normalizeStoredRuns(JSON.parse(storedRuns)) : [];
  } catch {
    return [];
  }
}

function persistRuns(runs) {
  window.localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));
}

function loadStoredWeeklyRunTarget() {
  const target = Number(
    window.localStorage.getItem(WEEKLY_RUN_TARGET_STORAGE_KEY),
  );

  return [2, 3].includes(target) ? target : DEFAULT_WEEKLY_RUN_TARGET;
}

function persistWeeklyRunTarget(target) {
  window.localStorage.setItem(WEEKLY_RUN_TARGET_STORAGE_KEY, String(target));
}

function getRunsThisWeek(runs) {
  const startOfWeek = getStartOfWeek(new Date());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return runs.filter((run) => {
    const runDate = new Date(`${run.date}T00:00:00`);

    return (
      !Number.isNaN(runDate.getTime()) &&
      runDate >= startOfWeek &&
      runDate < endOfWeek
    );
  }).length;
}

function getRecentRuns(runs) {
  return [...runs]
    .sort((firstRun, secondRun) => secondRun.date.localeCompare(firstRun.date))
    .slice(0, 5);
}

function formatRecentRunDetails(run) {
  const details = [];

  if (run.distanceKm) {
    details.push(`${run.distanceKm.toLocaleString()} km`);
  }

  if (run.durationMinutes) {
    details.push(`${run.durationMinutes.toLocaleString()} min`);
  }

  return details.length > 0 ? details.join(" - ") : "Run logged";
}

function getCycleWeekLabel(cycleStartDate, cycleLengthWeeks) {
  if (!cycleStartDate || !cycleLengthWeeks) {
    return "Cycle not configured";
  }

  const startDate = new Date(`${cycleStartDate}T00:00:00`);

  if (Number.isNaN(startDate.getTime())) {
    return "Cycle not configured";
  }

  const elapsedMilliseconds = Date.now() - startDate.getTime();
  const elapsedWeeks = Math.max(
    0,
    Math.floor(elapsedMilliseconds / (7 * 24 * 60 * 60 * 1000)),
  );
  const currentWeek = Math.min(elapsedWeeks + 1, cycleLengthWeeks);

  return `Week ${currentWeek} of ${cycleLengthWeeks}`;
}

function formatCompletedRelativeDate(completedAt) {
  const completedDate = new Date(completedAt);

  if (Number.isNaN(completedDate.getTime())) {
    return "Completed recently";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedDay = new Date(completedDate);
  completedDay.setHours(0, 0, 0, 0);
  const dayDifference = Math.round(
    (today.getTime() - completedDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDifference === 0) {
    return "Completed today";
  }

  if (dayDifference === 1) {
    return "Completed yesterday";
  }

  if (dayDifference > 1 && dayDifference < 7) {
    return `Completed ${dayDifference} days ago`;
  }

  return completedDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function normalizeCompletedWorkout(value) {
  if (
    !(
      value &&
      typeof value.id === "string" &&
      typeof value.completedAt === "string" &&
      !Number.isNaN(Date.parse(value.completedAt)) &&
      typeof value.scheduleDayId === "string" &&
      typeof value.routineDayId === "string" &&
      typeof value.routineDayName === "string" &&
      Array.isArray(value.exercises)
    )
  ) {
    return null;
  }

  const exercises = value.exercises.map((exercise) => {
    if (
      !(
        exercise &&
        typeof exercise.exerciseId === "string" &&
        typeof exercise.exerciseName === "string" &&
        Array.isArray(exercise.sets)
      )
    ) {
      return null;
    }

    const sets = exercise.sets.map((set) => {
      if (
        !(
          set &&
          typeof set.setNumber === "number" &&
          typeof set.weight === "string" &&
          typeof set.reps === "string"
        )
      ) {
        return null;
      }

      return {
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
      };
    });

    if (sets.some((set) => !set)) {
      return null;
    }

    return {
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      restSeconds:
        typeof exercise.restSeconds === "number" ? exercise.restSeconds : null,
      supersetGroupId:
        typeof exercise.supersetGroupId === "string"
          ? exercise.supersetGroupId
          : null,
      sets,
    };
  });

  if (exercises.some((exercise) => !exercise)) {
    return null;
  }

  return {
    id: value.id,
    completedAt: value.completedAt,
    scheduleDayId: value.scheduleDayId,
    routineDayId: value.routineDayId,
    routineDayName: value.routineDayName,
    exercises,
  };
}

function parseStoredCompletedWorkouts({ throwOnError = false } = {}) {
  try {
    const storedWorkouts = window.localStorage.getItem(
      COMPLETED_WORKOUTS_STORAGE_KEY,
    );

    if (!storedWorkouts) {
      return [];
    }

    const parsedWorkouts = JSON.parse(storedWorkouts);

    return Array.isArray(parsedWorkouts)
      ? parsedWorkouts.map(normalizeCompletedWorkout).filter(Boolean)
      : [];
  } catch (error) {
    if (throwOnError) {
      throw error;
    }

    return [];
  }
}

function loadCompletedWorkouts() {
  return parseStoredCompletedWorkouts();
}

function readPersistedCompletedWorkoutsForSave() {
  return parseStoredCompletedWorkouts({ throwOnError: true });
}

function persistCompletedWorkouts(completedWorkouts) {
  window.localStorage.setItem(
    COMPLETED_WORKOUTS_STORAGE_KEY,
    JSON.stringify(completedWorkouts),
  );
}

function hasMeaningfulLoggedEffort(set) {
  const reps = Number(set?.reps);
  const weight = Number(set?.weight);

  return (
    (Number.isFinite(reps) && reps > 0) ||
    (Number.isFinite(weight) && weight > 0)
  );
}

function hasWorkoutLoggedEffort(workoutSession) {
  return workoutSession.exercises.some((exercise) =>
    exercise.sets.some(hasMeaningfulLoggedEffort),
  );
}

function createWorkoutSession(scheduleDay, routineDay, exerciseLibrary = []) {
  return {
    scheduleDayId: scheduleDay.id,
    routineDayId: routineDay.id,
    exercises: routineDay.exercises.map((exercise) => {
      const sourceExercise = getExerciseFromLibrary(
        exercise.exerciseId,
        exerciseLibrary,
      );

      return {
        exerciseId: exercise.exerciseId,
        exerciseName: getEffectiveExerciseName(exercise, sourceExercise),
        prescribedSets: exercise.sets,
        repRange: exercise.repRange,
        note: exercise.note,
        restSeconds: exercise.restSeconds,
        supersetGroupId: exercise.supersetGroupId ?? null,
        sets: Array.from({ length: exercise.sets }, (_, index) => ({
          setNumber: index + 1,
          weight: "",
          reps: "",
        })),
      };
    }),
  };
}

function getEffectiveExerciseName(routineExercise, sourceExercise) {
  return (
    routineExercise.displayNameOverride?.trim() ||
    sourceExercise?.name ||
    "Unknown exercise"
  );
}

function getRoutineExerciseName(routineExercise, exerciseLibrary) {
  return getEffectiveExerciseName(
    routineExercise,
    getExerciseFromLibrary(routineExercise.exerciseId, exerciseLibrary),
  );
}

function getSupersetPartnerNames(exercises, exerciseIndex, exerciseLibrary) {
  const groupId = exercises[exerciseIndex]?.supersetGroupId;

  if (!groupId) {
    return [];
  }

  return exercises
    .map((exercise, index) =>
      index !== exerciseIndex && exercise.supersetGroupId === groupId
        ? getRoutineExerciseName(exercise, exerciseLibrary)
        : null,
    )
    .filter(Boolean);
}

function createRoutineExerciseFromCatalog(exercise) {
  return {
    exerciseId: exercise.id,
    sets: exercise.defaultSets ?? 3,
    repRange: exercise.defaultRepRange ?? "8-12",
    restSeconds: exercise.defaultRestSeconds ?? DEFAULT_REST_SECONDS,
    supersetGroupId: null,
  };
}

function groupWorkoutExercises(exercises) {
  const groupCounts = exercises.reduce((counts, exercise) => {
    if (!exercise.supersetGroupId) {
      return counts;
    }

    counts.set(
      exercise.supersetGroupId,
      (counts.get(exercise.supersetGroupId) ?? 0) + 1,
    );

    return counts;
  }, new Map());
  const renderedGroupIds = new Set();

  return exercises
    .map((exercise, index) => {
      const groupId = exercise.supersetGroupId;

      if (!groupId || (groupCounts.get(groupId) ?? 0) < 2) {
        return {
          type: "single",
          key: `single-${exercise.exerciseId}-${index}`,
          exercises: [{ exercise, index }],
        };
      }

      if (renderedGroupIds.has(groupId)) {
        return null;
      }

      renderedGroupIds.add(groupId);

      return {
        type: "superset",
        key: groupId,
        exercises: exercises
          .map((groupExercise, groupIndex) =>
            groupExercise.supersetGroupId === groupId
              ? { exercise: groupExercise, index: groupIndex }
              : null,
          )
          .filter(Boolean),
      };
    })
    .filter(Boolean);
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <p className="text-base font-semibold text-slate-300">
        Loading NevFit...
      </p>
    </main>
  );
}

function SignInScreen({ onSignIn }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <section className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h1 className="text-4xl font-bold">NevFit</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Sign in to access your workout programs, schedule, and history.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-5 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Sign in with Google
        </button>
      </section>
    </main>
  );
}

function getInstructionExcerpt(instructions, maxLength = 140) {
  if (!instructions) {
    return "";
  }

  const normalizedInstructions = instructions.replace(/\s+/g, " ").trim();

  if (normalizedInstructions.length <= maxLength) {
    return normalizedInstructions;
  }

  return `${normalizedInstructions.slice(0, maxLength).trim()}...`;
}

function ExerciseImage({ exercise, className }) {
  const [hasImageError, setHasImageError] = useState(false);

  if (!exercise?.imageUrl || hasImageError) {
    return null;
  }

  return (
    <img
      src={exercise.imageUrl}
      alt={exercise.name}
      loading="lazy"
      onError={() => setHasImageError(true)}
      className={className}
    />
  );
}

function ExerciseMetadata({
  exercise,
  includeInstructions = true,
  instructionMode = "excerpt",
}) {
  if (!exercise) {
    return null;
  }

  const metadataRows = [
    ["Primary", exercise.primaryMuscle],
    [
      "Secondary",
      (exercise.secondaryMuscles ?? []).filter(Boolean).join(", "),
    ],
    ["Equipment", (exercise.equipment ?? []).filter(Boolean).join(", ")],
  ].filter(([, value]) => value);
  const instructionText = includeInstructions
    ? instructionMode === "full"
      ? exercise.instructions
      : getInstructionExcerpt(exercise.instructions)
    : "";
  const mainImage = exercise.images?.find((image) => image.url === exercise.imageUrl);
  const imageCredit = [
    mainImage?.licenseAuthor ? `Image credit: ${mainImage.licenseAuthor}` : "",
    mainImage?.license,
  ]
    .filter(Boolean)
    .join(" - ");

  if (
    !metadataRows.length &&
    !instructionText &&
    !exercise.imageUrl &&
    !imageCredit
  ) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <ExerciseImage
        exercise={exercise}
        className="h-24 w-full rounded-lg border border-slate-800 object-cover sm:w-32"
      />
      <div className="min-w-0 text-sm text-slate-400">
        {metadataRows.map(([label, value]) => (
          <p key={label}>
            <span className="font-semibold text-slate-300">{label}:</span>{" "}
            {value}
          </p>
        ))}
        {instructionText ? (
          <p className="mt-2 whitespace-pre-line leading-6 text-slate-400">
            {instructionText}
          </p>
        ) : null}
        {imageCredit ? (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {imageCredit}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function getCompactExerciseMetadata(exercise) {
  return [
    exercise?.primaryMuscle,
    ...(exercise?.equipment ?? []),
  ]
    .filter(Boolean)
    .join(" - ");
}

function getEquipmentFilterValue(equipment) {
  const normalizedEquipment = equipment.toLowerCase();

  if (normalizedEquipment.includes("dumbbell")) {
    return "Dumbbell";
  }

  if (normalizedEquipment.includes("barbell")) {
    return "Barbell";
  }

  if (normalizedEquipment.includes("cable")) {
    return "Cable";
  }

  if (normalizedEquipment.includes("bodyweight")) {
    return "Bodyweight";
  }

  if (normalizedEquipment.includes("machine")) {
    return "Machine";
  }

  if (normalizedEquipment.includes("kettlebell")) {
    return "Kettlebell";
  }

  if (normalizedEquipment.includes("band")) {
    return "Band";
  }

  return equipment;
}

function getSortedUniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((first, second) =>
    first.localeCompare(second),
  );
}

function isValidWorkoutSession(value) {
  return (
    value &&
    typeof value.scheduleDayId === "string" &&
    typeof value.routineDayId === "string" &&
    Array.isArray(value.exercises) &&
    value.exercises.every(
      (exercise) =>
        exercise &&
        typeof exercise.exerciseId === "string" &&
        isWgerExerciseId(exercise.exerciseId) &&
        (typeof exercise.exerciseName === "string" ||
          typeof exercise.exerciseName === "undefined") &&
        typeof exercise.prescribedSets === "number" &&
        typeof exercise.repRange === "string" &&
        (typeof exercise.note === "string" ||
          typeof exercise.note === "undefined") &&
        (typeof exercise.restSeconds === "number" ||
          typeof exercise.restSeconds === "undefined") &&
        (typeof exercise.supersetGroupId === "string" ||
          exercise.supersetGroupId === null ||
          typeof exercise.supersetGroupId === "undefined") &&
        Array.isArray(exercise.sets) &&
        exercise.sets.every(
          (set) =>
            set &&
            typeof set.setNumber === "number" &&
            typeof set.weight === "string" &&
            typeof set.reps === "string",
        ),
    )
  );
}

function loadStoredActiveWorkoutSession() {
  try {
    const storedSession = window.localStorage.getItem(
      ACTIVE_WORKOUT_STORAGE_KEY,
    );

    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession);

    return isValidWorkoutSession(parsedSession) ? parsedSession : null;
  } catch {
    return null;
  }
}

function persistActiveWorkoutSession(workoutSession) {
  if (!workoutSession) {
    window.localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ACTIVE_WORKOUT_STORAGE_KEY,
    JSON.stringify(workoutSession),
  );
}

function createCompletedWorkoutRecord(
  workoutSession,
  routineDay,
  completedAt,
  exerciseLibrary,
) {
  const workoutId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `workout-${completedAt.getTime()}`;

  return {
    id: workoutId,
    completedAt: completedAt.toISOString(),
    scheduleDayId: workoutSession.scheduleDayId,
    routineDayId: workoutSession.routineDayId,
    routineDayName: routineDay.name,
    exercises: workoutSession.exercises.map((sessionExercise) => {
      const exercise = getExerciseFromLibrary(
        sessionExercise.exerciseId,
        exerciseLibrary,
      );

      return {
        exerciseId: sessionExercise.exerciseId,
        exerciseName:
          sessionExercise.exerciseName ?? exercise?.name ?? "Unknown exercise",
        restSeconds: sessionExercise.restSeconds ?? null,
        supersetGroupId: sessionExercise.supersetGroupId ?? null,
        sets: sessionExercise.sets.map((set) => ({
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
        })),
      };
    }),
  };
}

function getPreviousExercisePerformance(
  exerciseId,
  routineDayId,
  completedWorkouts,
) {
  return completedWorkouts.reduce((latestPerformance, completedWorkout) => {
    if (completedWorkout.routineDayId !== routineDayId) {
      return latestPerformance;
    }

    const exercisePerformance = completedWorkout.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId,
    );

    if (
      !exercisePerformance ||
      !exercisePerformance.sets.some(hasMeaningfulLoggedEffort)
    ) {
      return latestPerformance;
    }

    if (
      !latestPerformance ||
      Date.parse(completedWorkout.completedAt) >
        Date.parse(latestPerformance.completedAt)
    ) {
      return {
        completedAt: completedWorkout.completedAt,
        sets: exercisePerformance.sets,
      };
    }

    return latestPerformance;
  }, null);
}

function parseRepRange(repRange) {
  const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(repRange);

  if (!rangeMatch) {
    return null;
  }

  const min = Number(rangeMatch[1]);
  const max = Number(rangeMatch[2]);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return null;
  }

  return { min, max };
}

function getSetReps(set) {
  if (set.reps === "") {
    return null;
  }

  const reps = Number(set.reps);

  return Number.isFinite(reps) ? reps : null;
}

function getSetFeedback(set, repRange) {
  const reps = getSetReps(set);

  if (reps === null || !repRange) {
    return null;
  }

  if (reps < repRange.min) {
    return "below";
  }

  if (reps >= repRange.max) {
    return "top";
  }

  return "within";
}

function getExerciseFeedback(sessionExercise) {
  const repRange = parseRepRange(sessionExercise.repRange);

  if (!repRange) {
    return null;
  }

  const enteredReps = sessionExercise.sets.map(getSetReps);
  const enteredCount = enteredReps.filter((reps) => reps !== null).length;

  if (enteredCount < sessionExercise.sets.length) {
    return {
      status: "incomplete",
      label:
        enteredCount === 0
          ? "Enter reps for feedback"
          : `${enteredCount}/${sessionExercise.sets.length} sets entered`,
    };
  }

  if (enteredReps.some((reps) => reps < repRange.min)) {
    return {
      status: "below",
      label: "Below Target Range",
    };
  }

  if (enteredReps.every((reps) => reps >= repRange.max)) {
    return {
      status: "progress",
      label: "Increase Weight Next Time",
    };
  }

  return {
    status: "target",
    label: "Target Achieved",
  };
}

function formatTimerSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFinishedTime(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const timerSounds = {
  restComplete: {
    src: "/sounds/rest-complete.wav",
    repeatDelayMs: 2900,
    volume: 1,
  },
};

let preparedRestCompleteAudio = null;

function prepareTimerCompleteSound() {
  try {
    preparedRestCompleteAudio ??= new Audio(timerSounds.restComplete.src);
    preparedRestCompleteAudio.preload = "auto";
    preparedRestCompleteAudio.volume = timerSounds.restComplete.volume;
    preparedRestCompleteAudio.load();
  } catch {
    // Visual completion feedback is enough if the browser blocks audio.
  }
}

function playAlertAudio(src, volume = 1) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;

    void audio.play();
  } catch {
    // Visual completion feedback is enough if the browser blocks audio.
  }
}

function playTimerCompleteSound() {
  const { src, repeatDelayMs, volume } = timerSounds.restComplete;

  playAlertAudio(src, volume);
  window.setTimeout(() => playAlertAudio(src, volume), repeatDelayMs);

  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch {
    // Vibration support varies by browser and device.
  }
}

function App() {
  const [schedule, setSchedule] = useState(loadStoredSchedule);
  const [programDefinitions, setProgramDefinitions] =
    useState(loadStoredPrograms);
  const [programDrafts, setProgramDrafts] = useState(loadStoredPrograms);
  const [selectedProgramId, setSelectedProgramId] = useState(
    loadStoredActiveProgramId,
  );
  const [selectedProgramDayId, setSelectedProgramDayId] = useState(
    starterProgram.days[0]?.id ?? null,
  );
  const [newProgramName, setNewProgramName] = useState("");
  const [isProgramCreatorOpen, setIsProgramCreatorOpen] = useState(false);
  const [isProgramEditorOpen, setIsProgramEditorOpen] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [exerciseEquipmentFilter, setExerciseEquipmentFilter] = useState("all");
  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState("all");
  const [exerciseFinderOpen, setExerciseFinderOpen] = useState(false);
  const [exerciseFinderMode, setExerciseFinderMode] = useState({
    type: "add",
    exerciseIndex: null,
  });
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [exerciseSearchResults, setExerciseSearchResults] = useState([]);
  const [exerciseSearchStatus, setExerciseSearchStatus] = useState("idle");
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState(null);
  const [completedWorkouts, setCompletedWorkouts] = useState(
    loadCompletedWorkouts,
  );
  const [stepsByDate, setStepsByDate] = useState(loadStoredSteps);
  const [stepEntryDate, setStepEntryDate] = useState(
    getYesterdayDateInputValue,
  );
  const [stepEntryValue, setStepEntryValue] = useState("");
  const [stepSaveMessage, setStepSaveMessage] = useState("");
  const [runs, setRuns] = useState(loadStoredRuns);
  const [weeklyRunTarget, setWeeklyRunTarget] = useState(
    loadStoredWeeklyRunTarget,
  );
  const [runEntryDate, setRunEntryDate] = useState(getTodayDateInputValue);
  const [runDistanceKm, setRunDistanceKm] = useState("");
  const [runDurationMinutes, setRunDurationMinutes] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [runSaveMessage, setRunSaveMessage] = useState("");
  const [expandedDashboardEntry, setExpandedDashboardEntry] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState(getCurrentWeekdayId);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState(
    loadStoredActiveWorkoutSession,
  );
  const [viewMode, setViewMode] = useState(() =>
    loadStoredActiveWorkoutSession() ? "workout" : "dashboard",
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [programSaveStatus, setProgramSaveStatus] = useState(null);
  const [cycleStartDate, setCycleStartDate] = useState(
    loadStoredCycleStartDate,
  );
  const [cycleLengthWeeks, setCycleLengthWeeks] = useState(
    loadStoredCycleLengthWeeks,
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCycleEditorOpen, setIsCycleEditorOpen] = useState(false);
  const [restTimer, setRestTimer] = useState(null);
  const [pendingWorkoutAction, setPendingWorkoutAction] = useState(null);
  const [selectedCompletedWorkoutId, setSelectedCompletedWorkoutId] =
    useState(null);
  const [expandedWorkoutDetailsExerciseId, setExpandedWorkoutDetailsExerciseId] =
    useState(null);
  const wakeLockRef = useRef(null);
  const initialSelectedDayScrollDoneRef = useRef(false);
  const selectedDayCardRef = useRef(null);
  const lastProfileSyncUidRef = useRef(null);
  const exerciseSearchInputRef = useRef(null);
  const isWorkoutActive =
    viewMode === "workout" && Boolean(activeWorkoutSession);
  const getExercise = (exerciseId) =>
    getExerciseFromLibrary(exerciseId, exerciseLibrary);

  useEffect(() => {
    if (!import.meta.env.DEV || hasRunFirebaseSmokeTest) {
      return;
    }

    hasRunFirebaseSmokeTest = true;

    runFirebaseSmokeTest().catch((error) => {
      console.error("Firebase smoke test failed:", error);
    });
  }, []);

  useEffect(
    () =>
      subscribeToAuthChanges((user) => {
        setCurrentUser(user);
        setAuthLoading(false);
      }),
    [],
  );

  useEffect(() => {
    if (!currentUser) {
      lastProfileSyncUidRef.current = null;
      return;
    }

    if (lastProfileSyncUidRef.current === currentUser.uid) {
      return;
    }

    lastProfileSyncUidRef.current = currentUser.uid;

    ensureUserProfile(currentUser).catch((error) => {
      console.error("User profile sync failed:", error);
      lastProfileSyncUidRef.current = null;
    });
  }, [currentUser]);

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(""), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    if (!programSaveStatus) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setProgramSaveStatus(null), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [programSaveStatus]);

  useEffect(() => {
    setExpandedExerciseIndex(null);
  }, [selectedProgramDayId]);

  useEffect(() => {
    if (!stepSaveMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setStepSaveMessage(""), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [stepSaveMessage]);

  useEffect(() => {
    if (!runSaveMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setRunSaveMessage(""), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [runSaveMessage]);

  useEffect(() => {
    if (!exerciseFinderOpen) {
      return undefined;
    }

    const focusTimeoutId = window.setTimeout(() => {
      exerciseSearchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimeoutId);
  }, [exerciseFinderOpen, selectedProgramDayId]);

  useEffect(() => {
    if (!exerciseFinderOpen) {
      return undefined;
    }

    let isCurrentSearch = true;
    const timeoutId = window.setTimeout(() => {
      setExerciseSearchStatus("loading");

      searchExercises(exerciseSearchTerm, {
        equipment: "all",
        muscle: exerciseMuscleFilter,
      })
        .then((results) => {
          if (!isCurrentSearch) {
            return;
          }

          setExerciseSearchResults(results);
          setExerciseLibrary((currentLibrary) => {
            const exercisesById = new Map(
              currentLibrary.map((exercise) => [exercise.id, exercise]),
            );

            results.forEach((exercise) =>
              exercisesById.set(exercise.id, exercise),
            );

            return Array.from(exercisesById.values());
          });
          setExerciseSearchStatus("ready");
        })
        .catch(() => {
          if (!isCurrentSearch) {
            return;
          }

          setExerciseSearchResults([]);
          setExerciseSearchStatus("error");
        });
    }, 250);

    return () => {
      isCurrentSearch = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    exerciseEquipmentFilter,
    exerciseFinderOpen,
    exerciseMuscleFilter,
    exerciseSearchTerm,
  ]);

  useEffect(() => {
    const referencedExerciseIds = new Set(
      programDrafts.flatMap((program) =>
        program.days.flatMap((day) =>
          day.exercises.map((exercise) => exercise.exerciseId),
        ),
      ),
    );
    const missingExerciseIds = Array.from(referencedExerciseIds).filter(
      (exerciseId) => !getExerciseFromLibrary(exerciseId, exerciseLibrary),
    );

    if (!missingExerciseIds.length) {
      return undefined;
    }

    let shouldApplyResults = true;

    Promise.all(
      missingExerciseIds.map((exerciseId) => getExerciseById(exerciseId)),
    )
      .then((exercises) => {
        if (!shouldApplyResults) {
          return;
        }

        const foundExercises = exercises.filter(Boolean);

        if (!foundExercises.length) {
          return;
        }

        setExerciseLibrary((currentLibrary) => {
          const exercisesById = new Map(
            currentLibrary.map((exercise) => [exercise.id, exercise]),
          );

          foundExercises.forEach((exercise) =>
            exercisesById.set(exercise.id, exercise),
          );

          return Array.from(exercisesById.values());
        });
      })
      .catch(() => {});

    return () => {
      shouldApplyResults = false;
    };
  }, [exerciseLibrary, programDrafts]);

  useEffect(() => {
    persistActiveWorkoutSession(activeWorkoutSession);
  }, [activeWorkoutSession]);

  useEffect(() => {
    if (!selectedProgramId) {
      window.localStorage.removeItem(ACTIVE_PROGRAM_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_PROGRAM_STORAGE_KEY, selectedProgramId);
  }, [selectedProgramId]);

  useEffect(() => {
    if (!cycleStartDate) {
      window.localStorage.removeItem(CYCLE_START_DATE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CYCLE_START_DATE_STORAGE_KEY, cycleStartDate);
  }, [cycleStartDate]);

  useEffect(() => {
    if (!cycleLengthWeeks) {
      window.localStorage.removeItem(CYCLE_LENGTH_WEEKS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      CYCLE_LENGTH_WEEKS_STORAGE_KEY,
      String(cycleLengthWeeks),
    );
  }, [cycleLengthWeeks]);

  useEffect(() => {
    if (
      viewMode !== "planner" ||
      initialSelectedDayScrollDoneRef.current ||
      !selectedDayCardRef.current
    ) {
      return;
    }

    initialSelectedDayScrollDoneRef.current = true;
    selectedDayCardRef.current.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  }, [viewMode, selectedDayId]);

  useEffect(() => {
    if (!activeWorkoutSession) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeWorkoutSession]);

  useEffect(() => {
    if (
      viewMode !== "workout" ||
      !restTimer ||
      restTimer.paused ||
      restTimer.status !== "running"
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRestTimer((currentTimer) => {
        if (
          !currentTimer ||
          currentTimer.paused ||
          currentTimer.status !== "running"
        ) {
          return currentTimer;
        }

        if (currentTimer.remainingSeconds <= 1) {
          return {
            ...currentTimer,
            remainingSeconds: 0,
            paused: false,
            status: "complete",
          };
        }

        return {
          ...currentTimer,
          remainingSeconds: currentTimer.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [restTimer, viewMode]);

  useEffect(() => {
    if (restTimer?.status !== "complete") {
      return undefined;
    }

    playTimerCompleteSound();

    const timeoutId = window.setTimeout(() => setRestTimer(null), 6500);

    return () => window.clearTimeout(timeoutId);
  }, [restTimer?.status]);

  useEffect(() => {
    if (!isWorkoutActive || !("wakeLock" in navigator)) {
      return undefined;
    }

    let shouldKeepAwake = true;

    async function requestWakeLock() {
      if (
        !shouldKeepAwake ||
        wakeLockRef.current ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        wakeLockRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    }

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      shouldKeepAwake = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      const wakeLock = wakeLockRef.current;
      wakeLockRef.current = null;

      if (wakeLock) {
        void wakeLock.release().catch(() => {});
      }
    };
  }, [isWorkoutActive]);

  useEffect(() => {
    if (
      programDefinitions.some((program) => program.id === selectedProgramId)
    ) {
      return;
    }

    const nextProgramId =
      programDefinitions.find((program) => !program.archived)?.id ??
      programDefinitions[0]?.id ??
      null;

    setSelectedProgramId(nextProgramId);
  }, [programDefinitions, selectedProgramId]);

  useEffect(() => {
    if (selectedProgramId) {
      return;
    }

    setIsProgramEditorOpen(false);
  }, [selectedProgramId]);

  useEffect(() => {
    const selectedProgram = programDrafts.find(
      (program) => program.id === selectedProgramId,
    );

    if (!selectedProgram) {
      return;
    }

    if (selectedProgram.days.some((day) => day.id === selectedProgramDayId)) {
      return;
    }

    setSelectedProgramDayId(selectedProgram.days[0]?.id ?? null);
  }, [programDrafts, selectedProgramDayId, selectedProgramId]);

  function applyRoutineAssignment(dayId, routineDayId) {
    setSchedule((currentSchedule) => {
      const nextSchedule = currentSchedule.map((day) =>
        day.id === dayId
          ? {
              ...day,
              routineDayId,
              note: routineDayId ? "" : "Rest",
            }
          : day,
      );

      persistSchedule(nextSchedule);

      return nextSchedule;
    });
  }

  async function handleSignInWithGoogle() {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in failed:", error);
    }
  }

  async function handleSignOut() {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Google sign-out failed:", error);
    }
  }

  function saveStepEntry() {
    const normalizedStepValue = stepEntryValue.trim();

    if (!isValidDateInputValue(stepEntryDate)) {
      setStepSaveMessage("Choose a valid date.");
      return;
    }

    if (!/^\d+$/.test(normalizedStepValue)) {
      setStepSaveMessage("Enter a non-negative whole number.");
      return;
    }

    const steps = Number(normalizedStepValue);

    if (!Number.isSafeInteger(steps)) {
      setStepSaveMessage("Enter a smaller step count.");
      return;
    }

    const nextStepsByDate = {
      ...stepsByDate,
      [stepEntryDate]: steps,
    };

    try {
      persistSteps(nextStepsByDate);
      setStepsByDate(nextStepsByDate);
      setStepSaveMessage("Steps saved.");
    } catch {
      setStepSaveMessage("Steps could not be saved.");
    }
  }

  function updateWeeklyRunTarget(target) {
    setWeeklyRunTarget(target);
    persistWeeklyRunTarget(target);
  }

  function saveRunEntry() {
    const normalizedDistance = runDistanceKm.trim();
    const normalizedDuration = runDurationMinutes.trim();
    const distanceKm = normalizedDistance ? Number(normalizedDistance) : null;
    const durationMinutes = normalizedDuration
      ? Number(normalizedDuration)
      : null;

    if (!isValidDateInputValue(runEntryDate)) {
      setRunSaveMessage("Choose a valid date.");
      return;
    }

    if (
      normalizedDistance &&
      (!Number.isFinite(distanceKm) || distanceKm <= 0)
    ) {
      setRunSaveMessage("Distance must be positive.");
      return;
    }

    if (
      normalizedDuration &&
      (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
    ) {
      setRunSaveMessage("Duration must be positive.");
      return;
    }

    const createdAt = new Date();
    const nextRun = {
      id: `run-${runEntryDate}-${createdAt.getTime()}`,
      date: runEntryDate,
      distanceKm,
      durationMinutes,
      notes: runNotes.trim(),
    };
    const nextRuns = [nextRun, ...runs];

    try {
      persistRuns(nextRuns);
      setRuns(nextRuns);
      setRunDistanceKm("");
      setRunDurationMinutes("");
      setRunNotes("");
      setRunSaveMessage("Run saved.");
    } catch {
      setRunSaveMessage("Run could not be saved.");
    }
  }

  function updateProgramDay(programId, dayId, patch) {
    setProgramSaveStatus(null);
    setProgramDrafts((currentDrafts) =>
      currentDrafts.map((program) =>
        program.id === programId
          ? {
              ...program,
              days: program.days.map((day) =>
                day.id === dayId ? { ...day, ...patch } : day,
              ),
            }
          : program,
      ),
    );
  }

  function updateProgramName(programId, name) {
    setProgramSaveStatus(null);
    setProgramDrafts((currentDrafts) =>
      currentDrafts.map((program) =>
        program.id === programId ? { ...program, name } : program,
      ),
    );
  }

  function moveProgramExercise(programId, dayId, exerciseIndex, direction) {
    setProgramSaveStatus(null);
    setProgramDrafts((currentDrafts) =>
      currentDrafts.map((program) => {
        if (program.id !== programId) {
          return program;
        }

        return {
          ...program,
          days: program.days.map((day) => {
            if (day.id !== dayId) {
              return day;
            }

            const nextIndex = exerciseIndex + direction;

            if (nextIndex < 0 || nextIndex >= day.exercises.length) {
              return day;
            }

            const nextExercises = [...day.exercises];
            const [movedExercise] = nextExercises.splice(exerciseIndex, 1);
            nextExercises.splice(nextIndex, 0, movedExercise);

            return {
              ...day,
              exercises: nextExercises,
            };
          }),
        };
      }),
    );
  }

  function removeProgramExercise(programId, dayId, exerciseIndex) {
    setProgramSaveStatus(null);
    setProgramDrafts((currentDrafts) =>
      currentDrafts.map((program) =>
        program.id === programId
          ? {
              ...program,
              days: program.days.map((day) =>
                day.id === dayId
                  ? {
                      ...day,
                      exercises: cleanOrphanedSupersetGroups(
                        day.exercises.filter(
                          (_, index) => index !== exerciseIndex,
                        ),
                      ),
                    }
                  : day,
              ),
            }
          : program,
      ),
    );
  }

  function updateExerciseSuperset(programId, dayId, exerciseIndex, pairedIndex) {
    setProgramSaveStatus(null);
    setProgramDrafts((currentDrafts) =>
      currentDrafts.map((program) => {
        if (program.id !== programId) {
          return program;
        }

        return {
          ...program,
          days: program.days.map((day) => {
            if (day.id !== dayId) {
              return day;
            }

            if (!day.exercises[exerciseIndex]) {
              return day;
            }

            const nextExercises = day.exercises.map((exercise) => ({
              ...exercise,
            }));

            if (pairedIndex === null) {
              nextExercises[exerciseIndex].supersetGroupId = null;

              return {
                ...day,
                exercises: cleanOrphanedSupersetGroups(nextExercises),
              };
            }

            if (
              pairedIndex === exerciseIndex ||
              !nextExercises[pairedIndex]
            ) {
              return day;
            }

            const currentGroupId = nextExercises[exerciseIndex].supersetGroupId;
            const pairedGroupId = nextExercises[pairedIndex].supersetGroupId;
            const nextGroupId =
              pairedGroupId ?? currentGroupId ?? createSupersetGroupId();

            nextExercises[exerciseIndex].supersetGroupId = nextGroupId;
            nextExercises[pairedIndex].supersetGroupId = nextGroupId;

            return {
              ...day,
              exercises: cleanOrphanedSupersetGroups(nextExercises),
            };
          }),
        };
      }),
    );
  }

  function selectExerciseFromFinder(programId, dayId, exercise, exerciseIndex) {
    if (!exercise) {
      return;
    }

    setExerciseLibrary((currentLibrary) => {
      if (getExerciseFromLibrary(exercise.id, currentLibrary)) {
        return currentLibrary;
      }

      return [...currentLibrary, exercise];
    });

    if (typeof exerciseIndex === "number") {
      updateProgramDay(programId, dayId, {
        exercises: selectedProgramDayDraft.exercises.map(
          (routineExercise, index) =>
            index === exerciseIndex
              ? {
                  ...routineExercise,
                  exerciseId: exercise.id,
                  displayNameOverride: "",
                }
              : routineExercise,
        ),
      });
      setExerciseFinderOpen(false);
      setExerciseFinderMode({ type: "add", exerciseIndex: null });
    } else {
      setProgramSaveStatus(null);
      setProgramDrafts((currentDrafts) =>
        currentDrafts.map((program) =>
          program.id === programId
            ? {
                ...program,
                days: program.days.map((day) =>
                  day.id === dayId
                    ? {
                        ...day,
                        exercises: [
                          ...day.exercises,
                          createRoutineExerciseFromCatalog(exercise),
                        ],
                      }
                    : day,
                ),
              }
            : program,
        ),
      );
      setExerciseSearchTerm("");
      setExerciseEquipmentFilter("all");
      setExerciseMuscleFilter("all");
      setExerciseSearchResults([]);
      setExerciseSearchStatus("idle");
      window.setTimeout(() => {
        exerciseSearchInputRef.current?.focus();
      }, 0);
    }
  }

  function saveProgram(programId) {
    const draftProgram = programDrafts.find(
      (program) => program.id === programId,
    );

    if (!draftProgram) {
      return;
    }

    const normalizedProgram = normalizeProgram(draftProgram);

    if (!normalizedProgram) {
      setProgramSaveStatus({
        programId,
        type: "error",
        message: "Program could not be saved. Check sets, reps, and rest.",
      });
      return;
    }

    const nextProgramDefinitions = programDefinitions.map((program) =>
      program.id === programId ? normalizedProgram : program,
    );

    try {
      persistPrograms(nextProgramDefinitions);
      setProgramDefinitions(nextProgramDefinitions);
      setProgramDrafts((currentDrafts) =>
        currentDrafts.map((program) =>
          program.id === programId ? normalizedProgram : program,
        ),
      );
      setProgramSaveStatus({
        programId,
        type: "success",
        message: "Program saved.",
      });
    } catch {
      setProgramSaveStatus({
        programId,
        type: "error",
        message: "Program could not be saved. Your edits are still on screen.",
      });
    }
  }

  function duplicateProgram(programId) {
    const sourceProgram = programDrafts.find(
      (program) => program.id === programId,
    );

    if (!sourceProgram) {
      return;
    }

    const duplicateName = `${sourceProgram.name} Copy`;
    const duplicateProgramId = createProgramId(
      duplicateName,
      programDefinitions,
    );
    const duplicateProgram = {
      id: duplicateProgramId,
      name: duplicateName,
      days: sourceProgram.days.map((day) => ({
        ...day,
        id: createProgramDayId(
          duplicateProgramId,
          day.name,
          programDefinitions,
        ),
        exercises: day.exercises.map((exercise) => ({ ...exercise })),
      })),
      archived: false,
    };
    const nextProgramDefinitions = [...programDefinitions, duplicateProgram];

    try {
      persistPrograms(nextProgramDefinitions);
      setProgramDefinitions(nextProgramDefinitions);
      setProgramDrafts((currentDrafts) => [...currentDrafts, duplicateProgram]);
      setSelectedProgramId(duplicateProgramId);
      setSelectedProgramDayId(duplicateProgram.days[0]?.id ?? null);
      setIsProgramEditorOpen(true);
      setProgramSaveStatus({
        programId: duplicateProgramId,
        type: "success",
        message: "Program duplicated.",
      });
    } catch {
      setProgramSaveStatus({
        programId,
        type: "error",
        message: "Program could not be duplicated.",
      });
    }
  }

  function archiveProgram(programId) {
    if (programId === defaultProgramId) {
      setProgramSaveStatus({
        programId,
        type: "error",
        message: "Starter Program cannot be archived.",
      });
      return;
    }

    const programToArchive = programDefinitions.find(
      (program) => program.id === programId,
    );

    if (!programToArchive) {
      return;
    }

    const nextProgramDefinitions = programDefinitions.map((program) =>
      program.id === programId ? { ...program, archived: true } : program,
    );
    const nextSelectedProgramId =
      nextProgramDefinitions.find((program) => !program.archived)?.id ?? null;
    const nextSelectedProgram =
      programDrafts.find((program) => program.id === nextSelectedProgramId) ??
      null;

    try {
      persistPrograms(nextProgramDefinitions);
      setProgramDefinitions(nextProgramDefinitions);
      setProgramDrafts((currentDrafts) =>
        currentDrafts.map((program) =>
          program.id === programId ? { ...program, archived: true } : program,
        ),
      );
      setSelectedProgramId(nextSelectedProgramId);
      setSelectedProgramDayId(nextSelectedProgram?.days[0]?.id ?? null);
      setIsProgramEditorOpen(false);
      setProgramSaveStatus({
        programId: nextSelectedProgramId,
        type: "success",
        message: `${programToArchive.name} archived.`,
      });
    } catch {
      setProgramSaveStatus({
        programId,
        type: "error",
        message: "Program could not be archived.",
      });
    }
  }

  function createCustomProgram() {
    const programName = newProgramName.trim();

    if (!programName) {
      setProgramSaveStatus({
        programId: selectedProgramId,
        type: "error",
        message: "Enter a program name first.",
      });
      return;
    }

    const programId = createProgramId(programName, programDefinitions);
    const customProgram = {
      id: programId,
      name: programName,
      days: [],
      archived: false,
    };
    const nextProgramDefinitions = [...programDefinitions, customProgram];

    try {
      persistPrograms(nextProgramDefinitions);
      setProgramDefinitions(nextProgramDefinitions);
      setProgramDrafts((currentDrafts) => [...currentDrafts, customProgram]);
      setSelectedProgramId(programId);
      setSelectedProgramDayId(null);
      setIsProgramCreatorOpen(false);
      setIsProgramEditorOpen(true);
      setNewProgramName("");
      setProgramSaveStatus({
        programId,
        type: "success",
        message: "Program created.",
      });
    } catch {
      setProgramSaveStatus({
        programId: selectedProgramId,
        type: "error",
        message: "Program could not be created. Try again.",
      });
    }
  }

  function addProgramRoutine(programId) {
    const program = programDrafts.find((item) => item.id === programId);

    if (!program) {
      return;
    }

    const routineIndex = program.days.length + 1;
    const newRoutine = {
      id: createProgramDayId(
        programId,
        `Routine ${routineIndex}`,
        programDefinitions,
      ),
      name: `Routine ${routineIndex}`,
      exercises: [],
    };

    setProgramSaveStatus(null);
    setProgramDrafts((currentDrafts) =>
      currentDrafts.map((item) =>
        item.id === programId
          ? {
              ...item,
              days: [...item.days, newRoutine],
            }
          : item,
      ),
    );
    setSelectedProgramDayId(newRoutine.id);
    setIsProgramEditorOpen(true);
    setExerciseFinderOpen(false);
  }

  function assignRoutineToDay(dayId, routineDayId) {
    if (
      activeWorkoutSession?.scheduleDayId === dayId &&
      activeWorkoutSession.routineDayId !== routineDayId
    ) {
      setPendingWorkoutAction({
        type: "change-assignment",
        dayId,
        routineDayId,
      });
      return;
    }

    applyRoutineAssignment(dayId, routineDayId);
  }

  function openWorkout(scheduleDay, routineDay) {
    if (
      activeWorkoutSession &&
      (activeWorkoutSession.scheduleDayId !== scheduleDay.id ||
        activeWorkoutSession.routineDayId !== routineDay.id)
    ) {
      setPendingWorkoutAction({
        type: "open-workout",
        scheduleDay,
        routineDay,
      });
      return;
    }

    setActiveWorkoutSession((currentSession) => {
      if (
        currentSession?.scheduleDayId === scheduleDay.id &&
        currentSession?.routineDayId === routineDay.id
      ) {
        return currentSession;
      }

      return createWorkoutSession(scheduleDay, routineDay, exerciseLibrary);
    });
    setRestTimer(null);
    setViewMode("workout");
  }

  function openCompletedWorkoutDetails(completedWorkout) {
    setSelectedCompletedWorkoutId(completedWorkout.id);
    setViewMode("completed-workout");
  }

  function discardWorkout() {
    setActiveWorkoutSession(null);
    setRestTimer(null);
    setViewMode("planner");
  }

  function requestCloseWorkout() {
    setPendingWorkoutAction({ type: "close-workout" });
  }

  function requestFooterFinishWorkout() {
    setPendingWorkoutAction({ type: "finish-workout" });
  }

  function finishWorkout() {
    if (!activeWorkoutSession || !activeRoutineDay) {
      return;
    }

    if (!hasWorkoutLoggedEffort(activeWorkoutSession)) {
      setSaveMessage("Blank workout closed. No workout history was changed.");
      setActiveWorkoutSession(null);
      setRestTimer(null);
      setViewMode("planner");
      return;
    }

    const finishedAt = new Date();
    const completedWorkout = createCompletedWorkoutRecord(
      activeWorkoutSession,
      activeRoutineDay,
      finishedAt,
      exerciseLibrary,
    );

    try {
      const storedWorkouts = readPersistedCompletedWorkoutsForSave();
      const nextWorkouts = [
        completedWorkout,
        ...storedWorkouts.filter(
          (workout) => workout.id !== completedWorkout.id,
        ),
      ];

      persistCompletedWorkouts(nextWorkouts);
      setCompletedWorkouts(nextWorkouts);
      setSaveMessage(
        `Workout finished at ${formatFinishedTime(finishedAt)}. All logged sets saved.`,
      );
      setActiveWorkoutSession(null);
      setRestTimer(null);
      setViewMode("planner");
    } catch {
      setSaveMessage(
        "Workout could not be saved. Your active workout is still open.",
      );
    }
  }

  function completePendingWorkoutAction(action) {
    if (!action) {
      return;
    }

    if (action.type === "change-assignment") {
      applyRoutineAssignment(action.dayId, action.routineDayId);
      setViewMode("planner");
      return;
    }

    if (action.type === "open-workout") {
      setActiveWorkoutSession(
        createWorkoutSession(action.scheduleDay, action.routineDay, exerciseLibrary),
      );
      setRestTimer(null);
      setViewMode("workout");
      return;
    }

    if (action.type === "close-workout" || action.type === "finish-workout") {
      setViewMode("planner");
    }
  }

  function finishPendingWorkoutAction() {
    const action = pendingWorkoutAction;

    finishWorkout();
    setPendingWorkoutAction(null);
    window.setTimeout(() => completePendingWorkoutAction(action), 0);
  }

  function discardPendingWorkoutAction() {
    const action = pendingWorkoutAction;

    discardWorkout();
    setPendingWorkoutAction(null);
    window.setTimeout(() => completePendingWorkoutAction(action), 0);
  }

  function cancelPendingWorkoutAction() {
    setPendingWorkoutAction(null);
  }

  function startRestTimer(sessionExercise) {
    const totalSeconds = sessionExercise.restSeconds ?? DEFAULT_REST_SECONDS;

    prepareTimerCompleteSound();

    setRestTimer({
      exerciseId: sessionExercise.exerciseId,
      remainingSeconds: totalSeconds,
      totalSeconds,
      paused: false,
      status: "running",
    });
  }

  function pauseRestTimer() {
    setRestTimer((currentTimer) =>
      currentTimer && currentTimer.status === "running"
        ? { ...currentTimer, paused: true }
        : currentTimer,
    );
  }

  function resumeRestTimer() {
    prepareTimerCompleteSound();

    setRestTimer((currentTimer) =>
      currentTimer && currentTimer.status === "running"
        ? { ...currentTimer, paused: false }
        : currentTimer,
    );
  }

  function restartRestTimer() {
    prepareTimerCompleteSound();

    setRestTimer((currentTimer) =>
      currentTimer
        ? {
            ...currentTimer,
            remainingSeconds: currentTimer.totalSeconds,
            paused: false,
            status: "running",
          }
        : currentTimer,
    );
  }

  function skipRestTimer() {
    setRestTimer(null);
  }

  function updateSetValue(exerciseId, setNumber, field, value) {
    if (field !== "weight" && field !== "reps") {
      return;
    }

    const currentExercise = activeWorkoutSession?.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId,
    );
    const currentSet = currentExercise?.sets.find(
      (set) => set.setNumber === setNumber,
    );

    if (!currentExercise || !currentSet || currentSet[field] === value) {
      return;
    }

    if (field === "reps") {
      startRestTimer(currentExercise);
    }

    setActiveWorkoutSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      return {
        ...currentSession,
        exercises: currentSession.exercises.map((exercise) =>
          exercise.exerciseId === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.setNumber === setNumber
                    ? { ...set, [field]: value }
                    : set,
                ),
              }
            : exercise,
        ),
      };
    });
  }

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <SignInScreen onSignIn={handleSignInWithGoogle} />;
  }

  const activeWorkoutDay = schedule.find(
    (day) => day.id === activeWorkoutSession?.scheduleDayId,
  );
  const activeRoutineDay = getProgramDay(
    activeWorkoutSession?.routineDayId,
    programDefinitions,
  );
  const activeWorkoutSetCount =
    activeWorkoutSession?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    ) ?? 0;
  const restTimerStatusLabel = !restTimer
    ? "Ready"
    : restTimer.status === "complete"
      ? "REST COMPLETE - NEXT SET"
      : restTimer.paused
        ? "Paused"
        : "Running";
  const restTimerDisplay = restTimer
    ? formatTimerSeconds(restTimer.remainingSeconds)
    : "--:--";

  function renderWorkoutExerciseBlock(sessionExercise, exerciseIndex, isNested = false) {
    const exercise = getExercise(sessionExercise.exerciseId);
    const previousPerformance = getPreviousExercisePerformance(
      sessionExercise.exerciseId,
      activeRoutineDay.id,
      completedWorkouts,
    );
    const exerciseFeedback = getExerciseFeedback(sessionExercise);
    const workoutDetailsKey = `${sessionExercise.exerciseId}-${exerciseIndex}`;
    const isWorkoutDetailsExpanded =
      expandedWorkoutDetailsExerciseId === workoutDetailsKey;

    return (
      <div
        className={
          isNested
            ? "min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
            : ""
        }
      >
        <div>
          <p className="font-medium text-slate-100">
            {sessionExercise.exerciseName ?? exercise?.name ?? "Unknown exercise"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Target: {sessionExercise.prescribedSets} x {sessionExercise.repRange}
            {sessionExercise.note ? `, ${sessionExercise.note}` : ""}
          </p>
          {exerciseFeedback ? (
            <p
              className={`mt-3 inline-flex max-w-full items-center rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                exerciseFeedbackStyles[exerciseFeedback.status]
              }`}
            >
              {exerciseFeedback.label}
            </p>
          ) : null}
        </div>

        {exercise ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60">
            <button
              type="button"
              onClick={() =>
                setExpandedWorkoutDetailsExerciseId((currentExerciseId) =>
                  currentExerciseId === workoutDetailsKey
                    ? null
                    : workoutDetailsKey,
                )
              }
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              aria-expanded={isWorkoutDetailsExpanded}
            >
              <span>Exercise Details</span>
              <span>{isWorkoutDetailsExpanded ? "Hide" : "Show"}</span>
            </button>
            {isWorkoutDetailsExpanded ? (
              <div className="border-t border-slate-800 p-3">
                <ExerciseMetadata exercise={exercise} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Previous Session
          </p>
          {previousPerformance ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {previousPerformance.sets.map((set) => (
                <li key={set.setNumber}>
                  {set.weight ? `${set.weight}kg` : "-"} &times;{" "}
                  {set.reps || "-"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              No previous session logged
            </p>
          )}
        </div>

        <div className="mt-4 min-w-0 space-y-2">
          {sessionExercise.sets.map((set) => {
            const repRange = parseRepRange(sessionExercise.repRange);
            const setFeedback = getSetFeedback(set, repRange);

            return (
              <div
                key={set.setNumber}
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2"
              >
                <span className="text-sm font-medium text-slate-300">
                  Set {set.setNumber}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="Weight"
                  value={set.weight}
                  onChange={(event) =>
                    updateSetValue(
                      sessionExercise.exerciseId,
                      set.setNumber,
                      "weight",
                      event.target.value,
                    )
                  }
                  className={workoutNumberInputClassName}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(event) =>
                    updateSetValue(
                      sessionExercise.exerciseId,
                      set.setNumber,
                      "reps",
                      event.target.value,
                    )
                  }
                  className={`${workoutNumberInputClassName} ${
                    setFeedback ? setFeedbackStyles[setFeedback] : ""
                  }`}
                />
                {setFeedback ? (
                  <span
                    className={`col-span-3 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                      setFeedbackStyles[setFeedback]
                    }`}
                  >
                    {setFeedbackLabels[setFeedback]}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const activeProgramDefinitions = programDefinitions.filter(
    (program) => !program.archived,
  );
  const activeProgramDrafts = programDrafts.filter(
    (program) => !program.archived,
  );
  const selectedProgramDraft = programDrafts.find(
    (program) => program.id === selectedProgramId,
  );
  const selectedSavedProgram = programDefinitions.find(
    (program) => program.id === selectedProgramId,
  );
  const selectedProgramDayDraft = selectedProgramDraft?.days.find(
    (day) => day.id === selectedProgramDayId,
  );
  const normalizedSelectedProgramDraft = selectedProgramDraft
    ? normalizeProgram(selectedProgramDraft)
    : null;
  const selectedProgramHasUnsavedChanges =
    Boolean(selectedProgramDraft && selectedSavedProgram) &&
    (!normalizedSelectedProgramDraft ||
      !areRoutineDaysEqual(
        normalizedSelectedProgramDraft,
        selectedSavedProgram,
      ));
  const selectedProgramSaveStatus =
    programSaveStatus?.programId === selectedProgramId
      ? programSaveStatus
      : null;
  const selectedProgramSaveButtonLabel =
    selectedProgramSaveStatus?.type === "success" &&
    !selectedProgramHasUnsavedChanges
      ? "✓ Saved"
      : "Save Program";
  const exerciseEquipmentOptions = getSortedUniqueValues(
    exerciseSearchResults.flatMap((exercise) =>
      (exercise.equipment ?? []).map(getEquipmentFilterValue),
    ),
  );
  const exerciseMuscleOptions = getSortedUniqueValues(
    exerciseSearchResults.flatMap((exercise) => [
      exercise.bodyPart,
      exercise.primaryMuscle,
      ...(exercise.secondaryMuscles ?? []),
    ]),
  );
  const showExerciseEquipmentFilter = false;
  const showExerciseMuscleFilter = exerciseMuscleOptions.length > 0;
  const showHiddenFilterNotice =
    exerciseSearchStatus === "ready" &&
    exerciseSearchTerm.trim() &&
    exerciseSearchResults.length > 0 &&
    !showExerciseEquipmentFilter &&
    !showExerciseMuscleFilter;
  const getExercisePickerOptions = (currentExerciseId) => {
    if (
      !currentExerciseId ||
      exerciseSearchResults.some(
        (exercise) => exercise.id === currentExerciseId,
      )
    ) {
      return exerciseSearchResults;
    }

    const currentExercise = getExercise(currentExerciseId);

    return currentExercise
      ? [currentExercise, ...exerciseSearchResults]
      : exerciseSearchResults;
  };
  const todayScheduleDayId = getCurrentWeekdayId();
  const todayScheduleDay = schedule.find(
    (day) => day.id === todayScheduleDayId,
  );
  const todayDateInputValue = getTodayDateInputValue();
  const todayRoutineDay = getProgramDay(
    todayScheduleDay?.routineDayId,
    programDefinitions,
  );
  const todayExerciseCount = todayRoutineDay?.exercises.length ?? 0;
  const todaySetCount =
    todayRoutineDay?.exercises.reduce(
      (total, exercise) => total + Number(exercise.sets),
      0,
    ) ?? 0;
  const isTodayWorkoutActive =
    Boolean(activeWorkoutSession && todayScheduleDay && todayRoutineDay) &&
    activeWorkoutSession.scheduleDayId === todayScheduleDay.id &&
    activeWorkoutSession.routineDayId === todayRoutineDay.id;
  const todayCompletedWorkout =
    todayRoutineDay
      ? [...completedWorkouts]
          .filter(
            (workout) =>
              workout.routineDayId === todayRoutineDay.id &&
              isSameDateInputValue(todayDateInputValue, workout.completedAt) &&
              workout.exercises.some((exercise) =>
                exercise.sets.some(hasMeaningfulLoggedEffort),
              ),
          )
          .sort(
            (firstWorkout, secondWorkout) =>
              Date.parse(secondWorkout.completedAt) -
              Date.parse(firstWorkout.completedAt),
          )[0] ?? null
      : null;
  const dashboardProgram =
    programDefinitions.find(
      (program) => program.id === selectedProgramId && !program.archived,
    ) ??
    programDefinitions.find((program) => !program.archived) ??
    null;
  const plannedWorkoutsThisWeek = schedule.filter((day) =>
    Boolean(getProgramDay(day.routineDayId, programDefinitions)),
  ).length;
  const completedWorkoutsThisWeek =
    getCompletedWorkoutsThisWeek(completedWorkouts);
  const averageStepsLastSevenDays = getStepAverageForLastSevenDays(stepsByDate);
  const recentStepEntries = getRecentStepEntries(stepsByDate);
  const runsThisWeek = getRunsThisWeek(runs);
  const recentRuns = getRecentRuns(runs);
  const selectedCompletedWorkout =
    completedWorkouts.find(
      (workout) => workout.id === selectedCompletedWorkoutId,
    ) ?? todayCompletedWorkout;
  const cycleWeekLabel = getCycleWeekLabel(cycleStartDate, cycleLengthWeeks);

  return (
    <main
      className={`min-h-screen max-w-full overflow-x-hidden bg-slate-950 p-3 text-white sm:p-4 ${
        isWorkoutActive ? "pb-52 sm:pb-36" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden">
        {viewMode !== "workout" ? (
          <header className="mb-6">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="text-4xl font-bold">NevFit</h1>
              <div className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:items-end">
                {authLoading ? (
                  <p className="text-sm font-semibold text-slate-400">
                    Checking sign-in...
                  </p>
                ) : currentUser ? (
                  <>
                    <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:justify-end">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-200">
                        Welcome,{" "}
                        {currentUser.displayName ??
                          currentUser.email ??
                          "Athlete"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setViewMode("settings")}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-700 text-xl font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                        aria-label="Open settings"
                        title="Settings"
                      >
                        ⚙
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignInWithGoogle}
                    className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                  >
                    Sign in with Google
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1 sm:inline-grid sm:min-w-[26rem]">
              <button
                type="button"
                onClick={() => setViewMode("dashboard")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "dashboard"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setViewMode("planner")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "planner"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode("routines")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "routines"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Programs
              </button>
            </div>
          </header>
        ) : null}

        {viewMode === "dashboard" ? (
          <section className="min-w-0 space-y-4">
            {saveMessage ? (
              <p className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                {saveMessage}
              </p>
            ) : null}

            <article
              className={`min-w-0 rounded-2xl border bg-slate-900 p-5 shadow-2xl sm:p-6 ${
                todayCompletedWorkout
                  ? "border-emerald-300/70 shadow-emerald-950/40"
                  : "border-emerald-400/40 shadow-emerald-950/30"
              }`}
            >
              <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                    Today
                  </p>
                  <h2 className="mt-4 text-4xl font-bold text-white sm:text-5xl">
                    {todayCompletedWorkout
                      ? `✓ ${todayRoutineDay.name} Complete`
                      : todayRoutineDay
                        ? todayRoutineDay.name
                        : "Rest Day"}
                  </h2>
                  {todayCompletedWorkout ? (
                    <p className="mt-3 text-base font-semibold text-emerald-200">
                      Completed Today
                    </p>
                  ) : null}
                  {todayRoutineDay ? (
                    <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-300">
                      <span>{todayExerciseCount} exercises</span>
                      <span>{todaySetCount} sets</span>
                      {todayCompletedWorkout ? (
                        <span>
                          {formatFinishedTime(
                            new Date(todayCompletedWorkout.completedAt),
                          )}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-base text-slate-300">
                      No workout scheduled today.
                    </p>
                  )}
                </div>

                {todayScheduleDay && todayRoutineDay ? (
                  <button
                    type="button"
                    onClick={() =>
                      todayCompletedWorkout
                        ? openCompletedWorkoutDetails(todayCompletedWorkout)
                        : openWorkout(todayScheduleDay, todayRoutineDay)
                    }
                    className="w-full rounded-xl bg-emerald-400 px-5 py-4 text-base font-bold text-slate-950 transition hover:bg-emerald-300 md:w-auto md:min-w-52"
                  >
                    {todayCompletedWorkout
                      ? "View Workout"
                      : isTodayWorkoutActive
                        ? "Resume Workout"
                        : "Start Workout"}
                  </button>
                ) : plannedWorkoutsThisWeek === 0 ? (
                  <button
                    type="button"
                    onClick={() => setViewMode("planner")}
                    className="w-full rounded-xl border border-slate-700 px-5 py-4 font-semibold text-slate-200 transition hover:border-slate-500 md:w-auto"
                  >
                    Assign in Week View
                  </button>
                ) : null}
              </div>
            </article>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Current Plan
                    </p>
                    {dashboardProgram ? (
                      <>
                        <h2 className="mt-3 text-3xl font-bold text-white">
                          {dashboardProgram.name}
                        </h2>
                        <p className="mt-2 text-base font-semibold text-slate-300">
                          {cycleWeekLabel}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {dashboardProgram.days.length} routines
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="mt-3 text-xl font-bold text-white">
                          No Program Selected
                        </h2>
                        <p className="mt-2 text-sm text-slate-400">
                          Create a Program to get started.
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCycleStartDate(
                        (currentCycleStartDate) =>
                          currentCycleStartDate || getTodayDateInputValue(),
                      );
                      setCycleLengthWeeks(
                        (currentCycleLengthWeeks) =>
                          currentCycleLengthWeeks || DEFAULT_CYCLE_LENGTH_WEEKS,
                      );
                      setIsCycleEditorOpen((current) => !current);
                    }}
                    className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                  >
                    {cycleStartDate && cycleLengthWeeks
                      ? "Edit Cycle"
                      : "Set Cycle"}
                  </button>
                </div>

                {isCycleEditorOpen ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-300">
                      Start Date
                      <input
                        type="date"
                        value={cycleStartDate}
                        onChange={(event) =>
                          setCycleStartDate(event.target.value)
                        }
                        className={`${routineEditorInputClassName} mt-1`}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-300">
                      Weeks
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="52"
                        value={cycleLengthWeeks}
                        onChange={(event) => {
                          const weeks = Number(event.target.value);
                          setCycleLengthWeeks(
                            Number.isInteger(weeks) && weeks > 0 ? weeks : "",
                          );
                        }}
                        className={`${routineEditorInputClassName} mt-1`}
                      />
                    </label>
                  </div>
                ) : null}
              </article>

              <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  This Week
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Workouts
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {completedWorkoutsThisWeek} / {plannedWorkoutsThisWeek}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Runs
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {runsThisWeek} / {weeklyRunTarget}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Avg Steps
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {averageStepsLastSevenDays === null
                        ? "-"
                        : averageStepsLastSevenDays.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDashboardEntry((currentEntry) =>
                        currentEntry === "runs" ? null : "runs",
                      )
                    }
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                      expandedDashboardEntry === "runs"
                        ? "border-emerald-400 bg-slate-800 text-white"
                        : "border-slate-700 text-slate-200 hover:border-slate-500"
                    }`}
                    aria-expanded={expandedDashboardEntry === "runs"}
                  >
                    {expandedDashboardEntry === "runs" ? "Hide Runs" : "Log Run"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDashboardEntry((currentEntry) =>
                        currentEntry === "steps" ? null : "steps",
                      )
                    }
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                      expandedDashboardEntry === "steps"
                        ? "border-emerald-400 bg-slate-800 text-white"
                        : "border-slate-700 text-slate-200 hover:border-slate-500"
                    }`}
                    aria-expanded={expandedDashboardEntry === "steps"}
                  >
                    {expandedDashboardEntry === "steps"
                      ? "Hide Steps"
                      : "Add Steps"}
                  </button>
                </div>

                  {expandedDashboardEntry === "runs" ? (
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <label className="block text-sm font-semibold text-slate-300">
                        Weekly run target
                        <select
                          value={weeklyRunTarget}
                          onChange={(event) =>
                            updateWeeklyRunTarget(Number(event.target.value))
                          }
                          className={`${routineEditorSelectClassName} mt-1`}
                        >
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </label>

                      <form
                        className="mt-4 grid gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveRunEntry();
                        }}
                      >
                        <label className="text-sm font-semibold text-slate-300">
                          Date
                          <input
                            type="date"
                            value={runEntryDate}
                            max={getTodayDateInputValue()}
                            onChange={(event) =>
                              setRunEntryDate(event.target.value)
                            }
                            className={`${routineEditorInputClassName} mt-1`}
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <label className="text-sm font-semibold text-slate-300">
                            Distance km
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              value={runDistanceKm}
                              onChange={(event) =>
                                setRunDistanceKm(event.target.value)
                              }
                              className={`${routineEditorInputClassName} mt-1`}
                            />
                          </label>
                          <label className="text-sm font-semibold text-slate-300">
                            Duration minutes
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="1"
                              value={runDurationMinutes}
                              onChange={(event) =>
                                setRunDurationMinutes(event.target.value)
                              }
                              className={`${routineEditorInputClassName} mt-1`}
                            />
                          </label>
                        </div>
                        <label className="text-sm font-semibold text-slate-300">
                          Notes
                          <input
                            type="text"
                            value={runNotes}
                            onChange={(event) =>
                              setRunNotes(event.target.value)
                            }
                            className={`${routineEditorInputClassName} mt-1`}
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                        >
                          Save Run
                        </button>
                        {runSaveMessage ? (
                          <p className="text-sm font-semibold text-emerald-200">
                            {runSaveMessage}
                          </p>
                        ) : null}
                      </form>

                      {recentRuns.length > 0 ? (
                        <ul className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                          {recentRuns.map((run) => (
                            <li key={run.id} className="grid gap-1 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-400">
                                  {formatStepEntryDate(run.date)}
                                </span>
                                <span className="font-semibold text-slate-200">
                                  {formatRecentRunDetails(run)}
                                </span>
                              </div>
                              {run.notes ? (
                                <p className="text-slate-500">{run.notes}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {expandedDashboardEntry === "steps" ? (
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <form
                        className="grid gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveStepEntry();
                        }}
                      >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <label className="text-sm font-semibold text-slate-300">
                            Date
                            <input
                              type="date"
                              value={stepEntryDate}
                              max={getTodayDateInputValue()}
                              onChange={(event) =>
                                setStepEntryDate(event.target.value)
                              }
                              className={`${routineEditorInputClassName} mt-1`}
                            />
                          </label>
                          <label className="text-sm font-semibold text-slate-300">
                            Yesterday's steps
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={stepEntryValue}
                              onChange={(event) =>
                                setStepEntryValue(event.target.value)
                              }
                              className={`${routineEditorInputClassName} mt-1`}
                            />
                          </label>
                        </div>
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                        >
                          Save Steps
                        </button>
                        {stepSaveMessage ? (
                          <p className="text-sm font-semibold text-emerald-200">
                            {stepSaveMessage}
                          </p>
                        ) : null}
                      </form>

                      {recentStepEntries.length > 0 ? (
                        <ul className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                          {recentStepEntries.map((entry) => (
                            <li
                              key={entry.date}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="text-slate-400">
                                {formatStepEntryDate(entry.date)}
                              </span>
                              <span className="font-semibold text-slate-200">
                                {entry.steps.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
              </article>
            </div>

            {["Progress Highlights"].map((placeholderTitle) => (
              <article
                key={placeholderTitle}
                className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <p className="text-sm font-semibold text-slate-300">
                  {placeholderTitle}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Coming Soon
                </p>
              </article>
            ))}
          </section>
        ) : null}

        {viewMode === "completed-workout" ? (
          <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Completed Workout
                </p>
                <h2 className="mt-2 text-3xl font-bold text-white">
                  {selectedCompletedWorkout?.routineDayName ??
                    "Workout Not Found"}
                </h2>
                {selectedCompletedWorkout ? (
                  <p className="mt-2 text-sm font-semibold text-emerald-200">
                    {formatCompletedRelativeDate(
                      selectedCompletedWorkout.completedAt,
                    )}{" "}
                    at{" "}
                    {formatFinishedTime(
                      new Date(selectedCompletedWorkout.completedAt),
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    The selected workout is no longer available.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewMode("dashboard")}
                className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
              >
                Back To Dashboard
              </button>
            </div>

            {selectedCompletedWorkout ? (
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {selectedCompletedWorkout.exercises.map((exercise) => (
                  <li
                    key={exercise.exerciseId}
                    className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <p className="font-semibold text-white">
                      {exercise.exerciseName}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      {exercise.sets.map((set) => (
                        <li
                          key={set.setNumber}
                          className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2"
                        >
                          <span className="font-semibold">
                            Set {set.setNumber}
                          </span>
                          <span>
                            {set.weight || "-"}kg x {set.reps || "-"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {viewMode === "planner" ? (
          <>
            {saveMessage ? (
              <p className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                {saveMessage}
              </p>
            ) : null}

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              {schedule.map((day) => {
                const routineDay = getProgramDay(
                  day.routineDayId,
                  programDefinitions,
                );
                const isSelected = day.id === selectedDayId;

                return (
                  <article
                    key={day.id}
                    ref={isSelected ? selectedDayCardRef : null}
                    className={`min-h-32 rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-emerald-400 bg-slate-800 ring-2 ring-emerald-400/30"
                        : "border-slate-800 bg-slate-900 hover:border-slate-600"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDayId((currentDayId) =>
                          currentDayId === day.id ? null : day.id,
                        )
                      }
                      className="block w-full text-left"
                    >
                      <h2 className="font-semibold text-slate-200">
                        {day.label}
                      </h2>

                      <p className="mt-4 text-lg font-bold">
                        {routineDay?.name ?? "Rest"}
                      </p>

                      {day.note ? (
                        <p className="mt-2 text-sm text-slate-400">
                          {day.note}
                        </p>
                      ) : null}
                    </button>

                    {isSelected ? (
                      <div className="mt-4 border-t border-slate-700 pt-4">
                        <div className="flex flex-wrap gap-2">
                          {[
                            ...activeProgramDefinitions.flatMap(
                              (program) => program.days,
                            ),
                            { id: null, name: "Rest" },
                          ].map((option) => {
                            const isAssigned = day.routineDayId === option.id;

                            return (
                              <button
                                key={option.id ?? "rest"}
                                type="button"
                                onClick={() =>
                                  assignRoutineToDay(day.id, option.id)
                                }
                                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                                  isAssigned
                                    ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                    : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
                                }`}
                              >
                                {option.name}
                              </button>
                            );
                          })}
                        </div>

                        {routineDay ? (
                          <button
                            type="button"
                            onClick={() => openWorkout(day, routineDay)}
                            className="mt-4 w-full rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
                          >
                            Open Workout
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          </>
        ) : null}

        {viewMode === "settings" ? (
          <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Settings
            </p>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-2xl font-bold text-white">NevFit</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Exercise data and images provided by wger and its contributors.
              </p>
            </div>
          </section>
        ) : null}

        {viewMode === "routines" ? (
          <section className="min-w-0">
            {selectedProgramSaveStatus ? (
              <p
                className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
                  selectedProgramSaveStatus.type === "success"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-red-400/50 bg-red-500/10 text-red-200"
                }`}
              >
                {selectedProgramSaveStatus.message}
              </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <nav className="grid gap-2 self-start rounded-2xl border border-slate-800 bg-slate-900 p-3">
                {isProgramCreatorOpen ? (
                  <form
                    className="grid gap-2 border-b border-slate-800 pb-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      createCustomProgram();
                    }}
                  >
                    <label className="text-sm font-semibold text-slate-300">
                      New Program
                      <input
                        type="text"
                        value={newProgramName}
                        onChange={(event) =>
                          setNewProgramName(event.target.value)
                        }
                        placeholder="Upper / Lower"
                        className={`${routineEditorInputClassName} mt-1`}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                      >
                        Create Program
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProgramCreatorOpen(false);
                          setNewProgramName("");
                        }}
                        className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                {activeProgramDrafts.map((program) => {
                  const isSelected = program.id === selectedProgramId;

                  return (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => {
                        setSelectedProgramId(program.id);
                        setSelectedProgramDayId(program.days[0]?.id ?? null);
                        setExerciseFinderOpen(false);
                      }}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-emerald-400 bg-slate-800 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span className="block font-semibold">
                        {program.name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-400">
                        {program.days.length} routines
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsProgramCreatorOpen((current) => !current)}
                  className="rounded-lg border border-slate-700 px-4 py-3 text-left font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  + Create Program
                </button>
              </nav>

              {selectedProgramDraft && isProgramEditorOpen ? (
                <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
                  <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-bold text-white">
                        {selectedProgramDraft.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                        <span>{selectedProgramDraft.days.length} routines</span>
                        <span>{selectedProgramDayDraft?.exercises.length ?? 0} exercises</span>
                      </div>
                      {selectedProgramHasUnsavedChanges ? (
                        <p className="mt-1 text-sm font-semibold text-amber-200">
                          Unsaved changes
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveProgram(selectedProgramDraft.id)}
                        className={`rounded-lg px-4 py-2 font-semibold transition ${
                          selectedProgramSaveStatus?.type === "success" &&
                          !selectedProgramHasUnsavedChanges
                            ? "bg-emerald-300 text-slate-950"
                            : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        }`}
                      >
                        {selectedProgramSaveButtonLabel}
                      </button>
                      <details className="relative">
                        <summary className="cursor-pointer list-none rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500">
                          More
                        </summary>
                        <div className="fixed inset-x-3 top-28 z-50 rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72">
                          <label className="block text-sm font-semibold text-slate-300">
                            Rename Program
                            <input
                              type="text"
                              value={selectedProgramDraft.name}
                              onChange={(event) =>
                                updateProgramName(
                                  selectedProgramDraft.id,
                                  event.target.value,
                                )
                              }
                              className={`${routineEditorInputClassName} mt-1`}
                            />
                          </label>
                          <div className="mt-3 grid gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                duplicateProgram(selectedProgramDraft.id)
                              }
                              className="rounded-lg border border-slate-700 px-4 py-2 text-left font-semibold text-slate-200 transition hover:border-slate-500"
                            >
                              Duplicate Program
                            </button>
                            {selectedProgramDraft.id !== defaultProgramId ? (
                              <button
                                type="button"
                                onClick={() =>
                                  archiveProgram(selectedProgramDraft.id)
                                }
                                className="rounded-lg border border-red-400/60 px-4 py-2 text-left font-semibold text-red-200 transition hover:border-red-300"
                              >
                                Archive Program
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                setIsProgramEditorOpen(false);
                                setExerciseFinderOpen(false);
                              }}
                              className="rounded-lg border border-slate-700 px-4 py-2 text-left font-semibold text-slate-200 transition hover:border-slate-500"
                            >
                              Close Editor
                            </button>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProgramDraft.days.map((day) => {
                      const isSelected = day.id === selectedProgramDayId;

                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setSelectedProgramDayId(day.id)}
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            isSelected
                              ? "border-emerald-400 bg-emerald-400 text-slate-950"
                              : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
                          }`}
                        >
                          {day.name}
                        </button>
                      );
                    })}
                  </div>

                  {selectedProgramDayDraft ? (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
                      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <label className="block text-sm font-semibold text-slate-300">
                            Routine Name
                            <input
                              type="text"
                              value={selectedProgramDayDraft.name}
                              onChange={(event) =>
                                updateProgramDay(
                                  selectedProgramDraft.id,
                                  selectedProgramDayDraft.id,
                                  {
                                    name: event.target.value,
                                  },
                                )
                              }
                              className={`${routineEditorInputClassName} mt-1 text-2xl font-bold`}
                            />
                          </label>
                          <p className="mt-1 text-sm text-slate-400">
                            {selectedProgramDayDraft.exercises.length} exercises
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setExerciseFinderMode({
                              type: "add",
                              exerciseIndex: null,
                            });
                            setExerciseFinderOpen(true);
                          }}
                          className="rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                        >
                          + Add Exercise
                        </button>
                      </div>

                      <ul className="mt-4 space-y-3">
                        {selectedProgramDayDraft.exercises.map(
                          (routineExercise, index) => {
                            const exercise = getExercise(
                              routineExercise.exerciseId,
                            );
                            const isExpanded = expandedExerciseIndex === index;
                            const exercisePickerOptions =
                              getExercisePickerOptions(
                                routineExercise.exerciseId,
                              );
                            const effectiveExerciseName =
                              getEffectiveExerciseName(
                                routineExercise,
                                exercise,
                              );
                            const supersetPartnerIndexes =
                              selectedProgramDayDraft.exercises
                                .map((exerciseItem, exerciseIndex) =>
                                  exerciseIndex !== index &&
                                  exerciseItem.supersetGroupId &&
                                  exerciseItem.supersetGroupId ===
                                    routineExercise.supersetGroupId
                                    ? exerciseIndex
                                    : null,
                                )
                                .filter((exerciseIndex) => exerciseIndex !== null);
                            const supersetPartnerNames =
                              getSupersetPartnerNames(
                                selectedProgramDayDraft.exercises,
                                index,
                                exerciseLibrary,
                              );
                            const selectedSupersetValue =
                              supersetPartnerIndexes.length > 0
                                ? String(supersetPartnerIndexes[0])
                                : "";
                            const hasCustomDisplayName = Boolean(
                              routineExercise.displayNameOverride?.trim(),
                            );

                            return (
                              <li
                                key={`${selectedProgramDayDraft.id}-${index}`}
                                className={`min-w-0 rounded-xl border bg-slate-950/60 transition ${
                                  isExpanded
                                    ? "border-emerald-400/70"
                                    : "border-slate-800"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2 p-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedExerciseIndex((currentIndex) =>
                                        currentIndex === index ? null : index,
                                      )
                                    }
                                    className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition hover:bg-slate-900"
                                    aria-expanded={isExpanded}
                                  >
                                    <div className="flex min-w-0 items-start gap-3">
                                      <span className="shrink-0 text-sm font-semibold text-slate-500">
                                        {index + 1}.
                                      </span>
                                      <div className="min-w-0">
                                        <p className="truncate font-semibold text-white">
                                          {effectiveExerciseName}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-400">
                                          {routineExercise.sets} sets -{" "}
                                          {routineExercise.repRange} reps -{" "}
                                          {routineExercise.restSeconds ??
                                            DEFAULT_REST_SECONDS}{" "}
                                          sec
                                        </p>
                                        {getCompactExerciseMetadata(exercise) ? (
                                          <p className="mt-1 text-xs font-semibold text-slate-500">
                                            {getCompactExerciseMetadata(
                                              exercise,
                                            )}
                                          </p>
                                        ) : null}
                                        {supersetPartnerNames.length ? (
                                          <p className="mt-1 truncate text-xs font-semibold text-emerald-300">
                                            Superset:{" "}
                                            {supersetPartnerNames.join(" + ")}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </button>
                                  <div className="flex shrink-0 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        moveProgramExercise(
                                          selectedProgramDraft.id,
                                          selectedProgramDayDraft.id,
                                          index,
                                          -1,
                                        );
                                        setExpandedExerciseIndex(
                                          (currentIndex) =>
                                            currentIndex === index
                                              ? index - 1
                                              : currentIndex === index - 1
                                                ? index
                                              : currentIndex,
                                        );
                                      }}
                                      disabled={index === 0}
                                      className="h-10 w-12 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label={`Move ${effectiveExerciseName} up`}
                                    >
                                      Up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        moveProgramExercise(
                                          selectedProgramDraft.id,
                                          selectedProgramDayDraft.id,
                                          index,
                                          1,
                                        );
                                        setExpandedExerciseIndex(
                                          (currentIndex) =>
                                            currentIndex === index
                                              ? index + 1
                                              : currentIndex === index + 1
                                                ? index
                                              : currentIndex,
                                        );
                                      }}
                                      disabled={
                                        index ===
                                        selectedProgramDayDraft.exercises
                                          .length -
                                          1
                                      }
                                      className="h-10 w-12 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label={`Move ${effectiveExerciseName} down`}
                                    >
                                      Down
                                    </button>
                                  </div>
                                </div>

                                {isExpanded ? (
                                  <div className="border-t border-slate-800 p-3">
                                    <div className="grid min-w-0 gap-3">
                                      <label className="min-w-0 text-sm font-semibold text-slate-300">
                                        Exercise
                                        <select
                                          value={routineExercise.exerciseId}
                                          onChange={(event) =>
                                            updateProgramDay(
                                              selectedProgramDraft.id,
                                              selectedProgramDayDraft.id,
                                              {
                                                exercises:
                                                  selectedProgramDayDraft.exercises.map(
                                                    (
                                                      exerciseItem,
                                                      exerciseIndex,
                                                    ) =>
                                                      exerciseIndex === index
                                                        ? {
                                                            ...exerciseItem,
                                                            exerciseId:
                                                              event.target
                                                                .value,
                                                            displayNameOverride:
                                                              "",
                                                          }
                                                        : exerciseItem,
                                                  ),
                                              },
                                            )
                                          }
                                          className={`${routineEditorSelectClassName} mt-1`}
                                        >
                                          {exercisePickerOptions.map(
                                            (catalogExercise) => (
                                              <option
                                                key={catalogExercise.id}
                                                value={catalogExercise.id}
                                              >
                                                {catalogExercise.name}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </label>
                                    </div>

                                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                      <label className="flex min-w-0 items-start gap-3 text-sm font-semibold text-slate-300">
                                        <input
                                          type="checkbox"
                                          checked={hasCustomDisplayName}
                                          onChange={(event) =>
                                            updateProgramDay(
                                              selectedProgramDraft.id,
                                              selectedProgramDayDraft.id,
                                              {
                                                exercises:
                                                  selectedProgramDayDraft.exercises.map(
                                                    (
                                                      exerciseItem,
                                                      exerciseIndex,
                                                    ) =>
                                                      exerciseIndex === index
                                                        ? {
                                                            ...exerciseItem,
                                                            displayNameOverride:
                                                              event.target
                                                                .checked
                                                                ? effectiveExerciseName
                                                                : "",
                                                          }
                                                        : exerciseItem,
                                                  ),
                                              },
                                            )
                                          }
                                          className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-400 focus:ring-emerald-400"
                                        />
                                        <span>Use custom display name</span>
                                      </label>

                                      {hasCustomDisplayName ? (
                                        <label className="mt-3 block min-w-0 text-sm font-semibold text-slate-300">
                                          Custom Display Name
                                          <input
                                            type="text"
                                            value={
                                              routineExercise.displayNameOverride ??
                                              ""
                                            }
                                            placeholder={
                                              exercise?.name ?? "Exercise name"
                                            }
                                            onChange={(event) =>
                                              updateProgramDay(
                                                selectedProgramDraft.id,
                                                selectedProgramDayDraft.id,
                                                {
                                                  exercises:
                                                    selectedProgramDayDraft.exercises.map(
                                                      (
                                                        exerciseItem,
                                                        exerciseIndex,
                                                      ) =>
                                                        exerciseIndex === index
                                                          ? {
                                                              ...exerciseItem,
                                                              displayNameOverride:
                                                                event.target
                                                                  .value,
                                                            }
                                                          : exerciseItem,
                                                    ),
                                                },
                                              )
                                            }
                                            className={`${routineEditorInputClassName} mt-1`}
                                          />
                                          <span className="mt-1 block text-xs font-normal text-slate-500">
                                            Optional. Changes how this exercise
                                            appears inside this routine only.
                                          </span>
                                        </label>
                                      ) : null}
                                    </div>

                                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                      <p className="text-sm font-semibold text-slate-300">
                                        Superset with
                                      </p>
                                      <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateExerciseSuperset(
                                              selectedProgramDraft.id,
                                              selectedProgramDayDraft.id,
                                              index,
                                              null,
                                            )
                                          }
                                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                                            selectedSupersetValue
                                              ? "border-slate-700 text-slate-200 hover:border-slate-500"
                                              : "border-emerald-400 bg-emerald-400 text-slate-950"
                                          }`}
                                        >
                                          None
                                        </button>
                                        {selectedProgramDayDraft.exercises.map(
                                          (exerciseItem, exerciseIndex) =>
                                            exerciseIndex === index ? null : (
                                              <button
                                                key={`${exerciseItem.exerciseId}-${exerciseIndex}`}
                                                type="button"
                                                onClick={() =>
                                                  updateExerciseSuperset(
                                                    selectedProgramDraft.id,
                                                    selectedProgramDayDraft.id,
                                                    index,
                                                    exerciseIndex,
                                                  )
                                                }
                                                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                                                  selectedSupersetValue ===
                                                  String(exerciseIndex)
                                                    ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                                    : "border-slate-700 text-slate-200 hover:border-slate-500"
                                                }`}
                                              >
                                                {getRoutineExerciseName(
                                                  exerciseItem,
                                                  exerciseLibrary,
                                                )}
                                              </button>
                                            ),
                                        )}
                                      </div>
                                    </div>

                                    {exercise ? (
                                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-400">
                                        {hasCustomDisplayName ? (
                                          <p className="font-semibold text-slate-300">
                                            Custom display name:{" "}
                                            {effectiveExerciseName}
                                          </p>
                                        ) : null}
                                        <ExerciseMetadata
                                          exercise={exercise}
                                          instructionMode="full"
                                        />
                                      </div>
                                    ) : null}

                                    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
                                      <label className="min-w-0 text-sm font-semibold text-slate-300">
                                        Sets
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          min="1"
                                          max="12"
                                          value={routineExercise.sets}
                                          onChange={(event) =>
                                            updateProgramDay(
                                              selectedProgramDraft.id,
                                              selectedProgramDayDraft.id,
                                              {
                                                exercises:
                                                  selectedProgramDayDraft.exercises.map(
                                                    (
                                                      exerciseItem,
                                                      exerciseIndex,
                                                    ) =>
                                                      exerciseIndex === index
                                                        ? {
                                                            ...exerciseItem,
                                                            sets: event.target
                                                              .value,
                                                          }
                                                        : exerciseItem,
                                                  ),
                                              },
                                            )
                                          }
                                          className={`${routineEditorInputClassName} mt-1`}
                                        />
                                      </label>

                                      <label className="min-w-0 text-sm font-semibold text-slate-300">
                                        Reps
                                        <input
                                          type="text"
                                          value={routineExercise.repRange}
                                          onChange={(event) =>
                                            updateProgramDay(
                                              selectedProgramDraft.id,
                                              selectedProgramDayDraft.id,
                                              {
                                                exercises:
                                                  selectedProgramDayDraft.exercises.map(
                                                    (
                                                      exerciseItem,
                                                      exerciseIndex,
                                                    ) =>
                                                      exerciseIndex === index
                                                        ? {
                                                            ...exerciseItem,
                                                            repRange:
                                                              event.target
                                                                .value,
                                                          }
                                                        : exerciseItem,
                                                  ),
                                              },
                                            )
                                          }
                                          className={`${routineEditorInputClassName} mt-1`}
                                        />
                                      </label>

                                      <label className="min-w-0 text-sm font-semibold text-slate-300">
                                        Rest
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          min="0"
                                          max="600"
                                          value={
                                            routineExercise.restSeconds ?? ""
                                          }
                                          placeholder={`${DEFAULT_REST_SECONDS}`}
                                          onChange={(event) =>
                                            updateProgramDay(
                                              selectedProgramDraft.id,
                                              selectedProgramDayDraft.id,
                                              {
                                                exercises:
                                                  selectedProgramDayDraft.exercises.map(
                                                    (
                                                      exerciseItem,
                                                      exerciseIndex,
                                                    ) =>
                                                      exerciseIndex === index
                                                        ? {
                                                            ...exerciseItem,
                                                            restSeconds:
                                                              event.target
                                                                .value,
                                                          }
                                                        : exerciseItem,
                                                  ),
                                              },
                                            )
                                          }
                                          className={`${routineEditorInputClassName} mt-1`}
                                        />
                                      </label>
                                    </div>

                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExerciseFinderMode({
                                            type: "swap",
                                            exerciseIndex: index,
                                          });
                                          setExerciseFinderOpen(true);
                                        }}
                                        className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                                      >
                                        Swap
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          removeProgramExercise(
                                            selectedProgramDraft.id,
                                            selectedProgramDayDraft.id,
                                            index,
                                          );
                                          setExpandedExerciseIndex(null);
                                        }}
                                        className="rounded-lg border border-red-400/60 px-4 py-2 font-semibold text-red-200 transition hover:border-red-300"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </li>
                            );
                          },
                        )}
                      </ul>

                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
                      <p className="text-lg font-semibold text-white">
                        No routines yet
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Add your first routine to start building this program.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          addProgramRoutine(selectedProgramDraft.id)
                        }
                        className="mt-4 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
                      >
                        + Add Routine
                      </button>
                    </div>
                  )}
                </div>
              ) : selectedProgramDraft ? (
                <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {selectedProgramDraft.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        {selectedProgramDraft.days.length} routines
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProgramEditorOpen(true);
                        setExerciseFinderOpen(false);
                      }}
                      className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
                    >
                      Edit Program
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {exerciseFinderOpen && selectedProgramDraft && selectedProgramDayDraft ? (
          <div className="fixed inset-0 z-50 flex bg-slate-950/90 p-3 sm:p-4">
            <section className="mx-auto flex h-full w-full max-w-6xl min-w-0 flex-col rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl sm:p-4">
              <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Add Exercises
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    {selectedProgramDayDraft.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExerciseFinderOpen(false);
                    setExerciseFinderMode({ type: "add", exerciseIndex: null });
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Done
                </button>
              </div>

              <div className="grid gap-3 py-3 md:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
                <label className="min-w-0 text-sm font-semibold text-slate-300">
                  Search
                  <input
                    ref={exerciseSearchInputRef}
                    type="search"
                    value={exerciseSearchTerm}
                    onChange={(event) => {
                      setExerciseSearchTerm(event.target.value);
                      setExerciseEquipmentFilter("all");
                      setExerciseMuscleFilter("all");
                    }}
                    placeholder="deadlift, curl, pulldown"
                    className={`${routineEditorInputClassName} mt-1`}
                  />
                </label>

                {showExerciseMuscleFilter ? (
                  <label className="min-w-0 text-sm font-semibold text-slate-300">
                    Muscle
                    <select
                      value={exerciseMuscleFilter}
                      onChange={(event) =>
                        setExerciseMuscleFilter(event.target.value)
                      }
                      className={`${routineEditorSelectClassName} mt-1`}
                    >
                      <option value="all">All muscles</option>
                      {exerciseMuscleOptions.map((muscle) => (
                        <option key={muscle} value={muscle}>
                          {muscle}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {showExerciseEquipmentFilter ? (
                  <label className="min-w-0 text-sm font-semibold text-slate-300">
                    Equipment
                    <select
                      value={exerciseEquipmentFilter}
                      onChange={(event) =>
                        setExerciseEquipmentFilter(event.target.value)
                      }
                      className={`${routineEditorSelectClassName} mt-1`}
                    >
                      <option value="all">All equipment</option>
                      {exerciseEquipmentOptions.map((equipment) => (
                        <option key={equipment} value={equipment}>
                          {equipment}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {showHiddenFilterNotice ? (
                <p className="pb-2 text-sm text-slate-500">
                  Filters hidden because these results do not include usable
                  muscle or equipment metadata.
                </p>
              ) : null}

              <p className="pb-3 text-sm text-slate-400">
                {exerciseSearchStatus === "loading"
                  ? "Searching exercises..."
                  : exerciseSearchTerm.trim()
                    ? `${exerciseSearchResults.length} exercise${
                        exerciseSearchResults.length === 1 ? "" : "s"
                      } found`
                    : "Type an exercise name to search"}
              </p>
              {exerciseSearchStatus === "error" ? (
                <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">
                  Could not load exercise results. Check your connection and try
                  another search.
                </p>
              ) : null}

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {exerciseSearchStatus === "loading" ? (
                  <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-300">
                    Searching exercises...
                  </p>
                ) : exerciseSearchResults.length ? (
                  exerciseSearchResults.map((exercise) => (
                    <article
                      key={exercise.id}
                      className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                        <ExerciseImage
                          exercise={exercise}
                          className="h-28 w-full rounded-lg border border-slate-800 object-cover sm:w-32"
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">
                              {exercise.name}
                            </h3>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-slate-400">
                            {exercise.primaryMuscle ? (
                              <p>
                                <span className="font-semibold text-slate-300">
                                  Primary:
                                </span>{" "}
                                {exercise.primaryMuscle}
                              </p>
                            ) : null}
                            {exercise.secondaryMuscles?.length ? (
                              <p>
                                <span className="font-semibold text-slate-300">
                                  Secondary:
                                </span>{" "}
                                {exercise.secondaryMuscles.join(", ")}
                              </p>
                            ) : null}
                            {exercise.equipment?.length ? (
                              <p>
                                <span className="font-semibold text-slate-300">
                                  Equipment:
                                </span>{" "}
                                {exercise.equipment.join(", ")}
                              </p>
                            ) : null}
                          </div>
                          {exercise.instructions ? (
                            <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                              {getInstructionExcerpt(exercise.instructions)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          selectExerciseFromFinder(
                            selectedProgramDraft.id,
                            selectedProgramDayDraft.id,
                            exercise,
                            exerciseFinderMode.type === "swap"
                              ? exerciseFinderMode.exerciseIndex
                              : null,
                          )
                        }
                        className="shrink-0 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                      >
                        {exerciseFinderMode.type === "swap" ? "Use" : "Add"}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-300">
                    {exerciseSearchTerm.trim()
                      ? "No matching exercises found."
                      : "Type an exercise name to find exercises."}
                  </p>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {viewMode === "workout" &&
        activeWorkoutSession &&
        activeWorkoutDay &&
        activeRoutineDay ? (
          <section className="mt-4 min-w-0 overflow-x-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setViewMode("planner")}
              className="mb-4 rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Back To Planner
            </button>

            <div className="flex min-w-0 flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">
                  {activeWorkoutDay.label} - {activeRoutineDay.name}
                </h2>
                <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>{activeRoutineDay.name}</span>
                  <span>{activeWorkoutSession.exercises.length} exercises</span>
                  <span>{activeWorkoutSetCount} prescribed sets</span>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={finishWorkout}
                  className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Finish Workout
                </button>
                <button
                  type="button"
                  onClick={requestCloseWorkout}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Close Workout
                </button>
              </div>
            </div>

            <ul className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
              {groupWorkoutExercises(activeWorkoutSession.exercises).map(
                (workoutItem) => {
                  if (workoutItem.type === "superset") {
                    const supersetExerciseNames = workoutItem.exercises.map(
                      ({ exercise }) =>
                        exercise.exerciseName ?? "Unknown exercise",
                    );

                    return (
                      <li
                        key={workoutItem.key}
                        className="min-w-0 rounded-xl border border-emerald-400/50 bg-emerald-400/10 p-3 sm:p-4 lg:col-span-2"
                      >
                        <div className="border-b border-emerald-400/30 pb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                            Superset
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-white">
                            {supersetExerciseNames.join(" + ")}
                          </h3>
                        </div>
                        <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                          {workoutItem.exercises.map(
                            ({ exercise, index }) => (
                              <div key={`${exercise.exerciseId}-${index}`}>
                                {renderWorkoutExerciseBlock(
                                  exercise,
                                  index,
                                  true,
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </li>
                    );
                  }

                  const [{ exercise, index }] = workoutItem.exercises;

                  return (
                    <li
                      key={workoutItem.key}
                      className="min-w-0 rounded-xl border border-transparent bg-slate-950/60 p-3 sm:p-4"
                    >
                      {renderWorkoutExerciseBlock(exercise, index)}
                    </li>
                  );
                },
              )}
            </ul>

            <div className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
                End of workout
              </p>
              <button
                type="button"
                onClick={finishWorkout}
                className="mt-3 w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 sm:w-auto sm:min-w-56"
              >
                Finish Workout
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {isWorkoutActive ? (
        <div
          className={`workout-footer fixed inset-x-0 bottom-0 z-30 border-t px-3 pt-3 shadow-2xl backdrop-blur sm:px-4 ${
            restTimer?.status === "complete"
              ? "rest-timer-complete border-yellow-200 bg-yellow-300 text-slate-950"
              : "border-slate-700 bg-slate-950/95 text-white"
          }`}
        >
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  restTimer?.status === "complete"
                    ? "text-slate-950"
                    : "text-slate-400"
                }`}
              >
                {restTimer?.status === "complete"
                  ? "Time For Your Next Set"
                  : "Rest Timer"}
              </p>
              <div className="mt-1 flex min-w-0 items-baseline gap-2">
                <p
                  className={`font-bold leading-none ${
                    restTimer?.status === "complete"
                      ? "text-4xl"
                      : "text-3xl"
                  }`}
                >
                  {restTimerDisplay}
                </p>
                <p className="truncate text-sm font-semibold">
                  {restTimerStatusLabel}
                </p>
              </div>
            </div>

            <div className="grid w-full shrink-0 grid-cols-4 gap-2 sm:w-auto">
              {restTimer?.paused ? (
                <button
                  type="button"
                  onClick={resumeRestTimer}
                  className="w-full rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRestTimer}
                  disabled={!restTimer || restTimer.status === "complete"}
                  className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pause
                </button>
              )}
              <button
                type="button"
                onClick={restartRestTimer}
                disabled={!restTimer}
                className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={skipRestTimer}
                disabled={!restTimer}
                className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={requestFooterFinishWorkout}
                className="w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingWorkoutAction ? (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-950/80 p-3 sm:items-center sm:justify-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h2 className="text-xl font-bold">Active workout in progress</h2>
            <p className="mt-2 text-sm text-slate-300">
              You have an active workout. Finish it, discard it, or cancel and
              keep logging.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={finishPendingWorkoutAction}
                className="rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Finish Workout
              </button>
              <button
                type="button"
                onClick={discardPendingWorkoutAction}
                className="rounded-lg border border-red-400/60 px-4 py-3 font-semibold text-red-200 transition hover:border-red-300"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={cancelPendingWorkoutAction}
                className="rounded-lg border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
