
PROJECT: Fitbot

TASK:
Ensure a normal Fitbot launch opens on the Dashboard rather than restoring the last builder/routine screen.

PROBLEM:
After using the Program/Routine Builder, subsequent app loads consistently reopen the last routine instead of returning to the Dashboard.

Persisted program/routine data and selected routine context are useful, but the top-level navigation/view should not behave as persistent resume state.

EXPECTED BEHAVIOUR:
On a normal authenticated app launch:

`Dashboard`

should be the default top-level view.

Persisted builder context may still remember:

* selected program
* selected routine
* routine data
* draft/persisted program state as currently intended

but that context should only matter after the user explicitly navigates back into Programs/Routines.

ACTIVE WORKOUT:
Preserve existing active-workout semantics.

Do not break active workout restore/resume behavior.

If the app currently intentionally redirects/resumes when a genuine active workout exists, preserve that behaviour.

In short:

* normal launch with no active workout → Dashboard
* previous screen was Program/Routine Builder → Dashboard
* selected program/routine data → retained
* genuine resumable active workout → preserve current resume behaviour

INVESTIGATION:
Inspect the current top-level navigation state and hydration flow, including:

* initial/current view state
* any persisted view/tab/navigation key
* auth/data loading completion
* program/routine selection state
* active workout restore logic
* localStorage state related to navigation

Identify why the last routine/editor view is restored on cold/reload launch.

IMPLEMENTATION:
Separate:

1. persisted domain state
2. transient navigation state

Top-level page/view selection should default to Dashboard rather than being restored from previous navigation.

Do not clear selected program/routine IDs merely to achieve this.

Avoid introducing new persistence or routing architecture.

PRESERVE:

* Firebase/auth loading behaviour
* program/routine persistence
* selected program/routine data
* active workout persistence
* completed workout history
* Dashboard state
* current Save Program semantics

ACCEPTANCE CHECKS:

1. Open Fitbot and navigate to a routine in Program Builder.
2. Reload/close and reopen the app with no active workout.
3. Dashboard opens.
4. Navigate back to Program Builder.
5. Existing program/routine data remains intact.
6. Previously selected routine may remain selected within the builder if that is current intended behaviour.
7. Navigate elsewhere, reload again.
8. Dashboard still opens.
9. Create a genuine active workout and verify existing resume behaviour is not regressed.
10. Sign out/sign back in and verify authenticated normal landing remains Dashboard.

SCOPE:
Keep this a small navigation-state fix.

Do not:

* redesign Dashboard
* redesign builder navigation
* change Firestore schema
* alter program persistence
* change active workout semantics unless required to preserve existing resume behaviour

VALIDATE:
Run relevant tests, lint and build.

Report:

* root cause
* files changed
* whether any persisted navigation state was removed/ignored
* active-workout behaviour verified
* test/lint/build results
