import { useEffect, useRef, useState } from "react";
import { starterProgram, starterPrograms } from "./data/programs";
import { weekSchedule } from "./data/weekSchedule";
import {
  getExerciseById,
  getLocalExerciseCatalog,
  searchExercises,
} from "./services/exerciseProvider";

const SCHEDULE_STORAGE_KEY = "nevfit_schedule";
const PROGRAMS_STORAGE_KEY = "nevfit_programs";
const COMPLETED_WORKOUTS_STORAGE_KEY = "nevfit_completed_workouts";
const ACTIVE_WORKOUT_STORAGE_KEY = "nevfit_active_workout";
const ACTIVE_PROGRAM_STORAGE_KEY = "nevfit_active_program";
const CYCLE_START_DATE_STORAGE_KEY = "nevfit_cycle_start_date";
const CYCLE_LENGTH_WEEKS_STORAGE_KEY = "nevfit_cycle_length_weeks";
const DEFAULT_REST_SECONDS = 120;
const DEFAULT_CYCLE_LENGTH_WEEKS = 12;
const workoutNumberInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";
const routineEditorInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";
const routineEditorSelectClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400";
const localExerciseCatalog = getLocalExerciseCatalog();

const getProgramDay = (dayId, programDefinitions) =>
  programDefinitions
    .flatMap((program) => program.days)
    .find((day) => day.id === dayId && !day.archived);

const getExerciseFromLibrary = (exerciseId, exerciseLibrary) =>
  exerciseLibrary.find((exercise) => exercise.id === exerciseId);

const defaultProgramId = starterProgram.id;
const dayIdsByDateIndex = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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
      value.exerciseId.trim()
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

  return {
    exerciseId: value.exerciseId.trim(),
    sets,
    repRange:
      typeof value.repRange === "string" && value.repRange.trim()
        ? value.repRange.trim()
        : "8-12",
    restSeconds,
    ...(typeof value.note === "string" && value.note.trim()
      ? { note: value.note.trim() }
      : {}),
    ...(typeof value.groupId === "string" && value.groupId.trim()
      ? { groupId: value.groupId.trim() }
      : {}),
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

  const exercises = value.exercises
    .map(normalizeRoutineExercise)
    .filter(Boolean);

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
  return new Date().toISOString().slice(0, 10);
}

function getStartOfWeek(date) {
  const startOfWeek = new Date(date);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

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

    return completedAt >= startOfWeek && completedAt < endOfWeek;
  }).length;
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

function createWorkoutSession(scheduleDay, routineDay) {
  return {
    scheduleDayId: scheduleDay.id,
    routineDayId: routineDay.id,
    exercises: routineDay.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      prescribedSets: exercise.sets,
      repRange: exercise.repRange,
      note: exercise.note,
      restSeconds: exercise.restSeconds,
      sets: Array.from({ length: exercise.sets }, (_, index) => ({
        setNumber: index + 1,
        weight: "",
        reps: "",
      })),
    })),
  };
}

function createRoutineExerciseFromCatalog(exercise) {
  return {
    exerciseId: exercise.id,
    sets: exercise.defaultSets ?? 3,
    repRange: exercise.defaultRepRange ?? "8-12",
    restSeconds: exercise.defaultRestSeconds ?? DEFAULT_REST_SECONDS,
  };
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
        typeof exercise.prescribedSets === "number" &&
        typeof exercise.repRange === "string" &&
        (typeof exercise.note === "string" ||
          typeof exercise.note === "undefined") &&
        (typeof exercise.restSeconds === "number" ||
          typeof exercise.restSeconds === "undefined") &&
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
        exerciseName: exercise?.name ?? "Unknown exercise",
        restSeconds: sessionExercise.restSeconds ?? null,
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

let timerAudioContext = null;

function getTimerAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return null;
  }

  if (!timerAudioContext || timerAudioContext.state === "closed") {
    timerAudioContext = new AudioContext();
  }

  return timerAudioContext;
}

