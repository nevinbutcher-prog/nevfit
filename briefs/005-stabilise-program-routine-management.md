PROJECT: Fitbot

CARD:
Stabilise program and multi-routine management

PHASE:
Foundation

PRIORITY:
High

OBJECTIVE:
Make Fitbot programs reliably support multiple routines and make the routine lifecycle safe before any deeper routine-builder UI redesign.

This card is specifically about program/routine state correctness and persistence. Do not implement the later compact routine-editor redesign, new search UX, focused exercise editor, superset redesign, or AI integration in this card.

CURRENT ARCHITECTURE:
Fitbot currently stores program definitions at:

`users/{uid}/programs/{programId}`

Program documents retain the existing program shape and use `days` as the application model, while the Firestore service also writes a `routines` alias for compatibility. Firestore is treated as the source of truth when cloud programs already exist, with `nevfit_programs` retained as a local cache/fallback.

Programs are editable separately from completed workout history. Workout sessions snapshot the selected routine at workout start, so changing a program/routine must not rewrite historical workout records.

The existing product is documented as supporting routine rename, duplicate, archive and add-routine behaviour, but current real-world use indicates multi-routine management is not behaving reliably.

PROBLEM:
A program currently behaves as though it can only reliably contain one routine, or routine lifecycle operations are not maintaining valid state when multiple routines are present.

The program/routine layer needs to support:

* multiple routines inside one program
* add routine
* rename routine
* switch/select active routine for editing
* duplicate routine
* remove/archive routine
* preserve routine order
* persist all changes across reload
* preserve Firestore/local cache semantics
* preserve existing workout compatibility

This should be treated as a state/persistence correctness task first, not a visual redesign.

TARGET BEHAVIOUR:

Example program:

`Simple Mass Builder`

* Routine A
* Routine B
* Routine C

The user should be able to:

1. create Routine B and Routine C
2. switch between all three without losing unsaved/committed data unexpectedly
3. rename any routine
4. duplicate an existing routine and receive an independent copy
5. archive/remove a routine safely
6. retain stable ordering
7. reload the app and see the same program/routine structure
8. sign in on the same account and retrieve the persisted program structure from Firestore
9. start workouts from any retained routine without breaking snapshot/history behaviour

IMPLEMENTATION REQUIREMENTS:

1. Inspect existing program/routine model before changing it
   Review:

* `src/App.jsx`
* `src/services/programStore.js`
* existing default/starter program data
* any routine/program normalization helpers
* any selected-program or selected-routine state
* any archive/delete flags
* localStorage handling for `nevfit_programs`

Determine the actual root cause of the current one-routine or unstable multi-routine behaviour before implementing a fix.

Report the root cause clearly after implementation.

2. Preserve the existing data model where possible
   Do not introduce a new Firestore schema unless the existing shape genuinely cannot support the required behaviour.

Current program storage is already designed to contain multiple routine/day definitions.

Prefer fixing:

* state transitions
* normalization
* identifiers
* selection logic
* lifecycle operations
* persistence

rather than replacing the whole model.

3. Routine identity must be stable
   Every routine within a program must have a stable unique identifier.

Requirements:

* adding a routine creates a unique ID
* duplicating a routine creates a new unique ID
* renaming does not change the ID
* reordering does not change the ID
* archive/remove must target the routine by ID, not array index or display name
* duplicate names must not cause routines to overwrite each other

Do not use routine name as identity.

4. Add routine
   Adding a routine should:

* add exactly one new routine to the current program
* generate a stable unique routine ID
* use a predictable initial name such as `Routine 2`, `Routine 3`, etc., unless the current implementation already has a better naming convention
* initialize the routine with an empty exercise list
* preserve all existing routines
* select the new routine for editing if that matches current interaction expectations
* persist only through the existing explicit save flow if that is the current program-builder contract

Do not redesign the add-routine UI in this card.

5. Rename routine
   Renaming should:

* update only the selected routine name
* not recreate the routine
* not change its ID
* not change exercise IDs or routine exercises
* not affect workout history
* persist after program save/reload

Prevent empty/whitespace-only names if existing validation supports that pattern.

Avoid adding elaborate validation UI.

6. Routine switching
   Switching between routines must not:

* replace another routine's data
* reset exercise lists
* overwrite draft values
* change routine IDs
* accidentally save one routine's state into another

Audit any state that currently assumes one selected routine/day.

The selected routine UI state should reference a stable routine ID rather than a fragile positional index where practical.

If index-based logic remains, ensure it remains correct after add/remove/reorder.

7. Duplicate routine
   Duplicating should:

* create a new routine ID
* copy the routine name using a reasonable suffix such as `Copy`
* deep-copy routine exercise configuration
* preserve:

  * exerciseId
  * sets
  * repRange
  * restSeconds
  * displayNameOverride
  * note
  * valid superset relationships
* ensure the duplicate is independent of the source routine

Mutating the duplicate must not mutate the original through shared object references.

Superset IDs inside the duplicated routine may be regenerated if needed to avoid future identity collisions, but the duplicated grouping semantics must remain intact.

Do not redesign the superset UX in this card.

8. Remove/archive routine
   Respect the existing application semantics for routine deletion/archive.

If routines are currently archived rather than hard-deleted, retain that model.

Requirements:

