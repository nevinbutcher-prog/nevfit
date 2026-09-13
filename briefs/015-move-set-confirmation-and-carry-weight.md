
PROJECT:
NevFit

CARD:
Title: Move set confirmation to row end and auto-carry weight to next set

Description:
Refine the workout logging flow so set completion follows the natural left-to-right entry order:

Set number → Weight → Reps → Confirm

The current explicit completion control is positioned at the left of the row, which forces the user to move back across the row after entering reps. Move the completion action to the right side of each set row.

When a set is explicitly confirmed, NevFit should carry that set's weight forward into the next set if the next set's weight is blank, while leaving the next set incomplete and its reps blank.

This should replace the current Copy action, which is visually awkward and becomes unnecessary once weight carry-forward is automatic.

SCOPE:
Focused workout-mode interaction change only.

Do not:
- change progression logic
- change workout history structure
- change routine definitions
- reintroduce auto-completion while typing
- redesign the workout card generally
- alter rest timer behaviour except where tied to explicit set completion

REQUIRED BEHAVIOUR:

1. Move confirmation control to the right side
Each set row should follow this visual/logical order:

Set | Weight | Reps | Confirm

Example:

1   [25]   [12]   ✓

Remove the completion/status control from the left of the set number.

The right-side confirmation control should be:
- compact
- easy to tap on mobile
- visually aligned across all set rows
- clearly disabled/inactive until the set contains valid data
- clearly completed once confirmed

Use the existing green positive-state styling for confirmed sets.

2. Explicit confirmation remains authoritative
Preserve the current rule:

Typing values does not complete a set.

The set only becomes completed when the user taps the right-side confirmation control.

Typing must not:
- complete a set
- advance completion count
- start the timer
- auto-collapse the exercise

3. Carry weight forward after confirmation
When a set is explicitly completed:

Example:

Set 1:
25 kg × 12
User taps Confirm

Expected:
- Set 1 becomes completed
- Set 2 weight becomes 25
- Set 2 reps remains blank
- Set 2 remains incomplete

Only carry forward the weight.

Do not carry forward reps.

4. Do not overwrite existing next-set data
Only prefill the next set's weight if its weight field is currently blank.

Example:

Set 2 already contains:
30 kg

Completing Set 1 at:
25 kg

Expected:
Set 2 remains 30 kg

Never overwrite user-entered or resumed data.

5. Do not mark next set complete
Weight carry-forward is convenience only.

After Set 1 completion:

Set 2:
weight = 25
reps = blank
completed = false

The exercise completion count should reflect only confirmed sets.

6. Prefer efficient focus progression
After confirming a set and carrying weight forward:

Preferred behaviour:
- if the next set's weight was auto-populated, focus next set's Reps field
- if the next set already had its own weight value, also focus Reps if appropriate
- if there is no next set, leave focus stable

Do not cause unexpected scrolling or collapse.

If focusing Reps proves fragile on mobile, preserve stable layout rather than forcing it.

7. Remove Copy action
Remove the current Copy control from workout set rows.

Do not leave an empty fourth-column treatment or reserved space for it.

Automatic carry-forward on confirmation replaces its normal use case.

Any underlying copy-specific handler/state that is no longer used should be removed cleanly.

8. Completion state presentation
Confirmed row:
- right-side confirm control shows completed/check state
- exercise completion count increments

Unconfirmed row:
- confirm control remains inactive/neutral
- entered values alone do not count as completion

Allow completed sets to be un-completed using the same control unless current behaviour intentionally separates those actions.

9. Un-complete behaviour
If the user un-completes a set:
- decrement the completion count
- do not erase the weight previously carried into the next set
- do not modify neighbouring set data
- do not restart the rest timer

This avoids destructive side effects.

10. Invalid set handling
If a user taps Confirm before the set is valid:
- do not complete it
- do not carry forward weight
- do not start timer
- preserve focus/context

Use lightweight inline/disabled-state feedback rather than modal alerts.

11. Rest timer
Preserve the explicit-completion timer behaviour.

Expected:
type weight → no timer
type reps → no timer
tap Confirm → set completes and timer starts

Carrying weight into the next set must not trigger or reset the timer.

12. Active workout persistence
Persist:
- logged weight/reps
- explicit completion state
- auto-carried next-set weight

Resume/reload should restore the exact workout state.

