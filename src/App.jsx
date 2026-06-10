import { useEffect, useRef, useState } from "react";
import { exerciseCatalog } from "./data/exerciseCatalog";
import { routineDays } from "./data/routineDays";
import { weekSchedule } from "./data/weekSchedule";

const SCHEDULE_STORAGE_KEY = "nevfit_schedule";
const ROUTINES_STORAGE_KEY = "nevfit_routines";
const COMPLETED_WORKOUTS_STORAGE_KEY = "nevfit_completed_workouts";
const ACTIVE_WORKOUT_STORAGE_KEY = "nevfit_active_workout";
const DEFAULT_REST_SECONDS = 120;
const workoutNumberInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";
const routineEditorInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";
const routineEditorSelectClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400";

const getRoutineDay = (routineDayId, routineDefinitions) =>
  routineDefinitions.find((day) => day.id === routineDayId && !day.archived);

const getExercise = (exerciseId) =>
  exerciseCatalog.find((exercise) => exercise.id === exerciseId);

const builtInRoutineDayIds = new Set(routineDays.map((day) => day.id));
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
      exerciseCatalog.some((exercise) => exercise.id === value.exerciseId)
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
    exerciseId: value.exerciseId,
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

function normalizeRoutineDefinitions(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedBuiltInDays = routineDays.map((defaultDay) => {
    const storedDay = value.find((day) => day?.id === defaultDay.id);
    const normalizedDay = storedDay
      ? normalizeRoutineDay(storedDay, defaultDay)
      : null;

    return normalizedDay ?? normalizeRoutineDay(defaultDay, defaultDay);
  });
  const normalizedCustomDays = value
    .filter(
      (day) =>
        day && typeof day.id === "string" && !builtInRoutineDayIds.has(day.id),
    )
    .map((day) => normalizeRoutineDay(day))
    .filter(Boolean);
  const customDaysById = new Map(
    normalizedCustomDays.map((day) => [day.id, day]),
  );
  const normalizedDays = [
    ...normalizedBuiltInDays,
    ...Array.from(customDaysById.values()),
  ];

  return normalizedDays.every(Boolean) ? normalizedDays : null;
}

function loadStoredRoutineDefinitions() {
  try {
    const storedRoutines = window.localStorage.getItem(ROUTINES_STORAGE_KEY);

    if (!storedRoutines) {
      return normalizeRoutineDefinitions(routineDays) ?? routineDays;
    }

    const parsedRoutines = JSON.parse(storedRoutines);

    return normalizeRoutineDefinitions(parsedRoutines) ?? routineDays;
  } catch {
    return routineDays;
  }
}

function persistRoutineDefinitions(routineDefinitions) {
  window.localStorage.setItem(
    ROUTINES_STORAGE_KEY,
    JSON.stringify(routineDefinitions),
  );
}

