import { routineDays } from "./routineDays";

const cloneRoutineDay = (day) => ({
  ...day,
  exercises: day.exercises.map((exercise) => ({ ...exercise })),
});

export const starterProgram = {
  id: "starter-program",
  name: "Starter Program",
  days: routineDays.map(cloneRoutineDay),
};

export const starterPrograms = [starterProgram];