* removing/archive affects only the intended routine
* remaining routine order stays valid
* selected-routine state moves safely to a surviving routine
* no invalid selected ID/index remains
* the program itself remains valid
* completed workouts are untouched
* archived/deleted routines do not unexpectedly reappear after reload unless restore behaviour already exists

If the final active routine is removed, handle this deliberately:

* either allow an empty program
* or retain the existing product rule if one exists

Do not invent a new restriction without first inspecting current behaviour.

9. Preserve routine ordering
   The program's routine order must remain deterministic across:

* add
* duplicate
* remove/archive
* save
* reload
* Firestore load
* local cache fallback

Do not sort routines alphabetically unless that is already the explicit product behaviour.

Persist the user-visible order.

10. Preserve program save semantics
    The existing builder uses an explicit Save Program flow. The recent code intentionally made many program/routine field edits draft-only rather than persisting on every keystroke.

Preserve that behaviour.

Do not reintroduce per-keystroke Firestore/localStorage writes.

Structural actions may continue to persist if that is already current behaviour, but be consistent with the existing program-editor save contract.

11. Preserve Firestore/local cache behaviour
    Current program persistence rules are:

* Firestore source of truth when cloud programs exist
* `nevfit_programs` remains a local cache
* if Firestore is empty and local programs exist, upload local programs once
* if both are empty, initialize starter data
* failed Firestore writes leave local data intact and surface a non-blocking warning

Do not change those ownership rules.

Test multi-routine programs through both:

* local cache
* Firestore-backed authenticated load

12. Backward compatibility
    Existing programs created before this fix must continue to load.

Account for:

* programs with one routine
* programs with multiple routines
* older documents using `days`
* cloud documents exposing `routines`
* archive/delete flags
* older routine structures missing optional fields

Do not require a destructive migration.

Normalize existing data on load as needed.

13. Preserve workout compatibility
    Workout sessions snapshot the selected routine at start time.

Validate that after this change:

* any active routine can still start a workout
* routine exercise order is preserved
* exercise IDs remain stable
* display-name overrides still snapshot correctly
* sets, reps, rest and supersetGroupId continue into the workout snapshot
* completed history remains append-only
* editing/removing/renaming routines does not rewrite completed workout records

14. Error handling
    Routine lifecycle operations should fail safely.

Avoid:

* silently dropping routines
* selecting a nonexistent routine
* overwriting another routine
* replacing an entire program because one nested routine operation failed

Existing non-blocking sync warnings should remain appropriate for Firestore failures.

No new global error system is required.

TEST REQUIREMENTS:

Add or update focused tests where the current test setup supports them.

At minimum cover the following logic:

A. Add

* existing program with 1 routine
* add second routine
* first routine preserved
* new ID unique
* new routine selected appropriately

B. Add multiple

* add Routine 2 and Routine 3
* all routines retained
* ordering stable

C. Rename

* rename Routine B
* only its name changes
* ID and exercise data unchanged

D. Duplicate

* duplicate populated routine
* new ID created
* exercise configuration copied
* editing duplicate does not mutate source

E. Remove/archive

* remove middle routine from three
* first and third remain
* order remains valid
* selected state resolves safely

F. Reload/persistence

* save a multi-routine program
* reload from local cache
* structure preserved
* reload from Firestore
* structure preserved

G. Existing data

* load existing one-routine program
* no migration regression
* add second routine successfully

H. Workout compatibility

* start workout from more than one routine within the same program
* correct routine snapshot used

I. History safety

* rename/remove/archive/duplicate routines
* completed workout history count and content unchanged

MANUAL VALIDATION FLOW:

1. Sign in.
2. Open an existing one-routine program.
3. Add two additional routines.
4. Rename each routine.
5. Add different exercises/configuration to each.
6. Switch repeatedly between routines and confirm data stays with the correct routine.
7. Duplicate one routine.
8. Modify the duplicate and confirm the original remains unchanged.
9. Remove/archive one routine.
10. Save the program.
11. Reload the browser.
12. Confirm routine names, order and contents persist.
13. Confirm the Firestore program document contains the expected multi-routine structure.
14. Start a workout from at least two different routines.
15. Confirm the correct routine data is snapshotted into the active workout.
16. Confirm completed workout history has not been modified.

OUT OF SCOPE:
Do not implement these later cards early:

* compact routine-editor redesign
* exercise search redesign
* new Add Exercise feedback UX
* focused exercise configuration modal/sheet
* superset workflow redesign
* AI routine generation
* AI proposal contract
* broader program-builder visual overhaul
* workout tracking redesign
* Firestore schema rewrite

Small UI changes needed solely to expose/fix routine lifecycle operations are acceptable, but keep them minimal.

SUCCESS CRITERIA:
This card is complete when:

* one program can reliably contain multiple routines
* add/rename/switch/duplicate/remove/archive all operate on the correct routine
* routine identity and ordering remain stable
* changes survive reload
* authenticated Firestore sync preserves the full program
* existing programs still load
* workout-start snapshots still work
* completed workout history is unaffected
* no deeper builder redesign has been pulled into this card

DELIVERABLE REPORT:
At completion, report:

* root cause of the multi-routine failure
* files changed
* any normalization/migration changes
* whether routine identity handling changed
* whether program persistence changed
* automated tests added/updated
* manual validation performed
* any remaining limitations that belong to subsequent builder cards
