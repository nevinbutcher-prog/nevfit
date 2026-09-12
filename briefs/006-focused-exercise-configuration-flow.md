PROJECT: Fitbot

CARD:
Create a focused exercise configuration flow

PHASE:
Core UX

PRIORITY:
High

OBJECTIVE:
Move routine-specific exercise configuration out of the current oversized expanded exercise card and into a focused editor/sheet that exposes only the controls needed to configure that exercise inside the routine.

The goal is to make sets, rep range, rest, display name, swap and remove easy to access without forcing the user to scroll through images, instructions, attribution, metadata or superset controls.

This card should improve the editing experience without changing the underlying routine data model or workout snapshot semantics.

CURRENT STATE:
Fitbot already has:

* compact exercise rows by default
* single-item expanded editing
* provider-backed exercise metadata and images
* optional `displayNameOverride`
* sets / rep range / rest editing
* swap/remove actions
* current superset controls
* program save semantics that avoid per-keystroke persistence

The problem is that the expanded edit state is still overloaded with secondary information. Current screenshots show the user must scroll through exercise instructions, image content, metadata and other controls before reaching sets/reps/rest and swap/remove actions.

CURRENT ROUTINE EXERCISE SHAPE:
Routine exercises currently normalize around:

```js
{
  exerciseId,
  sets,
  repRange,
  restSeconds,
  displayNameOverride,
  note,
  supersetGroupId,
}
```

Preserve this structure unless a minimal supporting UI-state change is required.

Workout sessions snapshot the effective exercise name and current routine prescription at workout start. Preserve that behavior.

TARGET EXPERIENCE:
Tapping Edit on a compact routine exercise should open a focused configuration surface.

Suggested contents:

```text
Edit Exercise

Dumbbell Bench Press
Chest · Dumbbell

Sets
[ 3 ]

Rep range
[ 8–12 ]

Rest
[ 120 sec ]

[ ] Use custom display name
[ DB Bench Press ]

Swap Exercise

Remove from Routine
```

The user should not have to scroll through:

* long instructions
* exercise images
* image attribution
* secondary muscle lists
* provider metadata
* superset partner buttons

before reaching configuration controls.

IMPLEMENTATION REQUIREMENTS:

1. Inspect current edit-state architecture
   Review:

* routine exercise expansion logic in `src/App.jsx`
* any exercise edit helpers/components
* provider metadata rendering
* image/instruction sections
* swap/remove handlers
* `displayNameOverride` handling
* save/draft behavior
* current superset UI placement

Determine the cleanest way to isolate routine configuration from secondary exercise information without rewriting unrelated builder architecture.

2. Introduce a focused editor surface
   Use one of:

* modal
* bottom sheet
* focused inline panel
* dedicated edit subview

Choose the option that best fits the current app architecture and mobile layout.

Preference:

* mobile-friendly
* visually isolated from the routine list
* compact enough that sets/reps/rest are immediately visible

Do not build a large new navigation system.

3. Prioritise routine-relevant controls
   The focused editor should expose by default:

* exercise identity/name
* sets
* rep range
* rest
* optional custom display name
* swap exercise
* remove exercise

Keep those controls near the top of the edit surface.

4. Keep exercise identity stable
   Changing routine configuration must not replace the underlying `exerciseId`.

Requirements:

* sets changes keep the same `exerciseId`
* rep-range changes keep the same `exerciseId`
* rest changes keep the same `exerciseId`
* custom display name changes keep the same `exerciseId`
* only Swap should replace the underlying exercise selection

Do not use display name as identity.

5. Preserve display-name override semantics
   Keep current behavior:

Effective routine name:

`displayNameOverride || exercise.name`

Requirements:

* checkbox/toggle enables custom display name
* disabling the override returns to provider exercise name
* editing the override must not change exercise ID
* saved override persists through program save/reload
* workout-start snapshots continue storing the effective exercise name

6. Keep sets/reps/rest easy to edit
   The user should not need excessive scrolling.

Prefer compact controls.

Requirements:

* sets remains numeric
* rep range remains compatible with current string format, e.g. `8-12`
* rest remains numeric seconds
* current validation/default behavior remains intact where sensible

Do not introduce a new prescription model.

7. Preserve explicit save semantics
   Current program/routine field edits are draft-only until Save Program.

Preserve this behavior.

Do not reintroduce per-keystroke Firestore/localStorage persistence.

The focused editor may update local draft state immediately, but persistent commit should follow the existing program save contract.

8. Swap Exercise
   Keep Swap accessible from the focused editor.

Do not redesign the search/swap experience in this card.

The current swap flow may continue to open the existing exercise picker.

Requirements:

* swapped exercise receives the newly selected stable `exerciseId`
* preserve current handling of sets/reps/rest unless existing swap semantics intentionally reset them
* do not change search provider behavior
* do not implement repeated-add improvements here

9. Remove Exercise
   Make removal deliberate but easy to access.

Requirements:

