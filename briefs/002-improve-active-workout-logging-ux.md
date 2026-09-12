PROJECT: NevFit / Fitbot

TASK:
Improve the active workout logging screen so it is faster and safer to use during a real workout, especially when fatigued.

VISUAL DIRECTION:
Use the attached mockup as the primary UI direction.

The goal is not to reproduce every visual detail exactly, but to adopt its interaction model:

* compact exercise cards
* prominent logging fields
* compressed history
* clear completed-set states
* reduced secondary UI
* safer workout completion placement
* rest timer isolated in the sticky footer

CURRENT PROBLEMS:

* Re-entering the same weight for every set is repetitive.
* Previous-session history consumes too much vertical space.
* Exercise Details is visually too prominent during active logging.
* The sticky Finish button is easy to hit accidentally and competes with timer controls.
* Completed exercises continue to occupy significant screen space.
* Workout mode requires too much attention for a task that should be largely mechanical.

IMPLEMENTATION GOALS:

1. Smart weight carry-forward
   When a user enters a valid weight for a set, automatically prefill the next prescribed set with the same weight if that next set does not already contain a manually entered weight.

Example:
Set 1: 30 kg × 12
Set 2 should become:
30 kg × [empty reps]

After Set 2, Set 3 should likewise inherit the most recent weight.

Rules:

* Never overwrite an existing manually entered value.
* User can edit the carried-forward value normally.
* Persist carried-forward values through the existing active-workout save mechanism.
* Do not automatically copy reps.

2. Optional copy-set convenience
   Provide a small, unobtrusive per-set action where appropriate to copy the previous completed set's weight and reps.

This is secondary to automatic weight carry-forward.
Do not clutter every row with large new buttons.

3. Compact previous-session display
   Replace the large boxed Previous Session block with a compact inline summary.

Example:
`Previous: 30kg × 12 · 30kg × 12 · 30kg × 12`

Requirements:

* Keep the existing previous-performance data source.
* Do not change global exercise-history matching semantics.
* If there is no previous session, omit the row or show a quiet empty-state message.
* Allow wrapping gracefully on narrow screens rather than forcing horizontal overflow.

4. Reduce Exercise Details prominence
   Replace the large full-width Exercise Details / Show control with a small secondary action near the exercise heading, such as:
   `ⓘ Details`

Existing detail content and behaviour should remain available.

5. Clear set completion states
   Make it easy to see which sets are complete.

A set should visually transition into a completed state once its meaningful required logging fields are present under the existing workout semantics.

Suggested treatment:

* checkmark or completed indicator
* subtle positive border/background treatment
* active/current set clearly distinguishable from completed and untouched sets

Avoid excessive colour or animation.

6. Collapse completed exercises
   When all prescribed sets for an exercise are complete:

* collapse it into a compact summary card
* show exercise name
* show `3/3 sets completed` or equivalent
* retain a subtle expand affordance so the user can reopen and edit the exercise

Do not permanently lock completed sets.

If an exercise is reopened and data changes such that it is no longer complete, restore the appropriate active/incomplete state.

7. Improve logging flow
   Reduce unnecessary taps while entering sets.

Where practical:

* numeric inputs should continue using appropriate mobile numeric keyboards
* moving from weight to reps should be straightforward
* after completing reps, the next incomplete set should be visually obvious
* avoid automatically shifting focus in a way that causes accidental entries

Do not introduce complex gesture behaviour.

8. Remove Finish Workout from sticky timer footer
   The sticky footer should be dedicated to the rest timer.

Move workout completion to a safer, less prominent location near the workout header.

Suggested treatment:

* small `End` / `Finish` action
* or overflow/menu action

Selecting it must open the existing completion/confirmation flow rather than instantly finishing the workout.

If useful, the confirmation can include completion context such as:
`18 of 21 sets logged`

Do not make completion harder to discover, but reduce accidental activation risk.

9. Preserve rest timer behaviour
   Do not regress:

* timer persistence
* pause
* reset
* skip
* completion alarm
* vibration
* sticky visibility
* existing active-workout persistence

The footer can be visually simplified, but timer behaviour should remain unchanged unless required for layout.

10. Preserve workout data semantics
    Do not change:

* completed workout history structure
* append-only history behaviour
* previous-performance lookup logic
* superset grouping semantics
* routine snapshots
* blank-workout handling
* active workout persistence model

SCOPE:
Keep this focused on active workout UX.

Avoid:

* rebuilding workout architecture
* changing Firestore schemas
* redesigning routine builder
* introducing AI coaching
* adding new progression logic
* unrelated dashboard changes

ACCEPTANCE CHECKS:

* Enter Set 1 weight and reps.
* Set 2 inherits Set 1 weight but not reps.
* Enter Set 2 reps; Set 3 retains/carries the latest applicable weight.
* Existing manually edited set weights are never overwritten.
* Previous session appears in a compact inline format.
* Exercise Details remains accessible through a reduced secondary control.
* Completed sets are visually obvious.
* Completing all sets collapses the exercise.
* Reopening the collapsed exercise allows editing.
* The next incomplete exercise remains easy to locate.
* Sticky footer contains timer controls only.
* Workout completion remains available through a deliberate header-level action and confirmation.
* Active workout persistence still works after reload/resume.
* Existing previous-performance, history, timer and superset behaviour still works.

VALIDATE:
Run relevant lint/build/tests and report:

* files changed
* implementation decisions
* whether any existing workout-state assumptions had to change
* validation performed
* any mobile-layout edge cases found
