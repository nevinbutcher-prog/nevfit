import { useEffect, useState } from "react";
import { exerciseCatalog } from "./data/exerciseCatalog";
import { routineDays } from "./data/routineDays";
import { weekSchedule } from "./data/weekSchedule";

const SCHEDULE_STORAGE_KEY = "nevfit_schedule";
const COMPLETED_WORKOUTS_STORAGE_KEY = "nevfit_completed_workouts";
const DEFAULT_REST_SECONDS = 120;
const workoutNumberInputClassName =
  "w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400";

const routineOptions = [
  { id: "day-a", label: "Day A" },
  { id: "day-b", label: "Day B" },
  { id: "day-c", label: "Day C" },
  { id: "day-d", label: "Day D" },
  { id: null, label: "Rest" },
];

const getRoutineDay = (routineDayId) =>
  routineDays.find((day) => day.id === routineDayId);

const getExercise = (exerciseId) =>
  exerciseCatalog.find((exercise) => exercise.id === exerciseId);

const validRoutineDayIds = new Set(routineDays.map((day) => day.id));

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
        (day.routineDayId === null || validRoutineDayIds.has(day.routineDayId)) &&
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

function isValidCompletedWorkout(value) {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    typeof value.scheduleDayId === "string" &&
    typeof value.routineDayId === "string" &&
    typeof value.routineDayName === "string" &&
    Array.isArray(value.exercises) &&
    value.exercises.every(
      (exercise) =>
        exercise &&
        typeof exercise.exerciseId === "string" &&
        typeof exercise.exerciseName === "string" &&
        (typeof exercise.restSeconds === "number" ||
          exercise.restSeconds === null) &&
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

function loadCompletedWorkouts() {
  try {
    const storedWorkouts = window.localStorage.getItem(
      COMPLETED_WORKOUTS_STORAGE_KEY,
    );

    if (!storedWorkouts) {
      return [];
    }

    const parsedWorkouts = JSON.parse(storedWorkouts);

    return Array.isArray(parsedWorkouts)
      ? parsedWorkouts.filter(isValidCompletedWorkout)
      : [];
  } catch {
    return [];
  }
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

function createCompletedWorkoutRecord(workoutSession, routineDay) {
  return {
    id: `workout-${Date.now()}`,
    completedAt: new Date().toISOString(),
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

function getPreviousExercisePerformance(exerciseId, completedWorkouts) {
  return completedWorkouts.reduce((latestPerformance, completedWorkout) => {
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

function formatTimerSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function playTimerCompleteSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);

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
  const [completedWorkouts, setCompletedWorkouts] = useState(loadCompletedWorkouts);
  const [selectedDayId, setSelectedDayId] = useState(weekSchedule[0]?.id ?? null);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState(null);
  const [viewMode, setViewMode] = useState("planner");
  const [saveMessage, setSaveMessage] = useState("");
  const [restTimer, setRestTimer] = useState(null);

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(""), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

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
          playTimerCompleteSound();

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

    const timeoutId = window.setTimeout(() => setRestTimer(null), 4000);

    return () => window.clearTimeout(timeoutId);
  }, [restTimer?.status]);

  function assignRoutineToDay(dayId, routineDayId) {
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

    if (!routineDayId && activeWorkoutSession?.scheduleDayId === dayId) {
      setActiveWorkoutSession(null);
      setRestTimer(null);
      setViewMode("planner");
    }
  }

  function openWorkout(scheduleDay, routineDay) {
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

  function closeWorkout() {
    setActiveWorkoutSession(null);
    setRestTimer(null);
    setViewMode("planner");
  }

  function saveWorkout() {
    if (!activeWorkoutSession || !activeRoutineDay) {
      return;
    }

    const completedWorkout = createCompletedWorkoutRecord(
      activeWorkoutSession,
      activeRoutineDay,
    );

    setCompletedWorkouts((currentWorkouts) => {
      const nextWorkouts = [completedWorkout, ...currentWorkouts];

      persistCompletedWorkouts(nextWorkouts);

      return nextWorkouts;
    });
    setSaveMessage("Workout saved.");
    setActiveWorkoutSession(null);
    setRestTimer(null);
    setViewMode("planner");
  }

  function startRestTimer(sessionExercise) {
    const totalSeconds = sessionExercise.restSeconds ?? DEFAULT_REST_SECONDS;

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
    setRestTimer((currentTimer) =>
      currentTimer && currentTimer.status === "running"
        ? { ...currentTimer, paused: false }
        : currentTimer,
    );
  }

  function restartRestTimer() {
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
                  set.setNumber === setNumber ? { ...set, [field]: value } : set,
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
  const activeRoutineDay = getRoutineDay(activeWorkoutSession?.routineDayId);
  const activeWorkoutSetCount =
    activeWorkoutSession?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    ) ?? 0;

  return (
    <main className="min-h-screen max-w-full overflow-x-hidden bg-slate-950 p-3 text-white sm:p-4">
      <div className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden">
        {viewMode === "planner" ? (
          <>
            <header className="mb-6">
              <h1 className="text-4xl font-bold">NevFit</h1>
              <p className="mt-1 text-slate-400">This week&apos;s training plan</p>
            </header>

            {saveMessage ? (
              <p className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                {saveMessage}
              </p>
            ) : null}

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              {schedule.map((day) => {
                const routineDay = getRoutineDay(day.routineDayId);
                const isSelected = day.id === selectedDayId;

                return (
                  <article
                    key={day.id}
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
                      <h2 className="font-semibold text-slate-200">{day.label}</h2>

                      <p className="mt-4 text-lg font-bold">
                        {routineDay?.name ?? "Rest"}
                      </p>

                      {day.note ? (
                        <p className="mt-2 text-sm text-slate-400">{day.note}</p>
                      ) : null}
                    </button>

                    {isSelected ? (
                      <div className="mt-4 border-t border-slate-700 pt-4">
                        <div className="flex flex-wrap gap-2">
                          {routineOptions.map((option) => {
                            const isAssigned = day.routineDayId === option.id;

                            return (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => assignRoutineToDay(day.id, option.id)}
                                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                                  isAssigned
                                    ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                    : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
                                }`}
                              >
                                {option.label}
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

        {viewMode === "workout" && activeWorkoutSession && activeWorkoutDay && activeRoutineDay ? (
          <section className="mt-4 min-w-0 overflow-x-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setViewMode("planner")}
              className="mb-4 rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
            >
              ← Back To Planner
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
                  onClick={saveWorkout}
                  className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Save Workout
                </button>
                <button
                  type="button"
                  onClick={closeWorkout}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Close Workout
                </button>
              </div>
            </div>

            {restTimer ? (
              <div className="sticky top-4 z-10 mt-4 min-w-0 overflow-x-hidden rounded-xl border border-emerald-400/40 bg-slate-950/95 p-3 shadow-xl shadow-slate-950/40 backdrop-blur sm:p-4">
                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Rest Timer
                    </p>
                    <p className="mt-1 text-3xl font-bold text-emerald-200">
                      {restTimer.status === "complete"
                        ? "Rest Complete"
                        : `${formatTimerSeconds(restTimer.remainingSeconds)} remaining`}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-wrap gap-2">
                    {restTimer.paused ? (
                      <button
                        type="button"
                        onClick={resumeRestTimer}
                        className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                      >
                        Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pauseRestTimer}
                        disabled={restTimer.status === "complete"}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Pause
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={restartRestTimer}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                    >
                      Restart
                    </button>
                    <button
                      type="button"
                      onClick={skipRestTimer}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <ul className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
              {activeWorkoutSession.exercises.map((sessionExercise) => {
                const exercise = getExercise(sessionExercise.exerciseId);
                const previousPerformance = getPreviousExercisePerformance(
                  sessionExercise.exerciseId,
                  completedWorkouts,
                );

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
                        {sessionExercise.note ? `, ${sessionExercise.note}` : ""}
                      </p>
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
                      {sessionExercise.sets.map((set) => (
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
                            className={workoutNumberInputClassName}
                          />
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default App;
