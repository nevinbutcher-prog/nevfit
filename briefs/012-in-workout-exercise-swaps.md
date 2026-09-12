
PROJECT: Fitbot

CARD:
Support for in workout swaps - ie, machine not available etc - tied to AI suggestions

OBJECTIVE:
Allow a user to swap an exercise during an active workout when the planned movement is unavailable or unsuitable, while preserving workout history integrity and leaving a clean hook for future AI-assisted substitution suggestions.

This card should implement the deterministic workout-swap capability first.

Do **not** implement GPT/OpenAI calls, coaching chat, model prompts, or automated AI recommendations in this card.

TARGET USER SCENARIO:
A user starts a workout containing:

`Leg Press`

The machine is occupied.

From the active workout, the user chooses:

`Swap exercise`

They select a replacement such as:

`Hack Squat`

The current active workout updates to use Hack Squat for that exercise slot.

The saved program/routine remains unchanged unless the user explicitly chooses to update it later.

Completed workout history must record what was actually performed.

CORE PRODUCT RULE:
**An in-workout swap changes the current workout instance, not the underlying saved routine.**

This distinction is critical.

CURRENT ARCHITECTURE:
Fitbot active workouts are resumable snapshots persisted separately from program definitions.

Active workout state is stored at:

`users/{uid}/appState/activeWorkout`

Completed workout snapshots are stored append-only at:

`users/{uid}/completedWorkouts/{workoutId}`

Workout sessions already snapshot:

* exercise IDs
* effective exercise names
* prescribed sets
* rep range
* rest timing
* supersetGroupId
* logged set values

The routine definition and workout history are intentionally separate.

IMPLEMENTATION REQUIREMENTS:

1. Inspect active workout model and rendering
   Review:

* workout-mode rendering in `src/App.jsx`
* active workout snapshot shape
* active-workout persistence service
* completed workout creation
* previous-performance lookup
* exercise provider lookup/search
* current swap logic in routine builder, if reusable
* superset rendering/grouping

Do not assume routine-builder swap behavior can be copied directly without considering active-workout history semantics.

2. Add in-workout Swap Exercise action
   Provide a clear but secondary action for each active workout exercise.

Possible placement:

* exercise overflow menu
* `⋯`
* small `Swap` action near Details

Avoid placing a large destructive-looking button beside set entry fields.

The swap action should remain accessible on mobile without cluttering normal logging.

3. Use an explicit confirmation/selection flow
   Selecting Swap should open a focused exercise picker.

Reuse the existing provider-neutral exercise search infrastructure where practical.

The user should be able to:

* search exercises
* choose one replacement
* cancel without changing anything

This is single-select replacement behavior.

Do not use the repeated-add interaction model from routine building.

4. Preserve original workout-plan context
   The active workout should retain enough information to know both:

* what was originally prescribed
* what was actually performed

If current active workout exercise snapshots do not support this distinction, add minimal backward-compatible fields.

Suggested shape:

```js
{
  exerciseId: "replacement-id",
  exerciseName: "Hack Squat",

  originalExerciseId: "leg-press-id",
  originalExerciseName: "Leg Press",

  ...
}
```

Alternative naming is acceptable if consistent with existing conventions.

Requirements:

* unswapped exercises need not duplicate unnecessary data
* historical records should remain backwards compatible
* older workout records without swap metadata must continue loading

5. Do not mutate saved routine
   An in-workout swap must not update:

* program definition
* routine exerciseId
* routine display name
* routine ordering
* Firestore program document

The next time the routine is started, it should still contain the originally programmed exercise.

Permanent program changes belong to the routine builder.

6. Replacement prescription semantics
   Define and preserve the existing prescribed structure.

By default, the replacement should inherit the current workout slot's:

* number of sets
* rep range
* rest seconds

Reason:
The swap is replacing a movement in the planned workout, not rebuilding the program.

Allow current logged set state to determine whether replacement is safe.

7. Pre-logging swap
   If no meaningful sets have yet been logged for the exercise:

* allow straightforward replacement
* preserve prescribed sets/reps/rest
* clear any exercise-specific transient UI state where appropriate

This should be the simplest case.

8. Swap after sets have been logged
   Handle deliberately.

Preferred behavior:
If meaningful sets have already been logged for the exercise, do not silently replace the exercise and reinterpret those sets as belonging to the replacement.

Options:

* block swap and explain why
* or explicitly ask whether to keep completed sets under the original exercise and continue with replacement

For V1, prefer the simpler safe behavior unless current workout structure already supports mixed exercise segments cleanly.

Recommended V1:
**Allow swap only before any meaningful sets are logged for that exercise.**

If data exists, show:
`You’ve already logged sets for this exercise. Clear those sets before swapping.`

Do not destroy logged data automatically.

9. Previous-performance behavior
   After swapping:

* do not show the original exercise’s previous performance as though it belongs to the replacement
* where existing workout UI displays previous performance, resolve it using the replacement's stable `exerciseId`

If no history exists for replacement:

* show the normal no-history state

Do not merge histories based on slot position or exercise name.

10. Superset behavior
    Handle swaps inside supersets carefully.

If an exercise is part of a superset:

* preserve its existing `supersetGroupId`
* replacing the movement should not break the grouping
* the replacement occupies the same group slot

Do not redesign superset behavior.

Example:
A1 Chest Press
A2 Cable Row

If Chest Press becomes Dumbbell Bench:

* Dumbbell Bench remains A1
* Cable Row remains A2

11. Active workout persistence
    After swap:

* update active workout state immediately
* save through existing active-workout persistence
* local cache and Firestore sync should retain the replacement after reload/resume

Verify:

* reload browser
* resume active workout
* swapped exercise remains in place
* original prescribed exercise metadata remains available where stored

12. Completed workout history
    When workout is finished, completed history should reflect what actually happened.

For a swapped slot, persist:

* performed exercise ID/name
* original exercise ID/name where swap metadata exists
* logged sets
* prescription
* superset grouping

Do not rewrite old completed workout schemas destructively.

13. UI representation after swap
    Make it understandable that a substitution occurred.

Suggested compact treatment:

`Hack Squat`
`Swapped from Leg Press`

Avoid noisy warning styling.

This should remain visible during workout and in future history/detail views if those surfaces consume the metadata.

Do not implement a broader history redesign in this card.

14. Provide Undo before logging
    If no replacement sets have been logged yet, consider a lightweight:

`Undo swap`

or:

`Restore Leg Press`

This is useful but optional.

If implemented:

* restore original exerciseId/name
* preserve prescription
* remove swap metadata
* do not affect routine data

Do not overcomplicate V1 if it materially increases scope.

15. Future AI suggestion boundary
    Prepare a clean deterministic interface that future AI coaching can call into.

For example:

```js
swapActiveWorkoutExercise({
  workout,
  workoutExerciseId,
  replacementExercise
})
```

or equivalent pure/helper logic.

The future AI layer should be able to propose:

`Leg Press unavailable — substitute Hack Squat?`

but applying that suggestion must ultimately use the same validated swap path as a manual user selection.

Do not create separate AI mutation logic.

16. AI suggestions remain future scope
    Do not implement:

* GPT calls
* OpenAI API
* prompt design
* recommendation ranking
* chat UI
* automatic substitutions
* model-selected exercise changes
* token/spend handling

The only AI-related requirement is to keep the swap operation reusable by a future suggestion/approval layer.

17. Exercise compatibility metadata
    Do not attempt to build a full substitution taxonomy in this card.

Manual replacement search can expose the normal exercise library.

Do not add speculative logic such as:

* muscle-equivalence scoring
* equipment-equivalence scoring
* movement-pattern ontology
* AI-generated suitability scores

Those belong to the coach integration phase.

18. Error handling
    Handle:

* provider unavailable
* search failure
* replacement exercise metadata missing
* active workout save failure
* stale workout state
* attempted swap after logged sets

Failures should not alter the current active exercise unless the replacement operation completes successfully.

19. Backward compatibility
    Older active/completed workout records without:

* originalExerciseId
* originalExerciseName
* swap metadata

must continue to render and load normally.

No destructive migration.

20. History integrity
    Do not alter completed historical workouts when swapping during a current session.

The swap only affects:

* current active workout
* eventual completed snapshot of that current workout

Existing completed workouts remain immutable.

TEST REQUIREMENTS:

Add focused tests around the transformation/helper logic.

At minimum cover:

A. Basic swap

* active exercise A
* swap to B
* B becomes performed exercise
* original A metadata retained
* sets/reps/rest preserved

B. Routine isolation

* active workout swapped
* source routine remains unchanged

C. Active persistence

* swapped active workout serializes/deserializes correctly

D. Completion

* finished workout records performed exercise B
* original A retained as swap source metadata

E. Previous performance

* after swap, history lookup uses B exerciseId

F. Superset

* swap grouped exercise
* supersetGroupId preserved

G. Logged-set protection

* meaningful sets exist
* swap rejected
* logged values unchanged

H. Cancel

* open picker/cancel
* active workout unchanged

I. Provider error

* search failure
* active exercise unchanged

J. Backward compatibility

* old active/completed records without swap fields normalize correctly

K. Mutation safety

* helper does not mutate original input object unexpectedly

MANUAL VALIDATION FLOW:

1. Start a workout.
2. Find an exercise with no sets logged.
3. Select Swap.
4. Search for replacement exercise.
5. Cancel and confirm nothing changes.
6. Reopen and select replacement.
7. Confirm:

   * new exercise shown
   * original exercise indicated quietly
   * sets/reps/rest unchanged
8. Confirm previous-performance display now reflects replacement exercise history.
9. Reload/resume active workout.
10. Confirm swap survives.
11. If exercise is in a superset, confirm grouping remains intact.
12. Complete workout.
13. Confirm completed snapshot records performed replacement.
14. Confirm original programmed movement is preserved as swap metadata.
15. Start the saved routine again.
16. Confirm original programmed exercise is back.
17. Log a set on another exercise.
18. Attempt Swap.
19. Confirm swap is safely blocked and logged set remains intact.
20. Confirm older workout history remains unchanged.

OUT OF SCOPE:
Do not implement:

* actual AI suggestions
* AI chat
* automatic exercise substitutions
* permanent routine updates from workout mode
* substitution scoring/taxonomy
* history screen redesign
* routine-builder changes
* exercise-provider overhaul
* equipment availability tracking

SUCCESS CRITERIA:
This card is complete when:

* an exercise can be safely swapped during an active workout before logging begins
* the replacement uses a stable exercise ID
* prescription and superset slot are preserved
* the original programmed exercise remains traceable
* saved routine is not modified
* active workout persistence survives reload
* previous performance resolves against the replacement
* completed history records what was actually performed
* existing history remains untouched
* logged sets cannot be silently reassigned
* the swap operation is reusable by a future AI suggestion/approval layer
* no GPT/AI integration has been implemented prematurely

DELIVERABLE REPORT:
At completion, report:

* files changed
* active-workout swap data shape
* whether new backward-compatible fields were added
* swap eligibility rules
* previous-performance behavior
* superset handling
* routine isolation confirmation
* tests added/updated
* manual validation performed
* future AI hook/interface created
* anything intentionally deferred to the AI coaching sequence