Example after Set 1 completion:
Set 1 = 25 × 12, completed
Set 2 = 25 × blank, incomplete

That state should survive refresh/resume.

13. Final-set behaviour
When confirming the last set:
- mark it completed
- do not attempt to carry weight anywhere
- preserve exercise visibility
- preserve normal timer behaviour
- do not auto-collapse

VISUAL DIRECTION:

Preferred row structure:

SET   WEIGHT   REPS   [CONFIRM]

1     [25]     [12]      ✓
      Top range

2     [25]     [  ]      ○/inactive

3     [  ]     [  ]      ○/inactive

Avoid adding a textual "Complete" button if a compact icon control is sufficient.

Do not retain the existing Copy label.

IMPLEMENTATION GUIDANCE:

Inspect the existing workout row implementation and update layout/state without creating parallel completion logic.

The completion action should conceptually follow:

confirmSet(setIndex):
1. validate current set
2. mark current set complete
3. persist active workout
4. if next set exists and next weight is blank:
   - copy current weight into next set
5. persist updated next-set draft
6. start existing rest timer
7. optionally focus next reps input

Order operations carefully so Firestore/local persistence does not re-render stale state and overwrite the carried value.

Keep these concepts separate:
- input draft state
- explicit completion state
- carry-forward convenience
- progression feedback

VALIDATION:

Automated coverage should include:

1. Confirmation location
Verify completion action renders at the right side of each row.

2. Standard carry-forward
Set 1:
25 × 12
Confirm Set 1.

Assert:
- Set 1 completed
- Set 2 weight = 25
- Set 2 reps blank
- Set 2 incomplete

3. No overwrite
Set 2 weight already = 30.

Confirm Set 1 at 25.

Assert:
Set 2 remains 30.

4. No rep carry-forward
Confirm:
25 × 12

Assert:
next weight = 25
next reps = blank

5. Completion count
Confirm only Set 1.

Assert:
1/3 sets completed

6. No auto-completion
After carry-forward:
Set 2 weight = 25

Assert:
Set 2 remains incomplete.

7. Timer
Assert:
- typing does not start timer
- confirming starts timer
- carry-forward itself does not trigger timer

8. Un-complete
Confirm Set 1, then un-complete it.

Assert:
- Set 1 incomplete
- Set 2 carried weight remains
- no adjacent data changes

9. Last set
Confirm Set 3.

Assert:
- Set 3 completes
- no attempt to populate nonexistent Set 4
- no error
- no auto-collapse

10. Persistence
Confirm Set 1 and reload/resume.

Assert:
- Set 1 completion persists
- Set 2 carried weight persists
- Set 2 remains incomplete

11. Copy removal
Assert:
- no Copy action is shown
- no unused copy control remains in the row layout

MANUAL MOBILE QA:

Using a 3-set exercise:

- Enter 25 in Set 1 Weight
- Enter 12 in Set 1 Reps
- Confirm from the right side
- Verify Set 1 becomes completed
- Verify Set 2 Weight becomes 25
- Verify Set 2 Reps remains blank
- Verify Set 2 remains incomplete
- Verify focus moves naturally to Set 2 Reps if implemented
- Enter 11 reps
- Confirm Set 2
- Verify Set 3 Weight becomes 25
- Change Set 3 Weight manually to 30
- Confirm Set 2 again/un-complete/re-complete as needed
- Verify Set 3's manual 30 is never overwritten
- Confirm final set
- Verify no auto-collapse or layout jump
- Verify Copy is absent throughout

ACCEPTANCE CRITERIA:
- Set confirmation is positioned at the right end of each set row.
- Completion follows the natural left-to-right logging flow.
- Confirming a valid set marks only that set complete.
- Confirming carries the weight into the next set when that field is blank.
- Reps are never auto-copied.
- Auto-carried weight does not mark the next set complete.
- Existing next-set weight is never overwritten.
- Copy action is removed.
- Completion count remains accurate.
- Rest timer still starts only on explicit confirmation.
- Active workout persistence retains completion and carried values.
- No regression to multi-digit input handling.
- No cross-row state contamination.
- No exercise auto-collapse during logging.
- Tests, lint and build pass.

OUT OF SCOPE:
- General workout-card redesign
- Progression algorithm changes
- New timer features
- New set types
- Routine builder changes
- Workout history redesign
- AI suggestions/swaps