function createRoutineId(routineName, existingRoutines) {
  const slug = routineName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  const baseId = `custom-${slug || "routine"}`;
  let nextId = `${baseId}-${suffix}`;
  let index = 2;

  while (existingRoutines.some((routine) => routine.id === nextId)) {
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

function getExerciseSearchText(exercise) {
  return [
    exercise.name,
    exercise.category,
    exercise.bodyPart,
    exercise.primaryMuscle,
    ...(exercise.secondaryMuscles ?? []),
    ...(exercise.equipment ?? []),
  ]
    .join(" ")
    .toLowerCase();
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

function createCompletedWorkoutRecord(workoutSession, routineDay, completedAt) {
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
      const exercise = getExercise(sessionExercise.exerciseId);

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

    if (!exercisePerformance) {
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
  const [routineDefinitions, setRoutineDefinitions] = useState(
    loadStoredRoutineDefinitions,
  );
  const [routineDrafts, setRoutineDrafts] = useState(
    loadStoredRoutineDefinitions,
  );
  const [selectedRoutineDayId, setSelectedRoutineDayId] = useState(
    routineDays[0]?.id ?? null,
  );
  const [newRoutineName, setNewRoutineName] = useState("");
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [exerciseEquipmentFilter, setExerciseEquipmentFilter] = useState("all");
  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState("all");
  const [completedWorkouts, setCompletedWorkouts] = useState(
    loadCompletedWorkouts,
  );
  const [selectedDayId, setSelectedDayId] = useState(getCurrentWeekdayId);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState(
    loadStoredActiveWorkoutSession,
  );
  const [viewMode, setViewMode] = useState(() =>
    loadStoredActiveWorkoutSession() ? "workout" : "planner",
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [routineSaveStatus, setRoutineSaveStatus] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const [pendingWorkoutAction, setPendingWorkoutAction] = useState(null);
  const wakeLockRef = useRef(null);
  const initialSelectedDayScrollDoneRef = useRef(false);
  const selectedDayCardRef = useRef(null);
  const isWorkoutActive =
    viewMode === "workout" && Boolean(activeWorkoutSession);

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(""), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    if (!routineSaveStatus) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setRoutineSaveStatus(null), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [routineSaveStatus]);

  useEffect(() => {
    persistActiveWorkoutSession(activeWorkoutSession);
  }, [activeWorkoutSession]);

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

  function updateRoutineExercise(dayId, exerciseIndex, patch) {
    setRoutineSaveStatus(null);
    setRoutineDrafts((currentDrafts) =>
      currentDrafts.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.map((exercise, index) =>
                index === exerciseIndex ? { ...exercise, ...patch } : exercise,
              ),
            }
          : day,
      ),
    );
  }

  function updateRoutineName(dayId, name) {
    if (builtInRoutineDayIds.has(dayId)) {
      return;
    }

    setRoutineSaveStatus(null);
    setRoutineDrafts((currentDrafts) =>
      currentDrafts.map((day) => (day.id === dayId ? { ...day, name } : day)),
    );
  }

  function moveRoutineExercise(dayId, exerciseIndex, direction) {
    setRoutineSaveStatus(null);
    setRoutineDrafts((currentDrafts) =>
      currentDrafts.map((day) => {
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
    );
  }

  function removeRoutineExercise(dayId, exerciseIndex) {
    setRoutineSaveStatus(null);
    setRoutineDrafts((currentDrafts) =>
      currentDrafts.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.filter(
                (_, index) => index !== exerciseIndex,
              ),
            }
          : day,
      ),
    );
  }

  function addRoutineExercise(dayId, exerciseId) {
    const defaultExercise = getExercise(exerciseId) ?? exerciseCatalog[0];

    if (!defaultExercise) {
      return;
    }

    setRoutineSaveStatus(null);
    setRoutineDrafts((currentDrafts) =>
      currentDrafts.map((day) =>
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
    );
  }

  function saveRoutineDay(dayId) {
    const defaultDay = routineDays.find((day) => day.id === dayId) ?? null;
    const draftDay = routineDrafts.find((day) => day.id === dayId);

    if (!draftDay) {
      return;
    }

    const normalizedDay = normalizeRoutineDay(draftDay, defaultDay);

    if (!normalizedDay) {
      setRoutineSaveStatus({
        dayId,
        type: "error",
        message: "Routine could not be saved. Check sets, reps, and rest.",
      });
      return;
    }

    const nextRoutineDefinitions = routineDefinitions.map((day) =>
      day.id === dayId ? normalizedDay : day,
    );

    try {
      persistRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDrafts((currentDrafts) =>
        currentDrafts.map((day) => (day.id === dayId ? normalizedDay : day)),
      );
      setRoutineSaveStatus({
        dayId,
        type: "success",
        message: "Routine saved.",
      });
    } catch {
      setRoutineSaveStatus({
        dayId,
        type: "error",
        message: "Routine could not be saved. Your edits are still on screen.",
      });
    }
  }

  function duplicateRoutine(dayId) {
    const sourceRoutine = routineDrafts.find((day) => day.id === dayId);

    if (!sourceRoutine) {
      return;
    }

    const duplicateName = `${sourceRoutine.name} Copy`;
    const duplicateRoutine = {
      id: createRoutineId(duplicateName, routineDefinitions),
      name: duplicateName,
      exercises: sourceRoutine.exercises.map((exercise) => ({ ...exercise })),
      archived: false,
    };
    const nextRoutineDefinitions = [...routineDefinitions, duplicateRoutine];

    try {
      persistRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDrafts((currentDrafts) => [...currentDrafts, duplicateRoutine]);
      setSelectedRoutineDayId(duplicateRoutine.id);
      setRoutineSaveStatus({
        dayId: duplicateRoutine.id,
        type: "success",
        message: "Routine duplicated.",
      });
    } catch {
      setRoutineSaveStatus({
        dayId,
        type: "error",
        message: "Routine could not be duplicated.",
      });
    }
  }

  function archiveCustomRoutine(dayId) {
    if (builtInRoutineDayIds.has(dayId)) {
      setRoutineSaveStatus({
        dayId,
        type: "error",
        message: "Default routines cannot be archived.",
      });
      return;
    }

    const routineToArchive = routineDefinitions.find((day) => day.id === dayId);

    if (!routineToArchive) {
      return;
    }

    const nextRoutineDefinitions = routineDefinitions.map((day) =>
      day.id === dayId ? { ...day, archived: true } : day,
    );
    const nextSchedule = schedule.map((day) =>
      day.routineDayId === dayId
        ? {
            ...day,
            routineDayId: null,
            note: "Rest",
          }
        : day,
    );
    const nextSelectedRoutineId =
      nextRoutineDefinitions.find((day) => !day.archived)?.id ?? null;

    try {
      persistRoutineDefinitions(nextRoutineDefinitions);
      persistSchedule(nextSchedule);
      setRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDrafts((currentDrafts) =>
        currentDrafts.map((day) =>
          day.id === dayId ? { ...day, archived: true } : day,
        ),
      );
      setSchedule(nextSchedule);
      setSelectedRoutineDayId(nextSelectedRoutineId);
      setRoutineSaveStatus({
        dayId: nextSelectedRoutineId,
        type: "success",
        message: `${routineToArchive.name} archived. Assigned weekdays reset to Rest.`,
      });
    } catch {
      setRoutineSaveStatus({
        dayId,
        type: "error",
        message: "Routine could not be archived.",
      });
    }
  }

  function createCustomRoutine() {
    const routineName = newRoutineName.trim();

    if (!routineName) {
      setRoutineSaveStatus({
        dayId: selectedRoutineDayId,
        type: "error",
        message: "Enter a routine name first.",
      });
      return;
    }

    const customRoutine = {
      id: createRoutineId(routineName, routineDefinitions),
      name: routineName,
      exercises: [],
    };
    const nextRoutineDefinitions = [...routineDefinitions, customRoutine];

    try {
      persistRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDefinitions(nextRoutineDefinitions);
      setRoutineDrafts((currentDrafts) => [...currentDrafts, customRoutine]);
      setSelectedRoutineDayId(customRoutine.id);
      setNewRoutineName("");
      setRoutineSaveStatus({
        dayId: customRoutine.id,
        type: "success",
        message: "Routine created.",
      });
    } catch {
      setRoutineSaveStatus({
        dayId: selectedRoutineDayId,
        type: "error",
        message: "Routine could not be created. Try again.",
      });
    }
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

    const finishedAt = new Date();
    const completedWorkout = createCompletedWorkoutRecord(
      activeWorkoutSession,
      activeRoutineDay,
      finishedAt,
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
  const activeRoutineDay = getRoutineDay(
    activeWorkoutSession?.routineDayId,
    routineDefinitions,
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
  const activeRoutineDefinitions = routineDefinitions.filter(
    (routine) => !routine.archived,
  );
  const activeRoutineDrafts = routineDrafts.filter(
    (routine) => !routine.archived,
  );
  const selectedRoutineDraft = routineDrafts.find(
    (day) => day.id === selectedRoutineDayId,
  );
  const selectedSavedRoutine = routineDefinitions.find(
    (day) => day.id === selectedRoutineDayId,
  );
  const selectedDefaultRoutine = routineDays.find(
    (day) => day.id === selectedRoutineDayId,
  );
  const normalizedSelectedRoutineDraft =
    selectedRoutineDraft && selectedDefaultRoutine
      ? normalizeRoutineDay(selectedRoutineDraft, selectedDefaultRoutine)
      : null;
  const selectedRoutineHasUnsavedChanges =
    Boolean(selectedRoutineDraft && selectedSavedRoutine) &&
    (!normalizedSelectedRoutineDraft ||
      !areRoutineDaysEqual(
        normalizedSelectedRoutineDraft,
        selectedSavedRoutine,
      ));
  const selectedRoutineSaveStatus =
    routineSaveStatus?.dayId === selectedRoutineDayId
      ? routineSaveStatus
      : null;
  const selectedRoutineIsBuiltIn =
    builtInRoutineDayIds.has(selectedRoutineDayId);
  const selectedRoutineSaveButtonLabel =
    selectedRoutineSaveStatus?.type === "success" &&
    !selectedRoutineHasUnsavedChanges
      ? "✓ Saved"
      : "Save Routine";
  const exerciseEquipmentOptions = getSortedUniqueValues(
    exerciseCatalog.flatMap((exercise) =>
      (exercise.equipment ?? []).map(getEquipmentFilterValue),
    ),
  );
  const exerciseMuscleOptions = getSortedUniqueValues(
    exerciseCatalog.flatMap((exercise) => [
      exercise.bodyPart,
      exercise.primaryMuscle,
    ]),
  );
  const normalizedExerciseSearchTerm = exerciseSearchTerm.trim().toLowerCase();
  const filteredExerciseCatalog = exerciseCatalog.filter((exercise) => {
    const matchesSearch =
      !normalizedExerciseSearchTerm ||
      getExerciseSearchText(exercise).includes(normalizedExerciseSearchTerm);
    const matchesEquipment =
      exerciseEquipmentFilter === "all" ||
      exercise.equipment
        ?.map(getEquipmentFilterValue)
        .includes(exerciseEquipmentFilter);
    const matchesMuscle =
      exerciseMuscleFilter === "all" ||
      exercise.bodyPart === exerciseMuscleFilter ||
      exercise.primaryMuscle === exerciseMuscleFilter;

    return matchesSearch && matchesEquipment && matchesMuscle;
  });
  const addExerciseCandidate = filteredExerciseCatalog[0] ?? null;
  const getExercisePickerOptions = (currentExerciseId) => {
    if (
      !currentExerciseId ||
      filteredExerciseCatalog.some(
        (exercise) => exercise.id === currentExerciseId,
      )
    ) {
      return filteredExerciseCatalog;
    }

    const currentExercise = getExercise(currentExerciseId);

    return currentExercise
      ? [currentExercise, ...filteredExerciseCatalog]
      : filteredExerciseCatalog;
  };

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
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1 sm:inline-grid sm:min-w-80">
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
                Routines
              </button>
            </div>
          </header>
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
                const routineDay = getRoutineDay(
                  day.routineDayId,
                  routineDefinitions,
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
                            ...activeRoutineDefinitions,
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
            {selectedRoutineSaveStatus ? (
              <p
                className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
                  selectedRoutineSaveStatus.type === "success"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-red-400/50 bg-red-500/10 text-red-200"
                }`}
              >
                {selectedRoutineSaveStatus.message}
              </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <nav className="grid gap-2 self-start rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <form
                  className="grid gap-2 border-b border-slate-800 pb-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createCustomRoutine();
                  }}
                >
                  <label className="text-sm font-semibold text-slate-300">
                    New Routine
                    <input
                      type="text"
                      value={newRoutineName}
                      onChange={(event) =>
                        setNewRoutineName(event.target.value)
                      }
                      placeholder="Push"
                      className={`${routineEditorInputClassName} mt-1`}
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                  >
                    Create Routine
                  </button>
                </form>

                {activeRoutineDrafts.map((routineDay) => {
                  const isSelected = routineDay.id === selectedRoutineDayId;

                  return (
                    <button
                      key={routineDay.id}
                      type="button"
                      onClick={() => setSelectedRoutineDayId(routineDay.id)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-emerald-400 bg-slate-800 text-white"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span className="block font-semibold">
                        {routineDay.name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-400">
                        {routineDay.exercises.length} exercises
                      </span>
                    </button>
                  );
                })}
              </nav>

              {selectedRoutineDraft ? (
                <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
                  <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300">
                        Routine Name
                        <input
                          type="text"
                          value={selectedRoutineDraft.name}
                          onChange={(event) =>
                            updateRoutineName(
                              selectedRoutineDraft.id,
                              event.target.value,
                            )
                          }
                          disabled={selectedRoutineIsBuiltIn}
                          className={`${routineEditorInputClassName} mt-1 text-2xl font-bold disabled:cursor-not-allowed disabled:opacity-70`}
                        />
                      </label>
                      <p className="mt-2 text-sm text-slate-400">
                        {selectedRoutineDraft.exercises.length} exercises
                        {selectedRoutineIsBuiltIn
                          ? " · default routine"
                          : " · custom routine"}
                      </p>
                      {selectedRoutineHasUnsavedChanges ? (
                        <p className="mt-2 text-sm font-semibold text-amber-200">
                          Unsaved changes
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => saveRoutineDay(selectedRoutineDraft.id)}
                        className={`rounded-lg px-4 py-2 font-semibold transition ${
                          selectedRoutineSaveStatus?.type === "success" &&
                          !selectedRoutineHasUnsavedChanges
                            ? "bg-emerald-300 text-slate-950"
                            : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        }`}
                      >
                        {selectedRoutineSaveButtonLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          duplicateRoutine(selectedRoutineDraft.id)
                        }
                        className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                      >
                        Duplicate
                      </button>
                      {!selectedRoutineIsBuiltIn ? (
                        <button
                          type="button"
                          onClick={() =>
                            archiveCustomRoutine(selectedRoutineDraft.id)
                          }
                          className="rounded-lg border border-red-400/60 px-4 py-2 font-semibold text-red-200 transition hover:border-red-300"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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
                      {filteredExerciseCatalog.length} exercise
                      {filteredExerciseCatalog.length === 1 ? "" : "s"} found
                    </p>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {selectedRoutineDraft.exercises.map(
                      (routineExercise, index) => {
                        const exercise = getExercise(
                          routineExercise.exerciseId,
                        );
                        const exercisePickerOptions = getExercisePickerOptions(
                          routineExercise.exerciseId,
                        );

                        return (
                          <li
                            key={`${selectedRoutineDraft.id}-${index}`}
                            className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                          >
                            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
                              <div className="flex shrink-0 gap-2 lg:w-28">
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveRoutineExercise(
                                      selectedRoutineDraft.id,
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
                                    moveRoutineExercise(
                                      selectedRoutineDraft.id,
                                      index,
                                      1,
                                    )
                                  }
                                  disabled={
                                    index ===
                                    selectedRoutineDraft.exercises.length - 1
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
                                      updateRoutineExercise(
                                        selectedRoutineDraft.id,
                                        index,
                                        { exerciseId: event.target.value },
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

                                <label className="min-w-0 text-sm font-semibold text-slate-300">
                                  Sets
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    max="12"
                                    value={routineExercise.sets}
                                    onChange={(event) =>
                                      updateRoutineExercise(
                                        selectedRoutineDraft.id,
                                        index,
                                        { sets: event.target.value },
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
                                      updateRoutineExercise(
                                        selectedRoutineDraft.id,
                                        index,
                                        { repRange: event.target.value },
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
                                    value={routineExercise.restSeconds ?? ""}
                                    placeholder={`${DEFAULT_REST_SECONDS}`}
                                    onChange={(event) =>
                                      updateRoutineExercise(
                                        selectedRoutineDraft.id,
                                        index,
                                        { restSeconds: event.target.value },
                                      )
                                    }
                                    className={`${routineEditorInputClassName} mt-1`}
                                  />
                                </label>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeRoutineExercise(
                                    selectedRoutineDraft.id,
                                    index,
                                  )
                                }
                                className="rounded-lg border border-red-400/60 px-4 py-2 font-semibold text-red-200 transition hover:border-red-300 lg:mt-6"
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        );
                      },
                    )}
                  </ul>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() =>
                        addRoutineExercise(
                          selectedRoutineDraft.id,
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
                      onClick={() => saveRoutineDay(selectedRoutineDraft.id)}
                      className={`rounded-lg px-4 py-3 font-semibold transition ${
                        selectedRoutineSaveStatus?.type === "success" &&
                        !selectedRoutineHasUnsavedChanges
                          ? "bg-emerald-300 text-slate-950"
                          : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      }`}
                    >
                      {selectedRoutineSaveButtonLabel}
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
