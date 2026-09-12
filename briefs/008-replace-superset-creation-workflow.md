PROJECT: Fitbot

CARD:
Replace the superset creation workflow

PHASE:
Routine Structure

PRIORITY:
High

OBJECTIVE:
Replace the current inline “wall of buttons” superset UI with a focused, explicit pairing flow that uses exercises already present in the routine.

The user should be able to:

* choose an exercise
* explicitly pair it with another valid exercise in the same routine
* understand which exercises are grouped
* change or remove the grouping
* preserve workout-mode superset behavior

Do not change the underlying `supersetGroupId` model unless a minimal normalization fix is genuinely required.

CURRENT ARCHITECTURE:
Routine exercises already store:

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

Supersets are represented by a shared `supersetGroupId`, not one-way links.

Current semantics:

* pairing two ungrouped exercises creates a new shared `ss-*` group ID
* pairing with an exercise already in a group joins that group
* removing a pairing or deleting an exercise cleans up orphaned single-member groups
* active/completed workout snapshots preserve `supersetGroupId`
* workout mode uses the grouping visually without changing timer behavior

The current UI exposes superset partner choices inline and is difficult to use on mobile.

TARGET EXPERIENCE:
Superset creation should be deliberate and focused.

Suggested flow:

```text
Edit Exercise

Chest Press
3 × 8–12 · 120 sec

Superset
Not paired

[ Pair with exercise ]
```

Tap `Pair with exercise`:

```text
Create Superset

Pair Chest Press with:

○ Lat Pulldown
○ Seated Row
○ Lateral Raise
○ Tricep Pushdown

[ Cancel ]
```

After pairing:

```text
Superset
Paired with Lat Pulldown

[ Change pairing ]   [ Remove superset ]
```

In the compact routine list, grouped exercises should be visually obvious without destroying normal ordering.

Example:

```text
A1  Chest Press
    3 × 8–12 · 120 sec

A2  Lat Pulldown
    3 × 8–12 · 120 sec
```

or equivalent visual grouping.

IMPLEMENTATION REQUIREMENTS:

1. Inspect current superset implementation first
   Review:

* current pairing handlers
* `supersetGroupId` generation
* group cleanup logic
* exercise deletion behavior
* routine reordering behavior
* workout-mode grouping
* current inline superset controls
* focused exercise editor introduced by the previous card

Preserve existing valid semantics where possible.

2. Remove inline partner-button wall
   Do not render every eligible routine exercise as a full inline button inside the main exercise editor.

Replace with one compact superset section showing:

* current pairing state
* one focused action to create/change pairing
* one clear remove/unpair action when paired

3. Pair only against exercises in the current routine
   Eligible partner candidates should come from the current routine draft.

Exclude:

* the exercise itself
* removed/archived exercises
* invalid/missing entries

Do not search the global exercise provider for superset partners.

4. Use stable routine-item identity
   Do not identify pairing candidates by display name.

Use the routine exercise entry identity/state already used by the current builder.

If routine exercise items do not yet have a stable per-instance identity separate from `exerciseId`, inspect carefully before changing anything.

Important:
The same underlying exercise may legitimately appear more than once in a routine.

Do not assume `exerciseId` alone uniquely identifies a routine row if current data permits duplicates.

Avoid broad schema changes in this card.

5. Preserve shared `supersetGroupId` semantics
   Keep the existing grouping model.

Pairing two ungrouped exercises:

* create a new shared group ID
* assign it to both entries

Pairing an ungrouped exercise with a grouped exercise:

* join the existing group if current semantics support groups larger than two

If the product currently intends supersets to be pairs only, preserve that restriction rather than introducing giant groups.

Inspect current behavior and report the decision.

6. Explicit change pairing flow
   If the exercise is already paired, allow:

* Change pairing
* Remove superset

Changing pairing must:

* update the intended entries only
* clean up the previous group
* avoid leaving stale one-member groups
* preserve unrelated groups

7. Remove/unpair semantics
   Removing a superset relationship should:

* clear the appropriate group membership
* normalize any leftover single-member group back to `supersetGroupId: null`
* not alter sets/reps/rest/name/order
* not remove exercises from the routine

8. Delete behavior
   If an exercise participating in a superset is removed:

* remove that exercise normally
* inspect the remaining group
* clean orphaned single-member groups
* preserve valid groups with 2+ remaining members if supported

Do not leave dangling group IDs.

9. Reordering behavior
   Routine reorder must not break grouping.

If exercises are moved:

* preserve `supersetGroupId`
* preserve correct workout-mode grouping

Do not force grouped exercises to be adjacent unless that is already a product requirement.

If adjacency is visually useful, treat it as presentation, not silent data reordering.

10. Compact routine-list presentation
    Make grouped exercises visually obvious in the compact routine editor.

Possible treatments:

* A1 / A2 labels
* shared bracket/rail
* subtle grouped background
* Superset badge
* connected accent line

