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
    activeWorkoutStore.js
    auth.js
    backupService.js
    exerciseProvider.js
    firebase.js
    firebaseSmokeTest.js
    healthStore.js
    planningStore.js
    programStore.js
    userProfile.js
    workoutHistoryStore.js
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
- `nevfit_steps`
- `nevfit_runs`
- `nevfit_weekly_run_target`

Legacy note: older docs may mention `nevfit_routines`; the current program
editor persists program definitions through `nevfit_programs` as a local cache.
Planning and health keys remain as local caches for their Firestore app-state
documents. Active workout and completed workout history keys also remain as
local caches for their Firestore-backed workout state.

## Workout History Model

Completed workouts are append-only historical snapshots stored at:

```text
users/{uid}/completedWorkouts/{workoutId}
```

`nevfit_completed_workouts` remains a local cache.

Previous performance is derived from completed workout history globally by
stable `exerciseId`, not by routine, schedule slot, day, or program. It uses
the most recent matching completed exercise with meaningful logged effort, not
active or blank sessions. Routine-level `displayNameOverride` values do not
change that history identity.

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

Routine exercises also normalize a lightweight `supersetGroupId` field:

```js
{
  routineExerciseId,
  exerciseId,
  sets,
  repRange,
  restSeconds,
  displayNameOverride,
  note,
  supersetGroupId,
}
```

`routineExerciseId` is the stable identity of a particular row inside a
routine. It is separate from provider-backed `exerciseId`, so two instances of
the same movement can be targeted independently. New rows receive a generated
`ri-*` ID. Legacy rows receive a deterministic `ri-{routineId}-{position}` ID
during normalization; the ID is then retained through edits, reordering, and
persistence. Duplicating a routine generates fresh row IDs for the copy.

Missing values normalize to `null`. Older `groupId` values are migrated into
`supersetGroupId` during routine normalization for local backwards
compatibility, but new routine data writes `supersetGroupId`.

Supersets are stored as shared group IDs, not one-way exercise links. Pairing
two ungrouped exercises creates a new `ss-*` group ID. Pairing with an exercise
already in a group joins that group. Removing a pairing or deleting an exercise
cleans up orphaned groups so a remaining single exercise has
`supersetGroupId: null`.

The routine editor exposes pairing through a focused partner selector keyed by
routine-row index, so duplicate base exercise IDs remain independently
targetable. Changing a pairing first removes the edited row from its old group,
cleans any orphan, then creates or joins the selected partner's group.

Workout sessions snapshot the effective exercise name at start time:

```js
displayNameOverride || exercise.name
```

Completed workout records preserve that snapped name in `exerciseName`, so
history keeps the name used during the workout even if the routine is renamed
later. Active and completed workout exercise snapshots also preserve
`supersetGroupId` so workout mode can group paired exercises visually without
changing timer behavior.

## Routine Proposal Contract

`src/services/routineProposal.js` defines the provider-neutral boundary for
future coaching proposals. Version 1 supports `create_routine` and
`modify_routine`; it does not call an AI provider or expose an approval UI.

All proposals identify a target program, and modification proposals also
identify a target routine. Modification operations are an ordered `changes`
array supporting:

- `add_exercise`
- `remove_exercise`
- `replace_exercise`
- `move_exercise`
- `update_exercise`
- `set_superset`
- `clear_superset`
- `rename_routine`

Exercise operations target `routineExerciseId`, never a display name or array
index. Adds include their future stable row ID, while replacements preserve the
target row ID and current superset membership but replace the full exercise
prescription. Moves and insertions use an explicit `afterRoutineExerciseId`;
`null` means the start of the routine.

Create proposals describe an ordered routine directly. Supersets use local
`proposalGroupKey` values on its exercise definitions. Modify proposals use a
`set_superset` operation containing a local group key and stable member row
IDs. Application deterministically translates each valid local key into a
shared `ss-proposal-*` ID, avoids collisions, and removes orphaned groups.

The public boundary is:

```js
validateRoutineProposal(proposal, currentProgram)
// { valid, errors: [{ code, path, message }], normalizedProposal }

applyRoutineProposal(currentProgram, proposal)
// success: { applied: true, errors: [], program, routineId, review }
// failure: { applied: false, errors, program: null, review: null }
```

Validation accepts supplied in-memory program context and performs no reads.
It rejects unsupported versions, unexpected targets, malformed IDs and
prescriptions, missing rows, invalid anchors/grouping, and ambiguous operation
combinations. Application validates first, clones the full program graph, and
returns draft data plus review metadata. It imports no Firebase or storage
services and performs no Firestore, localStorage, workout-history, or active
workout writes. The existing Save Program path remains the only persistence
commit for any future approved draft.

The routine builder is search-first and edit-on-demand:

- program management is collapsed into a compact header
- day tabs select the routine being edited
- exercise cards are compact by default
- only one exercise card expands at a time for editing
- custom display names are hidden behind an explicit checkbox
- superset pairing is lightweight and uses a simple partner selection control
- the Add Exercises modal stays open after add-mode selections and resets search for the next addition
- Added state is derived from the selected routine draft, so it remains correct after closing, reopening, or switching routines
- a provider failure keeps the picker open and exposes an explicit Retry action without changing the draft
- swap-mode still closes after the replacement exercise is selected

Duplicate provider exercise IDs are intentionally prevented within one
routine. The same provider exercise remains addable to a different routine.
Every accepted row still has its own `routineExerciseId`, which keeps editing,
reordering, and superset targeting deterministic.

Exercise add, swap, remove, reorder, configuration, and superset changes update
`programDrafts` only. They do not invoke local or cloud persistence directly;
Save Program normalizes and commits the complete draft. Routine creation,
duplication, and archive actions retain their existing structural-action save
behavior.

Regression-prone builder transformations are isolated in
`src/services/routineBuilder.js`. This includes legacy routine normalization,
duplicate-safe adding, swap/remove/reorder, superset cleanup, independent
routine duplication, and workout snapshot creation. Persistence serialization
and the local-first/cloud-fallback boundary are independently testable through
`programData.js` and `programPersistence.js`.

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
  images,
  imageUrl,
  aliases,
  defaultSets,
  defaultRepRange,
  defaultRestSeconds,
  source,
  sourceId,
  instructions,
}
```

`images` is always an array and `imageUrl` is either the preferred display
image or `null`. Image entries include:

```js
{
  id,
  url,
  isMain,
  license,
  licenseAuthor,
}
```

The routine editor keeps a local in-memory exercise library of fetched wger
results. This lets selected wger exercises continue rendering in the editor,
workout screen, and completed history snapshots during the current app session.

Exercise discovery is search-first. `searchExercises(query, filters)` loads an
English wger `exerciseinfo` pool, normalizes the result names and metadata,
deduplicates normalized results, and ranks by normalized name/alias relevance.
It does not use instruction text for direct search ranking.

Search normalization expands common gym shorthand and awkward wger naming
variants before ranking. Examples include `db`/`dbs`/`dumbbells` to
`dumbbell`, `bb` to `barbell`, `presses` to `press`, `benchpress` and
`bench-press` to `bench press`, plus `pull-down` and `push-down` variants.

The provider includes a small local alias layer for obvious common movements.
For example, dumbbell and barbell bench press variants can match searches such
as `db bench`, `dumbbell bench press`, and `flat dumbbell bench press` while
still returning wger-backed exercises.

The picker currently shows the muscle filter only when populated from current
search results. The equipment filter is hidden for now because wger equipment
metadata is often incomplete or too generic. Equipment is still displayed on
result cards when available.

The UI uses provider-neutral exercise-library copy. wger attribution belongs in
Settings/About, and image credits appear only inside expanded exercise details
when license metadata exists.

There is no full local exercise taxonomy, local catalog fallback, or local
result set.

## Dashboard Health Metrics

Manual steps are stored in `nevfit_steps` as a date-keyed object:

```js
{
  "2026-06-14": 10342
}
```

The dashboard average step metric uses saved entries from the last seven
calendar days including today, ignoring days without saved step data. The step
entry form defaults to yesterday and is collapsed behind the dashboard metric by
default.

Manual runs are stored in `nevfit_runs`:

```js
[
  {
    id,
    date,
    distanceKm,
    durationMinutes,
    notes
  }
]
```

Only `date` is required. The dashboard run count uses the same week-start logic
as completed workouts. `nevfit_weekly_run_target` persists the configurable
weekly target, currently exposed as 2 or 3.

## Backup And Restore

Settings includes Data Management controls for JSON backup export and import.

`src/services/backupService.js` exports:

- `createBackup(data)`
- `exportBackupFile(backup)`
- `validateBackup(value)`
- `importBackup(uid, backup)`

Export uses the current React state rather than querying Firestore directly and
downloads:

```text
nevfit-backup-YYYY-MM-DD.json
```

Backup shape:

```js
{
  exportedAt,
  version: 1,
  programs,
  planning,
  activeWorkout,
  completedWorkouts,
  health,
}
```

Import validates JSON parsing, version, and expected top-level sections before
asking for explicit confirmation. A confirmed import replaces the current
Firestore-backed account data instead of merging:

- program documents are deleted and recreated from the backup
- planning, active workout, and health app-state documents are overwritten
- completed workout documents are deleted and recreated from the backup

After a successful import, React state and localStorage caches are refreshed
from the imported backup.

## Firebase Identity Layer

Top-level navigation is transient UI state. A normal app launch starts at the
Dashboard and does not restore the last Programs/Routines or Settings view.
Selected program/routine IDs remain persisted domain context and are available
when the user explicitly opens the builder. During authenticated active-workout
hydration, a valid resumable workout still promotes the view to Workout; a
normal launch without one remains on Dashboard.

Firebase is initialized in `src/services/firebase.js`.

Authentication is isolated in `src/services/auth.js`:

- `signInWithGoogle()`
- `signOutUser()`
- `subscribeToAuthChanges(callback)`

The app tracks `currentUser` and `authLoading`. Signing in resolves cloud-backed
program, planning, and health state before showing the authenticated app.

When `authLoading` is true, the app shows a loading screen and does not flash
the main app. When `currentUser` is null, the app shows only the sign-in screen.
Program, planning, health, active workout, and completed workout history loading
can also show the loading screen while local/cloud migration resolves.

`src/services/userProfile.js` exports `ensureUserProfile(user)`, which creates
or updates `users/{uid}` with `setDoc(..., { merge: true })`. This is the only
profile Firestore write currently implemented.

`src/services/programStore.js` stores program and routine definitions at:

```text
users/{uid}/programs/{programId}
```

Each document keeps the existing program shape, including `id`, `name`, `days`,
routine exercises, archive/delete flags, optional description, and timestamps.
The service also writes a `routines` alias from `days` for the cloud document
while loading either shape back into the app's existing `days` model.

On authenticated load, the app reads `nevfit_programs`, then reads Firestore.
Non-empty Firestore programs are treated as the source of truth and refresh the
local cache. If Firestore is empty and local programs exist, the local programs
are uploaded once. If both are empty, the starter program initializes and is
cached locally. Explicit program saves, program creation, duplication, and
archive actions save to localStorage first, then attempt Firestore. Routine
exercise edits stay in the program draft until Save Program is selected.
Firestore failures leave local data intact and show a non-blocking sync warning.

Routine lifecycle operations use stable routine IDs inside each program. Active
routines preserve their stored order; adding, duplicating, or archiving a
routine updates the full program document through the existing persistence path.
Routine field edits remain draft-only until the explicit Save Program action.

`src/services/planningStore.js` stores planning state at:

```text
users/{uid}/appState/planning
```

The document contains:

```js
{
  schedule,
  activeProgramId,
  cycleStartDate,
  cycleLengthWeeks,
  updatedAt,
}
```

`src/services/healthStore.js` stores dashboard health state at:

```text
users/{uid}/appState/health
```

The document contains:

```js
{
  steps,
  runs,
  weeklyRunTarget,
  updatedAt,
}
```

Firestore is the source of truth for these app-state documents. If a document
exists, the app normalizes it into React state and refreshes the localStorage
cache. If a document does not exist, the app initializes it from the current
local cache/default state and saves it. Planning and health saves are queued so
rapid UI updates persist in order. Failures leave the local cache intact and
show a non-blocking sync warning.

`src/services/activeWorkoutStore.js` stores the resumable active workout at:

```text
users/{uid}/appState/activeWorkout
```

The document contains:

```js
{
  activeWorkoutSession,
  updatedAt,
}
```

The active workout session uses the existing in-progress workout snapshot
shape, including exercise IDs, snapped exercise names, prescribed sets,
`repRange`, rest timing, `supersetGroupId`, and logged set strings. Starting or
editing a workout saves the active session. Closing a blank workout or
completing a workout clears the active session. Workout-mode weight
carry-forward writes the next set's existing `weight` field through this same
active-session persistence path; it adds no history or Firestore schema. Before
Firestore writes, active-workout snapshots remove optional `undefined` fields
such as an omitted exercise note, because Firestore does not accept undefined
nested values. Development diagnostics report the attempted active-workout path,
uid presence, and Firestore error code/message without surfacing them in the UI.

`src/services/workoutHistoryStore.js` stores completed workout snapshots at:

```text
users/{uid}/completedWorkouts/{workoutId}
```

Completed workout records preserve the existing append-only snapshot model:
`completedAt`, schedule and routine IDs, routine name, exercise IDs, snapped
exercise names, rest seconds, `supersetGroupId`, and set values. If the cloud
collection is empty and local completed workouts exist, the local snapshots are
uploaded once during first migration. Previous performance continues to derive
from the cloud-loaded completed workout state.

Firestore rules are intentionally narrow:

- signed-in users can read/write only their own `users/{uid}` document
- signed-in users can read/write only their own
  `users/{uid}/programs/{programId}` documents
- signed-in users can read/write only their own
  `users/{uid}/completedWorkouts/{workoutId}` documents
- signed-in users can read/write only their own
  `users/{uid}/appState/{docId}` documents

## Future Storage

- Durable selected exercise metadata if offline reload behavior becomes
  important

## Static Assets

Timer completion audio lives under:

```text
public/sounds/rest-complete.wav
```

The rest timer uses this file through a small sound config and plays it twice
on completion, with mobile vibration where supported. Future timer sounds can
be added under `public/sounds/`.
