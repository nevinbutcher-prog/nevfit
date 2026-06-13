# Technical Notes

## Stack

- Vite
- React
- Tailwind CSS v4
- Browser `localStorage`

## Current Structure

```text
src/
  App.jsx
  data/
    programs.js
    routineDays.js
    weekSchedule.js
  services/
    exerciseProvider.js
  index.css
```

## localStorage Keys

- `nevfit_schedule`
- `nevfit_programs`
- `nevfit_active_program`
- `nevfit_active_workout`
- `nevfit_completed_workouts`
- `nevfit_cycle_start_date`
- `nevfit_cycle_length_weeks`

Legacy note: older docs may mention `nevfit_routines`; the current program
editor persists program definitions through `nevfit_programs`.

## Workout History Model

Completed workouts are append-only historical snapshots stored in
`nevfit_completed_workouts`.

Previous performance is derived from completed workout history, not from active
or blank sessions.

Blank workout sessions are non-destructive:

- A session is blank when no set contains meaningful reps or weight.
- Blank sessions are not saved as completed workouts.
- Closing a blank session clears the active workout and leaves completed history unchanged.
- Previous performance lookup ignores blank legacy completed records.

## Program And Routine Model

Program definitions are user-editable and persist separately from workout
history. Workout sessions snapshot the assigned routine at workout start.

The Starter Program is migrated from default routine data. Newly created
programs should start empty and routines are added explicitly through the
program editor.

## Exercise Provider

Exercise search is routed through `src/services/exerciseProvider.js`.

The provider exposes:

- `searchExercises(query, filters)`
- `getExerciseById(id)`
- `normalizeExercise(sourceExercise)`

Supported sources:

- wger API results

Normalized exercise shape:

```js
{
  id,
  name,
  category,
  bodyPart,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  defaultSets,
  defaultRepRange,
  defaultRestSeconds,
  source,
  sourceId,
  instructions,
}
```

The routine editor keeps a local in-memory exercise library of fetched wger
results. This lets selected wger exercises continue rendering in the editor,
workout screen, and completed history snapshots during the current app session.

Exercise discovery is search-first. `searchExercises(query, filters)` queries
wger directly and then applies optional equipment and muscle filters to the
returned wger metadata. There is no local catalog fallback or local taxonomy
merge layer.

## Future Storage

- Firebase Auth
- Firestore