Requirements:

* preserve normal list order
* avoid excessive visual chrome
* make it obvious which exercises belong together
* keep ungrouped exercises visually unchanged

Do not redesign the whole routine list.

11. Focused selector UX
    Use a modal, bottom sheet, or compact selection panel consistent with the focused exercise editor.

Each candidate should show only enough context to distinguish it:

* exercise name
* optional sets/reps
* optional existing superset state

Avoid:

* images
* long instructions
* full metadata

12. Existing-group clarity
    If a candidate already belongs to a superset/group:

* communicate that clearly
* prevent ambiguous destructive reassignment

If pairing into an existing group is allowed, show what will happen.

If it is not allowed, disable the candidate with a concise explanation.

Do not silently break another superset.

13. Preserve draft/save semantics
    Superset edits should update the existing routine draft.

Do not introduce direct Firestore writes.

`Save Program` remains the persistence boundary.

14. Preserve Firestore and routine schema
    Do not change:

* program document path
* Firestore source-of-truth behavior
* local `nevfit_programs` cache semantics
* workout history schema

No migration should be required unless current malformed group data needs normalization.

15. Workout-mode compatibility
    Validate that saved superset changes still snapshot correctly into active workouts.

Workout snapshot must preserve:

* exercise order
* exercise identity
* effective names
* sets/reps/rest
* `supersetGroupId`

Existing workout-mode grouped display must remain correct.

Do not redesign workout tracking in this card.

16. Backward compatibility
    Existing routines with:

* no groups
* valid superset groups
* legacy `groupId`
* orphaned malformed groups

must load safely.

Current normalization already migrates older `groupId` values into `supersetGroupId`. Preserve that behavior.

If malformed one-member groups are encountered, normalize safely without destroying valid grouping.

17. Error handling
    The pairing flow should fail safely if:

* selected candidate disappears during editing
* current routine changes unexpectedly
* invalid/stale group state is encountered
* save later fails

Do not silently assign a wrong partner.

Use the existing non-blocking save/sync error handling.

TEST REQUIREMENTS:

Add/update focused tests where practical.

At minimum cover:

A. Pair two ungrouped exercises

* both receive same new group ID
* unrelated exercises remain null

B. Remove pairing

* both become ungrouped where appropriate
* no orphan group remains

C. Change pairing

* A paired with B
* change A to C
* old grouping cleans correctly
* new grouping is valid

D. Delete grouped exercise

* delete one member
* remaining single member normalizes to null

E. Reorder grouped exercises

* reorder routine
* grouping remains attached correctly

F. Existing grouped candidate

* behavior follows current pair/group semantics
* unrelated group is not silently destroyed

G. Duplicate underlying exercise IDs

* if same base exercise appears twice, pairing targets correct routine entry
* no accidental cross-targeting by name/exerciseId

H. Save/reload

* create superset
* Save Program
* reload
* grouping persists

I. Workout snapshot

* start workout
* grouped exercises carry correct `supersetGroupId`
* workout grouping remains correct

J. Legacy normalization

* older `groupId` data still loads correctly

MANUAL VALIDATION FLOW:

1. Open a routine with at least 5 exercises.
2. Edit an unpaired exercise.
3. Choose Pair with exercise.
4. Confirm only valid routine exercises appear.
5. Pair with another exercise.
6. Return to routine list.
7. Confirm grouping is visually obvious.
8. Edit the grouped exercise.
9. Change its pairing.
10. Confirm old relationship is cleaned up.
11. Remove the superset.
12. Confirm both exercises return to normal.
13. Create another superset.
14. Reorder the exercises.
15. Confirm grouping survives.
16. Delete one member.
17. Confirm no orphan group remains.
18. Save Program.
19. Reload.
20. Confirm grouping persists.
21. Start a workout.
22. Confirm workout-mode grouping is correct.

OUT OF SCOPE:
Do not implement:

* AI routine generation
* AI proposal contract
* broader compact-list redesign
* exercise search redesign
* new workout-mode superset UI
* timer behavior changes
* Firestore schema changes
* circuit/set-system redesign
* arbitrary drag-grouping gestures

SUCCESS CRITERIA:
This card is complete when:

* the inline wall-of-buttons superset UI is gone
* pairing uses a focused selector
* current pairing state is clear
* change/remove actions are unambiguous
* compact routine list clearly shows grouped exercises
* `supersetGroupId` semantics remain valid
* orphaned groups are cleaned correctly
* reorder/delete operations do not corrupt grouping
* Save Program/reload preserves groups
* workout-mode grouping still works
* no later AI or workout-redesign scope has been pulled forward

DELIVERABLE REPORT:
At completion, report:

* files changed
* pairing UI pattern chosen
* current group-size semantics discovered/preserved
* any routine-item identity concerns found
* orphan cleanup behavior
* compact-list visual treatment
* tests added/updated
* manual validation performed
* any limitations intentionally deferred
