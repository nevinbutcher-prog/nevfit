
PROJECT:
NevFit

CARD:
Title: Add explicit set completion control and simplify progression indicators

Description:
Refine the workout logging interaction after the set-entry lifecycle fix.

The current implementation now correctly avoids automatically marking sets complete while the user is typing, but this has exposed a usability gap: users can enter valid weight and reps for every set while the exercise still shows 0/3 sets completed, with no obvious way to explicitly confirm that a set has actually been performed.

Add a clear manual set-completion control to each workout set row and simplify the row-level progression UI so completion status is immediately understandable during a live workout.

The goal is to distinguish:
- values entered into the form
from
- a set the user has actually completed

SCOPE:
This is a focused workout-mode UX/state change.

Do not:
- reintroduce automatic completion based on typing
- change workout history structure
- redesign the workout card generally
- change progression algorithms
- alter routine definitions
- introduce new set types

REQUIRED BEHAVIOUR:

1. Make set completion explicit
Use the existing status area at the left of each set row as an interactive completion control.

Incomplete state:
○ 1

Completed state:
✓ 1

The whole completion control should have a generous mobile tap target even if the visible icon remains compact.

Tapping an incomplete set should mark only that set complete.

Tapping a completed set again should allow the user to un-complete it.

2. Completion requires valid set data
A set may only be marked complete when its required logged values are valid according to the existing exercise/set rules.

For a standard weighted exercise:
- weight populated
- reps populated

Example:
25 / 12 → can complete
25 / blank → cannot complete
blank / 12 → cannot complete

Do not introduce a global weight > 0 requirement that would break legitimate bodyweight or existing special cases.

If the user taps completion while required data is missing:
- do not mark the set complete
- keep focus/user context stable
- provide lightweight feedback if the existing UI has an appropriate validation pattern

Avoid disruptive alerts.

3. Do not complete from typing
Preserve the recently corrected input lifecycle.

Typing weight or reps must never:
- mark the set complete
- start the timer
- move focus unexpectedly
- collapse the exercise

The manual completion control is the authoritative completion action.

Do not make keyboard Done automatically mark the set complete as part of this card.

4. Completion count must use explicit completion state
Exercise summary text such as:

0/3 sets completed
1/3 sets completed
3/3 sets completed

must derive from explicitly completed sets.

Merely having valid values entered must not increase the completed count.

Example:
Set 1 = 25 × 12, not ticked
Set 2 = 25 × 12, not ticked
Set 3 = 25 × 12, not ticked

Expected:
0/3 sets completed

After tapping Set 1:
1/3 sets completed

5. Timer integration
The rest timer should start/reset from the genuine set-completion action, not from input changes.

Expected:
- type 25 → no timer
- type 12 reps → no timer
- tap completion → set completes and existing rest timer behaviour starts

Un-completing a set should not unexpectedly restart the timer.

Preserve the existing timer implementation otherwise.

6. Persist completion state
Explicit set completion must remain part of the resumable active workout state.

If the user completes Set 1, leaves the workout, and resumes:
- Set 1 should still display completed
- logged values should remain intact
- completion count should remain accurate

Preserve existing Firestore/local active-workout persistence behaviour.

Do not alter completed-workout history schema unless completion state already requires normalization for the existing snapshot flow.

7. Allow correction
Users must be able to:
- un-complete a set
- change weight/reps
- re-complete it

Editing values in a completed set should behave predictably.

Preferred behaviour:
If editing makes the completed set invalid, clear its completed state automatically.

If editing keeps the set valid, retaining completion state is acceptable unless the existing model already behaves differently.

Do not affect neighbouring rows.

8. Remove unclear row-level progression icon
The current tiny icon shown at the far right of some set rows is not sufficiently understandable during workout logging.

Inspect its current purpose.

If it represents progression/readiness that is already communicated by:
- "Top range"
- "Increase Weight Next Time"
- other existing progression feedback

remove the redundant icon from the workout set row.

Do not remove the underlying progression calculation.

Keep the clearer textual feedback.

If the icon has a distinct function that is not duplicated elsewhere, replace it with a clearly understandable treatment rather than leaving an ambiguous symbol.

Default preference for this card:
remove the icon if redundant.

9. Preserve progression messaging
Existing progression messages such as:

Top range

and exercise-level:

Increase Weight Next Time

