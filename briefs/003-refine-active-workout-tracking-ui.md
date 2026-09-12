PROJECT: NevFit / Fitbot

TASK:
Refine the active workout tracking screen based on the latest implementation and attached mockup.

VISUAL DIRECTION:
Use the attached latest mockup as the primary direction.

This is not a full redesign. The current workout-mode implementation is already broadly correct. Focus on:

* reducing vertical density
* simplifying set-row chrome
* making active/completed state clearer
* making the screen feel like a fast workout logging surface rather than a dashboard

CURRENT STATE:
Recent work has already improved:

* compact previous-session history
* safer workout completion placement
* sticky timer footer without Finish
* details action
* set completion highlighting
* weight carry-forward
* completed exercise collapse

The remaining issue is visual density and interaction efficiency.

GOALS:

1. Remove default feedback prompt block
   The current `Enter reps for feedback` control takes too much vertical space and visually competes with the logging fields.

Change behaviour so:

* do not show a large feedback button before data exists
* progression/rep-range feedback should appear only when relevant data has been entered
* feedback should be presented as a quiet inline message, not a large primary control
* preserve existing feedback logic; this is primarily a presentation change

2. Simplify set-row layout
   Current set rows use a large outer bordered container plus bordered input fields.

Refine to a flatter table-like layout:

* row itself should not require a prominent card border
* keep weight and reps inputs as the primary bordered controls
* separate rows with subtle spacing/dividers if needed
* maintain generous mobile touch targets
* avoid making the layout visually cramped

Suggested structure:

`1   ✓   [ 30 kg ]   [ 12 reps ]   …`

`2   ○   [ 30 kg ]   [ Reps ]      …`

`3   ○   [ 30 kg ]   [ Reps ]      …`

3. Improve set-state hierarchy
   Use three visually distinct but restrained states:

Completed:

* green check
* subtle completed tint on populated inputs

Active/current:

* green accent on the active indicator or active input
* do not outline the entire row

Untouched:

* neutral indicator
* standard input styling

The current set should be obvious without excessive green borders.

4. Keep smart weight carry-forward visible but quiet
   Preserve the existing automatic weight carry-forward behaviour.

If a secondary action such as:
`Use previous weight (30kg)`
or copy previous set exists, keep it visually low priority.

Do not add large copy buttons.

5. Compress completed exercise cards
   Completed exercises should collapse aggressively.

Suggested collapsed content:

* check icon
* exercise name
* `3/3 sets completed`
* optional one-line performance summary or previous-session reference

Keep an expand affordance so users can reopen and edit.

Avoid showing full set rows for completed exercises unless expanded.

6. Reduce exercise card padding
   Tighten vertical spacing inside exercise cards so more of the next exercise remains visible.

Prioritise visibility of:

* exercise name
* target / set count
* previous performance
* logging fields

Secondary UI should consume minimal height.

7. Keep Details secondary
   Retain the smaller `Details` affordance near the exercise heading.

If practical, make it slightly quieter than the current treatment:

* small pill
* info icon
* or subtle text action

Do not return to a full-width Details row.

8. Header cleanup
   Retain:

* Back to Planner
* routine name
* routine metadata
* safe End/Finish action

Avoid large side-by-side workout actions.

`End` / `Finish` should remain deliberate and must continue to use the existing confirmation/completion flow.

9. Rest timer refinement
   Keep the sticky timer footer dedicated to timer controls.

If possible:

* slightly reduce idle-state vertical height
* preserve large enough touch targets
* retain Pause / Reset / Skip / Start behaviour
* preserve all timer persistence, alarm and vibration behaviour

Do not reintroduce Finish into the footer.

10. Preserve existing workout semantics
    Do not alter:

* Firestore schema
* active workout persistence
* completed workout history
* previous-performance matching
* global exerciseId history lookup
* superset behaviour
* blank-workout semantics
* progression logic
* timer logic

SCOPE:
UI refinement only unless a small supporting state change is unavoidable.

Avoid:

* architecture refactor
* unrelated dashboard work
* routine-builder changes
* AI coaching
* new exercise metadata work

ACCEPTANCE CHECKS:

* No large `Enter reps for feedback` block before logging begins.
* Exercise cards are visibly shorter than current implementation.
* Set rows no longer look like nested cards.
* Completed, active and untouched sets are easy to distinguish.
* Weight carry-forward remains functional.
* Previous performance remains compact and visible.
* Completed exercises collapse and can be reopened.
* The next exercise is visible sooner during scrolling.
* Details remains accessible but secondary.
* End/Finish remains safe and deliberate.
* Sticky rest timer behaviour is unchanged.
* Active workout survives reload/resume with all carried-forward and entered values intact.

VALIDATE:
Run relevant lint/build/tests and report:

* files changed
* UI changes made
* any interaction behaviour changed
* validation performed
* any mobile viewport/layout issues found

IMPLEMENTATION NOTE:
Treat the attached mockup as visual direction rather than a pixel-perfect specification. Preserve existing NevFit/Fitbot styling conventions where they already work.
