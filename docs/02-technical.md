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
    auth.js
    exerciseProvider.js
    firebase.js
    firebaseSmokeTest.js
    userProfile.js
  index.css
```

Root Firebase config files:

- `firebase.json`
- `firestore.rules`

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

Routine exercises store a stable `exerciseId` that points to the selected wger
exercise. They can also store an optional `displayNameOverride`, allowing a
base wger movement to be named as a practical routine variant such as
`DB Reverse Lunge`.

Workout sessions snapshot the effective exercise name at start time:

```js
displayNameOverride || exercise.name
```

Completed workout records preserve that snapped name in `exerciseName`, so
history keeps the name used during the workout even if the routine is renamed
later.

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
  originalName,
  category,
  bodyPart,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  aliases,
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

Exercise discovery is search-first. `searchExercises(query, filters)` loads an
English wger `exerciseinfo` pool, normalizes the result names and metadata,
deduplicates normalized results, and ranks by name/alias relevance. It does not
use instruction text for direct search ranking.

The picker currently shows the muscle filter only when populated from current
search results. The equipment filter is hidden for now because wger equipment
metadata is often incomplete or too generic. Equipment is still displayed on
result cards when available.

There is no local catalog fallback, local taxonomy merge layer, or local result
set.

## Firebase Identity Layer

Firebase is initialized in `src/services/firebase.js`.

Authentication is isolated in `src/services/auth.js`:

- `signInWithGoogle()`
- `signOutUser()`
- `subscribeToAuthChanges(callback)`

The app tracks `currentUser` and `authLoading`, but signing in does not alter
workout, program, schedule, active workout, or history persistence.

`src/services/userProfile.js` exports `ensureUserProfile(user)`, which creates
or updates `users/{uid}` with `setDoc(..., { merge: true })`. This is the only
application Firestore write currently implemented.

Firestore rules are intentionally narrow:

- signed-in users can read/write only their own `users/{uid}` document
- workout/program/routine data has not been migrated

## Future Storage

- Cloud-backed program, routine, schedule, active workout, and completed
  workout storage
- Durable selected exercise metadata if offline reload behavior becomes
  important