should continue to function.

These should be informational only.

They must not imply that the set has been completed merely because entered reps reached the target.

Completion and progression readiness are separate concepts.

10. Mobile UX
Optimise the explicit completion interaction for live gym use.

Requirements:
- completion target easy to tap one-handed
- state difference immediately visible
- no layout shift when toggled
- no unexpected scroll
- no exercise collapse
- no keyboard disruption beyond what is necessary

Keep the status control aligned with the set number so the row remains compact.

VISUAL DIRECTION:

Incomplete:
○ 1   [25]   [12]
      Top range

Completed:
✓ 1   [25]   [12]
      Top range

The completed check should use the existing positive/green workout-state styling.

Do not add a large separate "Complete Set" button.

IMPLEMENTATION GUIDANCE:

Review how the active workout currently derives:
- set completion
- exercise completion count
- progression state
- timer start
- persistence

Explicitly separate concepts where necessary:

logged values
set completion
progression feedback

Do not infer completion solely from populated inputs.

A simple set model might conceptually behave like:

{
  weight,
  reps,
  completed
}

Use the existing model/normalization approach rather than introducing a parallel state store if completion is already represented elsewhere.

Ensure older/resumed active workout data without an explicit completion field normalizes safely.

Do not accidentally mark legacy populated sets completed during normalization unless that is already established behaviour and required for backwards compatibility.

VALIDATION:

Automated tests should cover:

1. Valid entered values remain incomplete
Enter:
25 × 12

Assert:
- row remains incomplete
- completed count remains 0

2. Explicit completion
Tap completion control.

Assert:
- row shows completed state
- completed count increments
- only selected row changes

3. Invalid completion
Weight populated, reps blank.

Tap completion.

Assert:
- row remains incomplete
- count unchanged

4. Un-complete
Complete a set, then tap completion again.

Assert:
- row returns to incomplete
- count decrements

5. Independent rows
Complete Set 1.

Assert:
- Sets 2 and 3 remain unchanged

6. Active workout persistence
Complete Set 1 and persist/reload.

Assert:
- completion restores correctly
- count remains correct

7. Timer
Assert:
- typing does not trigger timer
- explicit completion triggers normal timer start
- un-completing does not incorrectly restart it

8. Progression independence
Enter reps that qualify for "Top range".

Assert:
- progression message displays
- set still remains incomplete until explicitly completed

9. Progression icon cleanup
Assert:
- redundant row-level icon is removed
- textual progression feedback remains

10. Edit completed set
Complete a set, edit values.

Assert:
- no adjacent rows change
- completion state follows the chosen validity rule
- no auto-collapse or focus jump occurs

MANUAL MOBILE QA:

Use a 3-set shoulder press exercise.

- Enter 25 × 12 in Set 1
- Confirm it still shows incomplete
- Tap the set status control
- Confirm it becomes ✓
- Confirm exercise summary changes to 1/3
- Confirm rest timer starts normally
- Enter Set 2 values
- Confirm no automatic completion occurs
- Tap Set 2 completion
- Confirm summary becomes 2/3
- Un-complete Set 2
- Confirm summary returns to 1/3
- Re-complete Set 2
- Complete Set 3
- Confirm summary reaches 3/3
- Confirm exercise remains open
- Confirm progression messages remain understandable
- Confirm the ambiguous right-side row icon is no longer present if redundant
- Reload/resume active workout and verify completion state is preserved

ACCEPTANCE CRITERIA:
- Each set has a clear explicit completion control.
- Entering valid values does not itself complete a set.
- Tapping the control marks only that set complete.
- Completed sets can be un-completed.
- Invalid/partial sets cannot be marked complete.
- Exercise completion counts reflect explicit completion state.
- Rest timer triggers from explicit set completion rather than typing.
- Active workout persistence retains completion state.
- Progression feedback remains intact and independent of completion state.
- Ambiguous redundant set-row progression icon is removed or replaced with a clearly understandable equivalent.
- No regression to multi-digit mobile input behaviour.
- No cross-set state contamination.
- Exercise cards do not auto-collapse during logging.
- Relevant tests, lint and build pass.

OUT OF SCOPE:
- General workout-card redesign
- Progression algorithm changes
- New timer features
- New exercise/set types
- Routine builder changes
- Workout history redesign
- AI suggestions/swaps