* use the existing remove behavior
* avoid accidental destructive taps
* confirmation is acceptable if consistent with current UX
* removing one exercise must not corrupt routine order or other exercise configuration
* preserve current superset cleanup behavior

Do not redesign archive semantics or routine deletion here.

10. Remove secondary detail from the configuration path
    The focused configuration surface should not display by default:

* full exercise instructions
* large exercise images
* image credits
* verbose metadata
* full secondary-muscle lists

If exercise details still need to remain accessible:

* keep them behind a separate Details action
* or preserve an existing details affordance outside the focused editor

Do not delete metadata or image capability from the product.

11. Do not redesign supersets in this card
    The current superset workflow has a dedicated later card.

For this card:

* preserve existing `supersetGroupId`
* preserve current grouping behavior
* do not invent new pairing UX
* if existing superset controls currently live inside the giant expanded editor, keep them accessible in the least disruptive way possible until the dedicated card replaces them

Important:
Do not pull the future superset redesign forward.

12. Preserve exercise metadata resolution
    Do not change:

* exercise provider
* search semantics
* wger normalization
* metadata rehydration
* image handling

The focused editor may display only a concise name/muscle/equipment summary.

If metadata is unavailable, still allow editing based on saved routine data.

13. Preserve workout snapshot semantics
    Validate that routine changes continue to flow correctly into new workouts.

At workout start, preserve:

* `exerciseId`
* effective exercise name
* sets
* `repRange`
* `restSeconds`
* `supersetGroupId`

Completed history must remain append-only and unaffected by routine edits.

14. Error handling
    The focused editor must fail safely.

Handle:

* missing provider metadata
* stale exercise references
* invalid sets/reps/rest input
* swap picker cancellation
* remove cancellation
* program save failure

Existing non-blocking sync warnings should remain in place for persistence failures.

Do not create a new global error framework.

UX REQUIREMENTS:
The edit experience should feel fast on a phone.

Prefer:

* direct labels
* compact fields
* minimal scrolling
* clear hierarchy
* restrained destructive styling
* obvious Done/Close behavior if using modal/sheet

Avoid:

* giant cards
* nested borders
* verbose helper text
* long instructions in the edit path
* duplicate actions
* multiple unrelated sections open at once

TEST REQUIREMENTS:

Add/update focused tests where practical.

At minimum cover:

A. Open/close edit flow

* tap Edit on a routine exercise
* focused editor opens for the correct exercise
* closing returns to compact list
* another exercise can be edited independently

B. Sets

* change sets
* value remains attached to correct routine exercise
* persists after Save Program/reload

C. Rep range

* change rep range
* persists after save/reload
* workout snapshot receives updated value

D. Rest

* change rest seconds
* persists after save/reload
* workout snapshot receives updated value

E. Display name override

* enable override
* edit name
* save/reload
* underlying `exerciseId` unchanged
* workout snapshot uses override
* disable override and provider name returns

F. Swap

* open swap flow
* select replacement exercise
* new exercise ID saved correctly
* routine remains valid

G. Remove

* remove exercise
* only intended exercise disappears
* routine order remains valid
* no history is altered

H. Metadata independence

* exercise metadata unavailable
* editor still opens with saved routine configuration

I. Persistence safety

* draft edits do not trigger per-keystroke Firestore writes
* Save Program still performs the commit

J. Workout compatibility

* start workout after configuration edits
* active workout contains correct prescription and identity

MANUAL VALIDATION FLOW:

1. Open a routine with several exercises.
2. Tap Edit on one exercise.
3. Confirm sets/reps/rest are visible immediately without scrolling through instructions/images.
4. Change:

   * sets
   * rep range
   * rest
5. Enable custom display name and enter a custom name.
6. Close the editor.
7. Open another exercise and confirm first exercise remains unchanged.
8. Reopen the first exercise and confirm draft values remain.
9. Save Program.
10. Reload.
11. Confirm all values persist.
12. Test Swap.
13. Test Remove.
14. Start a workout from the routine.
15. Confirm the workout snapshot uses the updated prescription and effective exercise name.
16. Confirm completed workout history is untouched.

OUT OF SCOPE:
Do not implement:

* new exercise search/repeated-add UX
* Add/Added feedback
* superset workflow redesign
* AI routine generation
* AI proposal contract
* routine-list redesign beyond what is needed to launch the focused editor
* Firestore schema changes
* workout tracker changes
* exercise-provider changes

SUCCESS CRITERIA:
This card is complete when:

* Edit opens a focused exercise configuration surface
* sets/reps/rest are immediately accessible
* optional display-name editing remains supported
* swap/remove remain available
* rich exercise details no longer obstruct configuration
* stable exercise identity is preserved
* program save semantics are unchanged
* saved values persist after reload
* workout snapshots reflect updated routine values
* completed history remains untouched
* superset redesign has not been pulled forward

DELIVERABLE REPORT:
At completion, report:

* files changed
* focused editor pattern chosen
* fields/actions moved into it
* any temporary handling retained for supersets
* whether persistence behavior changed
* tests added/updated
* manual validation performed
* any remaining UX limitations deferred to later cards
