
PROJECT:
NevFit

CARD:
Title: Fix mobile workout set entry lifecycle

Description:
Correct the workout logging input behaviour uncovered during live mobile testing.

The current set-entry flow is committing values too aggressively and allowing state to leak between rows. During testing:
- Entering a weight such as 40 into Set 1 can leave a partial value such as 4 in Set 2.
- Sets can be marked complete before reps have been entered.
- Entering a multi-digit rep value such as 13 can commit immediately after the first digit, treating 1 as the finished value.
- Completing Set 2 can unexpectedly collapse the entire exercise while the user is still actively logging it.

Workout entry must behave like a conventional mobile form: keystrokes update only the field currently being edited. They must not implicitly complete a set, advance to another row, collapse an exercise, or populate another set.

Preserve the existing active-workout autosave/resume behaviour, but separate persistence from UI completion semantics. Saving a draft value to the active workout is not the same thing as declaring the set complete.

SCOPE:
Fix only the workout set-entry lifecycle, completion rules, focus/advance behaviour and related state handling.

Do not redesign the workout screen generally.
Do not change historical workout storage.
Do not introduce AI/progression features.
Do not change routine-builder set definitions.
Do not alter rest-timer behaviour except where timer start is currently incorrectly coupled to premature set completion.

REQUIRED BEHAVIOUR:

1. Keep each set row independent
- Each set must have its own weight and reps values.
- Editing Set 1 must never modify Set 2 or any other set.
- Verify React list keys are stable and derived from persistent set identity/index rather than transient input state.
- Verify weight/reps fields are not sharing draft state or event handlers in a way that causes values to bleed between rows.
- Re-rendering after persistence must preserve the exact currently entered values.

Example:
Set 1 weight:
40

Expected:
Set 1 = 40
Set 2 = blank
Set 3 = blank

At no point should Set 2 temporarily become 4 or 40.

2. Treat typing as draft editing only
Input `onChange` must:
- update the relevant field
- update/persist the active workout draft as appropriate

Input `onChange` must NOT:
- mark the set complete
- start the rest timer
- move focus
- advance to another set
- collapse the exercise
- infer that a valid-looking numeric value represents finished input

A user must be able to enter normal multi-digit values without interruption.

Examples that must work:
- weight: 4 → 40
- weight: 8 → 80
- reps: 1 → 13
- reps: 1 → 12
- reps: 2 → 20

Typing the first digit must never commit the field as final.

3. Separate persisted values from completion state
Preserve autosave/resumability of the active workout.

It is acceptable for NevFit to persist:
weight = "40"
reps = ""

while the user is still editing.

That persisted draft must remain an incomplete set.

Do not use a generic rule such as:
- value is truthy
- weight exists
- reps exists
- any field changed

as the set-completion trigger.

Set completion must be explicit and deterministic.

4. Define set completion correctly
For standard weighted exercises, a set should only be eligible for completion when both required fields contain valid values:
- weight
- reps

Example:
40 / blank = incomplete
blank / 13 = incomplete
40 / 13 = eligible for completion

Maintain compatibility with any existing exercise/set types where zero or a blank weight is legitimately supported. Do not break bodyweight or other existing logging cases simply by requiring weight > 0 globally.

If NevFit already has exercise-specific completion rules, preserve them and fix the lifecycle around them rather than replacing them with a blanket rule.

5. Use deliberate field-finalisation events
Prefer the mobile keyboard workflow:

Weight
→ Next
→ Reps
→ Done
→ complete current set
→ focus next set's Weight field

The precise implementation can use:
- keyboard submit / Enter
- blur where appropriate
- explicit field-finalisation handler

but it must not treat ordinary `onChange` as submission.

Configure suitable mobile input attributes where supported:
- numeric input mode
- Weight field should indicate Next when another field follows
- Reps field should indicate Done/Next according to the remaining workflow

Desktop keyboard behaviour should remain sensible.

6. Predictable focus movement
After completing the reps entry for a valid set:
- mark only that set complete
- if another set exists, focus that next set's Weight input
- do not pre-populate the next row accidentally
- preserve existing values if the next set already contains a resumed draft

Example:
Set 1: 40 × 13
User finishes reps.

Expected:
✓ Set 1
cursor/focus → Set 2 Weight

Not:
✓ Set 1
✓ Set 2

and not:
Set 2 weight = 4

7. Stop premature exercise collapse
Do not automatically collapse an exercise merely because a set has completed.

During active logging, the exercise should remain open and stable.

In particular:
- completing an intermediate set must never collapse the exercise
- moving to the next set must keep the exercise open
- opening the mobile numeric keyboard must not result in a state transition that collapses the card

For this card, prefer removing automatic post-completion collapse rather than attempting to make it smarter.

If there is an existing explicit user collapse control, preserve it.

8. Final-set behaviour
When the last set is completed:
- mark the final set complete
- preserve the completed exercise visibly
- do not unexpectedly collapse or scroll the user elsewhere
- allow the existing workout flow/rest timer to proceed normally

Do not introduce new auto-navigation to the next exercise unless that behaviour already exists and can be preserved without causing UI movement.

9. Completion indicator correctness
The visible completion state must match actual logged state.

A row must not display its completed/check state while required input is unfinished.

Exercise-level text such as:
"2/3 sets completed"

must derive from genuinely completed sets, not merely touched or partially populated sets.