function prepareTimerCompleteSound() {
  try {
    const audioContext = getTimerAudioContext();

    if (audioContext?.state === "suspended") {
      void audioContext.resume();
    }
  } catch {
    // Visual completion feedback is enough if the browser blocks audio.
  }
}

function playTimerCompleteSound() {
  try {
    const audioContext = getTimerAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.2,
      audioContext.currentTime + 0.02,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.25,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.28);
  } catch {
    // Visual completion feedback is enough if the browser blocks audio.
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
  const [exerciseLibrary, setExerciseLibrary] = useState(localExerciseCatalog);
  const [exerciseSearchResults, setExerciseSearchResults] =
    useState(localExerciseCatalog);
  const [exerciseSearchStatus, setExerciseSearchStatus] = useState("idle");
  const [completedWorkouts, setCompletedWorkouts] = useState(
    loadCompletedWorkouts,
  );
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
  const [isCycleEditorOpen, setIsCycleEditorOpen] = useState(false);
  const [restTimer, setRestTimer] = useState(null);
  const [pendingWorkoutAction, setPendingWorkoutAction] = useState(null);
  const wakeLockRef = useRef(null);
  const initialSelectedDayScrollDoneRef = useRef(false);
  const selectedDayCardRef = useRef(null);
  const isWorkoutActive =
    viewMode === "workout" && Boolean(activeWorkoutSession);
  const getExercise = (exerciseId) =>
    getExerciseFromLibrary(exerciseId, exerciseLibrary);

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
    if (!exerciseFinderOpen) {
      return undefined;
    }

    let isCurrentSearch = true;
    const timeoutId = window.setTimeout(() => {
      setExerciseSearchStatus("loading");

      searchExercises(exerciseSearchTerm, {
        equipment: exerciseEquipmentFilter,
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

            results.forEach((exercise) => exercisesById.set(exercise.id, exercise));

            return Array.from(exercisesById.values());
          });
          setExerciseSearchStatus("ready");
        })
        .catch(() => {
          if (!isCurrentSearch) {
            return;
          }

          setExerciseSearchResults(localExerciseCatalog);
          setExerciseSearchStatus("fallback");
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

    Promise.all(missingExerciseIds.map((exerciseId) => getExerciseById(exerciseId)))
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

    if ("vibrate" in navigator) {
      navigator.vibrate([160, 80, 160]);
    }

    const timeoutId = window.setTimeout(() => setRestTimer(null), 4000);

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
                      exercises: day.exercises.filter(
                        (_, index) => index !== exerciseIndex,
                      ),
                    }
                  : day,
              ),
            }
          : program,
      ),
    );
  }

  function addProgramExercise(programId, dayId, exerciseId) {
    const defaultExercise =
      getExercise(exerciseId) ?? exerciseSearchResults[0] ?? localExerciseCatalog[0];

    if (!defaultExercise) {
      return;
    }

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
                        createRoutineExerciseFromCatalog(defaultExercise),
                      ],
                    }
                  : day,
              ),
            }
          : program,
      ),
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
              ? { ...routineExercise, exerciseId: exercise.id }
              : routineExercise,
        ),
      });
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
    }

    setExerciseFinderOpen(false);
    setExerciseFinderMode({ type: "add", exerciseIndex: null });
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

      return createWorkoutSession(scheduleDay, routineDay);
    });
    setRestTimer(null);
    setViewMode("workout");
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
        createWorkoutSession(action.scheduleDay, action.routineDay),
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
      ? "Rest Complete"
      : restTimer.paused
        ? "Paused"
        : "Running";
  const restTimerDisplay = restTimer
    ? formatTimerSeconds(restTimer.remainingSeconds)
    : "--:--";
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
  const exerciseOptionSource = [...exerciseLibrary, ...exerciseSearchResults];
  const exerciseEquipmentOptions = getSortedUniqueValues(
    exerciseOptionSource.flatMap((exercise) =>
      (exercise.equipment ?? []).map(getEquipmentFilterValue),
    ),
  );
  const exerciseMuscleOptions = getSortedUniqueValues(
    exerciseOptionSource.flatMap((exercise) => [
      exercise.bodyPart,
      exercise.primaryMuscle,
      ...(exercise.secondaryMuscles ?? []),
    ]),
  );
  const addExerciseCandidate = exerciseSearchResults[0] ?? null;
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
  const latestCompletedWorkout =
    [...completedWorkouts]
      .filter((workout) =>
        workout.exercises.some((exercise) =>
          exercise.sets.some(hasMeaningfulLoggedEffort),
        ),
      )
      .sort(
        (firstWorkout, secondWorkout) =>
          Date.parse(secondWorkout.completedAt) -
          Date.parse(firstWorkout.completedAt),
      )[0] ?? null;
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
            <h1 className="text-4xl font-bold">NevFit</h1>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1 sm:inline-grid sm:min-w-[28rem]">
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

            <article className="min-w-0 rounded-2xl border border-emerald-400/40 bg-slate-900 p-5 shadow-2xl shadow-emerald-950/30 sm:p-6">
              <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                    Today
                  </p>
                  <h2 className="mt-4 text-4xl font-bold text-white sm:text-5xl">
                    {todayRoutineDay ? todayRoutineDay.name : "Rest Day"}
                  </h2>
                  {todayRoutineDay ? (
                    <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-300">
                      <span>{todayExerciseCount} exercises</span>
                      <span>{todaySetCount} sets</span>
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
                      openWorkout(todayScheduleDay, todayRoutineDay)
                    }
                    className="w-full rounded-xl bg-emerald-400 px-5 py-4 text-base font-bold text-slate-950 transition hover:bg-emerald-300 md:w-auto md:min-w-52"
                  >
                    {isTodayWorkoutActive ? "Resume Workout" : "Start Workout"}
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

            <div className="grid gap-4 lg:grid-cols-3">
              <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Current Program
                </p>
                {dashboardProgram ? (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      {dashboardProgram.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
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
              </article>

              <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Current Cycle
                    </p>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      {cycleWeekLabel}
                    </h2>
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
                {plannedWorkoutsThisWeek > 0 ? (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-300">
                      Workouts Completed
                    </p>
                    <h2 className="mt-1 text-3xl font-bold text-white">
                      {completedWorkoutsThisWeek} / {plannedWorkoutsThisWeek}
                    </h2>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-xl font-bold text-white">
                      No Workouts Scheduled
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Assign routines in Week View.
                    </p>
                  </>
                )}
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Latest Workout
                </p>
                {latestCompletedWorkout ? (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      {latestCompletedWorkout.routineDayName}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {formatCompletedRelativeDate(
                        latestCompletedWorkout.completedAt,
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    No workouts completed yet.
                  </p>
                )}
              </article>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  "Runs This Week",
                  "Average Daily Steps",
                  "Progress Highlights",
                ].map((placeholderTitle) => (
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
              </div>
            </div>
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
                  <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300">
                        Program Name
                        <input
                          type="text"
                          value={selectedProgramDraft.name}
                          onChange={(event) =>
                            updateProgramName(
                              selectedProgramDraft.id,
                              event.target.value,
                            )
                          }
                          className={`${routineEditorInputClassName} mt-1 text-2xl font-bold`}
                        />
                      </label>
                      <p className="mt-2 text-sm text-slate-400">
                        {selectedProgramDraft.days.length} routines
                      </p>
                      {selectedProgramHasUnsavedChanges ? (
                        <p className="mt-2 text-sm font-semibold text-amber-200">
                          Unsaved changes
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
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
                      <button
                        type="button"
                        onClick={() =>
                          duplicateProgram(selectedProgramDraft.id)
                        }
                        className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                      >
                        Duplicate
                      </button>
                      {selectedProgramDraft.id !== defaultProgramId ? (
                        <button
                          type="button"
                          onClick={() =>
                            archiveProgram(selectedProgramDraft.id)
                          }
                          className="rounded-lg border border-red-400/60 px-4 py-2 font-semibold text-red-200 transition hover:border-red-300"
                        >
                          Archive
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setIsProgramEditorOpen(false);
                          setExerciseFinderOpen(false);
                        }}
                        className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                      >
                        Close Editor
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Days
                    </p>
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
                  </div>

                  {selectedProgramDayDraft ? (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
                      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Selected Day
                          </p>
                          <label className="mt-2 block text-sm font-semibold text-slate-300">
                            Day Name
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
                          <p className="mt-2 text-sm text-slate-400">
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
                            setExerciseFinderOpen((current) => !current);
                          }}
                          className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                        >
                          {exerciseFinderOpen
                            ? "Hide Exercise Finder"
                            : "Find Exercise"}
                        </button>
                      </div>

                      {exerciseFinderOpen ? (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                            <label className="min-w-0 text-sm font-semibold text-slate-300">
                              Search
                              <input
                                type="search"
                                value={exerciseSearchTerm}
                                onChange={(event) =>
                                  setExerciseSearchTerm(event.target.value)
                                }
                                placeholder="curl, row, press"
                                className={`${routineEditorInputClassName} mt-1`}
                              />
                            </label>

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
                          </div>

                          <p className="mt-3 text-sm text-slate-400">
                            {exerciseSearchStatus === "loading"
                              ? "Searching exercises..."
                              : `${exerciseSearchResults.length} exercise${
                                  exerciseSearchResults.length === 1 ? "" : "s"
                                } found`}
                            {exerciseSearchStatus === "fallback"
                              ? " from local catalog"
                              : ""}
                          </p>
                          {exerciseSearchStatus === "fallback" ? (
                            <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">
                              Could not load wger results. Showing local
                              exercises only.
                            </p>
                          ) : null}

                          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                            {exerciseSearchStatus === "loading" ? (
                              <p className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-300">
                                Searching exercises...
                              </p>
                            ) : exerciseSearchResults.length ? (
                              exerciseSearchResults.map((exercise) => (
                                <article
                                  key={exercise.id}
                                  className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 sm:flex-row sm:items-start sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <h3 className="font-semibold text-white">
                                        {exercise.name}
                                      </h3>
                                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                                        {exercise.source}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-400">
                                      {[
                                        exercise.primaryMuscle,
                                        ...(exercise.equipment ?? []),
                                      ]
                                        .filter(Boolean)
                                        .join(" - ") || "Exercise"}
                                    </p>
                                    {exercise.instructions ? (
                                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                                        {exercise.instructions}
                                      </p>
                                    ) : null}
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
                                    {exerciseFinderMode.type === "swap"
                                      ? "Use"
                                      : "Add"}
                                  </button>
                                </article>
                              ))
                            ) : (
                              <p className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-300">
                                No exercises found.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <ul className="mt-4 space-y-3">
                        {selectedProgramDayDraft.exercises.map(
                          (routineExercise, index) => {
                            const exercise = getExercise(
                              routineExercise.exerciseId,
                            );
                            const exercisePickerOptions =
                              getExercisePickerOptions(
                                routineExercise.exerciseId,
                              );

                            return (
                              <li
                                key={`${selectedProgramDayDraft.id}-${index}`}
                                className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                              >
                                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
                                  <div className="flex shrink-0 gap-2 lg:w-28">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveProgramExercise(
                                          selectedProgramDraft.id,
                                          selectedProgramDayDraft.id,
                                          index,
                                          -1,
                                        )
                                      }
                                      disabled={index === 0}
                                      className="h-10 w-14 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label={`Move ${exercise?.name ?? "exercise"} up`}
                                    >
                                      Up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveProgramExercise(
                                          selectedProgramDraft.id,
                                          selectedProgramDayDraft.id,
                                          index,
                                          1,
                                        )
                                      }
                                      disabled={
                                        index ===
                                        selectedProgramDayDraft.exercises
                                          .length -
                                          1
                                      }
                                      className="h-10 w-14 rounded-lg border border-slate-700 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label={`Move ${exercise?.name ?? "exercise"} down`}
                                    >
                                      Down
                                    </button>
                                  </div>

                                  <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(5rem,0.55fr)_minmax(6rem,0.7fr)_minmax(6rem,0.8fr)]">
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
                                                            event.target.value,
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
                                              {catalogExercise.source === "wger"
                                                ? " (wger)"
                                                : ""}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </label>

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
                                                            event.target.value,
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
                                                            event.target.value,
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

                                  <div className="grid shrink-0 gap-2 lg:mt-6">
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
                                      onClick={() =>
                                        removeProgramExercise(
                                          selectedProgramDraft.id,
                                          selectedProgramDayDraft.id,
                                          index,
                                        )
                                      }
                                      className="rounded-lg border border-red-400/60 px-4 py-2 font-semibold text-red-200 transition hover:border-red-300"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                {exercise ? (
                                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-400">
                                    <p>
                                      {exercise.source === "wger"
                                        ? "wger"
                                        : "Local"}{" "}
                                      - {exercise.primaryMuscle}
                                      {exercise.equipment.length
                                        ? ` - ${exercise.equipment.join(", ")}`
                                        : ""}
                                    </p>
                                    {exercise.instructions ? (
                                      <p className="mt-1 line-clamp-2">
                                        {exercise.instructions}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </li>
                            );
                          },
                        )}
                      </ul>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() =>
                            addProgramExercise(
                              selectedProgramDraft.id,
                              selectedProgramDayDraft.id,
                              addExerciseCandidate?.id,
                            )
                          }
                          disabled={!addExerciseCandidate}
                          className="rounded-lg border border-slate-700 px-4 py-3 font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addExerciseCandidate
                            ? `Add ${addExerciseCandidate.name}`
                            : "Add Exercise"}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveProgram(selectedProgramDraft.id)}
                          className={`rounded-lg px-4 py-3 font-semibold transition ${
                            selectedProgramSaveStatus?.type === "success" &&
                            !selectedProgramHasUnsavedChanges
                              ? "bg-emerald-300 text-slate-950"
                              : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                          }`}
                        >
                          {selectedProgramSaveButtonLabel}
                        </button>
                      </div>
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
              {activeWorkoutSession.exercises.map((sessionExercise) => {
                const exercise = getExercise(sessionExercise.exerciseId);
                const previousPerformance = getPreviousExercisePerformance(
                  sessionExercise.exerciseId,
                  activeRoutineDay.id,
                  completedWorkouts,
                );
                const exerciseFeedback = getExerciseFeedback(sessionExercise);

                return (
                  <li
                    key={sessionExercise.exerciseId}
                    className="min-w-0 rounded-xl bg-slate-950/60 p-3 sm:p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-100">
                        {exercise?.name ?? "Unknown exercise"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Target: {sessionExercise.prescribedSets} x{" "}
                        {sessionExercise.repRange}
                        {sessionExercise.note
                          ? `, ${sessionExercise.note}`
                          : ""}
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
                        const repRange = parseRepRange(
                          sessionExercise.repRange,
                        );
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
                                setFeedback
                                  ? setFeedbackStyles[setFeedback]
                                  : ""
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
                  </li>
                );
              })}
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
              ? "rest-timer-complete border-emerald-300/70 bg-emerald-500/95 text-slate-950"
              : "border-slate-700 bg-slate-950/95 text-white"
          }`}
        >
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  restTimer?.status === "complete"
                    ? "text-emerald-950/80"
                    : "text-slate-400"
                }`}
              >
                Rest Timer
              </p>
              <div className="mt-1 flex min-w-0 items-baseline gap-2">
                <p className="text-3xl font-bold leading-none">
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
