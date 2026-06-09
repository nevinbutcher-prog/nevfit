import { useState } from "react";
import { exerciseCatalog } from "./data/exerciseCatalog";
import { routineDays } from "./data/routineDays";
import { weekSchedule } from "./data/weekSchedule";

const SCHEDULE_STORAGE_KEY = "nevfit_schedule";

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

function App() {
  const [schedule, setSchedule] = useState(loadStoredSchedule);
  const [selectedDayId, setSelectedDayId] = useState(weekSchedule[0]?.id ?? null);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState(null);
  const [viewMode, setViewMode] = useState("planner");

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
    setViewMode("workout");
  }

  function closeWorkout() {
    setActiveWorkoutSession(null);
    setViewMode("planner");
  }

  function updateSetValue(exerciseId, setNumber, field, value) {
    if (field !== "weight" && field !== "reps") {
      return;
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
    <main className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-7xl">
        {viewMode === "planner" ? (
          <>
            <header className="mb-6">
              <h1 className="text-4xl font-bold">NevFit</h1>
              <p className="mt-1 text-slate-400">This week&apos;s training plan</p>
            </header>

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
          <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <button
              type="button"
              onClick={() => setViewMode("planner")}
              className="mb-4 rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
            >
              ← Back To Planner
            </button>

            <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {activeWorkoutDay.label} - {activeRoutineDay.name}
                </h2>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>{activeRoutineDay.name}</span>
                  <span>{activeWorkoutSession.exercises.length} exercises</span>
                  <span>{activeWorkoutSetCount} prescribed sets</span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeWorkout}
                className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500"
              >
                Close Workout
              </button>
            </div>

            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {activeWorkoutSession.exercises.map((sessionExercise) => {
                const exercise = getExercise(sessionExercise.exerciseId);

                return (
                  <li
                    key={sessionExercise.exerciseId}
                    className="rounded-xl bg-slate-950/60 p-4"
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

                    <div className="mt-4 space-y-2">
                      {sessionExercise.sets.map((set) => (
                        <div
                          key={set.setNumber}
                          className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2"
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
                            className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
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
                            className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
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