The screenshot/test case where the UI displayed 2/3 completed while reps were still blank must no longer be possible.

10. Preserve active-workout persistence
NevFit currently persists active workout state so the workout can resume after navigation/reload. Preserve this.

Draft entry should continue saving safely, including:
- partially entered sets
- completed sets
- current workout snapshot

Do not debounce or delay persistence in a way that creates a realistic risk of losing entered workout data.

However, persistence callbacks must not trigger UI completion, focus changes or duplicate field values.

11. Handle correction/editing
Users must be able to return to a completed set and correct its values.

If a completed set is edited:
- preserve sensible completion semantics
- do not accidentally complete adjacent sets
- do not move focus unexpectedly on every edit
- keep the exercise open

If editing causes a previously valid completed set to become invalid/empty, its completed state should no longer incorrectly claim that it is complete.

Use the simplest behaviour consistent with the existing data model.

12. Rest timer integration
Inspect whether the current premature set completion is also starting the rest timer.

The rest timer should only start from the genuine set-completion event.

Typing:
4
then
40

must not start/reset the timer.

Typing:
1
then
13

must not start/reset the timer until the set has actually been finalised.

Do not otherwise redesign timer behaviour.

IMPLEMENTATION GUIDANCE:

Review the current workout input path for:
- state shared between set rows
- unstable React keys
- `onChange` handlers that call completion logic
- effects that derive completion from non-empty field values
- effects that automatically collapse completed exercises
- persistence callbacks that recreate workout state and unintentionally change UI state
- focus handlers tied to saved-state updates
- completion state inferred from partially entered strings

Prefer a clear separation between concepts such as:

updateSetDraft(...)
finalizeSet(...)
persistActiveWorkout(...)

rather than one handler attempting to edit, save, validate, complete, advance and collapse simultaneously.

Avoid introducing a large state-management abstraction solely for this bug. Work within the existing architecture unless the current implementation makes reliable isolation impossible.

VALIDATION:

Automated coverage should include at minimum:

1. Weight multi-digit entry
Input:
4
then 40

Assert:
- Set 1 contains 40
- Set 2 remains blank
- Set 1 is not completed before reps are finalised

2. Rep multi-digit entry
Input:
1
then 13

Assert:
- reps end as 13
- value is not committed as 1
- no premature focus change occurs

3. Partial set
Input:
40 weight
blank reps

Assert:
- row remains incomplete
- exercise completion count does not increase

4. Completed set
Input:
40 weight
13 reps
finalise reps

Assert:
- only that row completes
- completed-set count increments by one

5. Next-set focus
Complete Set 1.

Assert:
- focus moves to Set 2 Weight
- Set 2 values remain unchanged

6. No cross-row contamination
Type rapidly in Set 1 Weight.

Assert:
- no values appear in Set 2/3

7. Intermediate-set completion
Complete Set 2 of a 3-set exercise.

Assert:
- exercise remains expanded
- Set 3 remains usable and visible

8. Final-set completion
Complete final set.

Assert:
- correct completed count
- exercise does not unexpectedly collapse
- no entered data is lost

9. Active workout persistence
Enter:
Set 1 weight = 40
leave reps blank

Persist/reload/resume.

Assert:
- weight 40 restores
- reps remains blank
- set remains incomplete

10. Edit completed set
Complete a set, then change its reps.

Assert:
- change affects only that set
- no adjacent set changes
- no unwanted collapse/focus jump

11. Timer
Assert the rest timer is triggered only by genuine set finalisation, not each keystroke.

MANUAL MOBILE QA:

Perform this specifically on a real/mobile viewport with the numeric keyboard.

Reproduce this exact workflow:

Exercise:
Shoulder Press, on Machine
3 sets
8–12 reps

- Tap Set 1 Weight
- Enter 40
- Confirm Set 2 remains completely blank
- Confirm no set is marked complete
- Move to Set 1 Reps
- Enter 13 slowly: first 1, then 3
- Confirm the UI allows the complete value 13 before taking any completion action
- Finish the field
- Confirm Set 1 becomes complete
- Confirm Set 2 Weight receives focus
- Enter 40 / 13 for Set 2
- Confirm Set 2 completes only after reps are finished
- Confirm the exercise does not collapse
- Complete Set 3
- Confirm all three values remain visible and correct

Also repeat with rapid typing to check that React state/persistence timing does not reproduce the partial-value leak.

ACCEPTANCE CRITERIA:
- Multi-digit weight and rep values can be entered normally on mobile.
- Ordinary keystrokes never complete a set.
- Editing one set never alters another set.
- A partially populated set is never shown as completed.
- Completion counts accurately reflect genuinely completed sets.
- Completing a set advances focus predictably without altering the next row.
- Completing intermediate or final sets does not automatically collapse the exercise.
- Active-workout autosave/resume still preserves both partial and completed values.
- Rest timer triggering remains tied to actual completed sets rather than typing.
- Existing workout history and completed-workout persistence remain unchanged.
- Existing workout logging behaviour outside this lifecycle remains functional.
- Relevant automated tests pass.
- Build/lint pass.
- Manual mobile QA confirms the reported live-workout defects are resolved.

OUT OF SCOPE:
- Visual redesign of workout cards
- New progression logic
- AI workout suggestions
- Exercise swapping changes
- Program/routine builder changes
- Workout history redesign
- New set types
- General keyboard/navigation redesign outside workout logging