PROJECT: NevFit / Fitbot

TASK:
Diagnose and fix the active workout cloud-sync failure currently surfaced to the user as:

`Active workout is saved on this device. Cloud sync is unavailable.`

CONTEXT:
Active workouts are intended to persist to Firestore at:

`users/{uid}/appState/activeWorkout`

Local storage should remain a fallback/cache only.

The app already has Firebase Auth and Firestore-backed program, planning, health, active-workout and completed-workout persistence.

EXPECTED BEHAVIOUR:
While an authenticated user is logging a workout:

* active workout changes save locally immediately
* the same active workout state syncs to Firestore
* reload/resume can restore from Firestore
* the generic cloud-sync warning should not appear during normal operation

INVESTIGATION:
Inspect:

* `src/services/activeWorkoutStore.js`
* Firebase initialization/config
* authenticated user/uid flow
* Firestore document path
* deployed/current Firestore rules
* the active-workout save call from `App.jsx`
* error handling around active workout persistence
* data normalization/serialization before Firestore writes

Determine the exact underlying exception currently being converted into the generic sync warning.

Specifically check for:

* `permission-denied`
* missing/invalid `uid`
* wrong Firebase project/config
* malformed Firestore path
* `undefined` values inside active workout snapshots
* unsupported values/types
* writes firing before auth resolution
* stale environment configuration
* failed `setDoc`/`updateDoc`
* race/order issues in queued saves

REQUIREMENTS:

1. Preserve local-first persistence.
2. Restore Firestore sync for active workouts.
3. Do not broaden Firestore security rules beyond the authenticated user’s own data.
4. Keep the intended path:
   `users/{uid}/appState/activeWorkout`
5. Do not change completed-workout history semantics.
6. Do not change workout UI/UX in this task.
7. Do not silently swallow the underlying Firestore error during development.

DIAGNOSTICS:
Improve development logging so a failed active-workout cloud save reports:

* error code
* error message
* attempted document path
* whether an authenticated uid was present

Do not expose sensitive Firebase config or user data in production-facing messages.

DATA SAFETY:
If Firestore rejects partial workout objects because of `undefined` values, normalize/remove unsupported values before persistence rather than weakening validation or changing history semantics.

ACCEPTANCE CHECKS:

* Sign in.
* Start a workout.
* Enter weight/reps.
* Confirm `users/{uid}/appState/activeWorkout` is created/updated in Firestore.
* Reload the app and confirm the active workout resumes correctly.
* Edit another set and confirm Firestore updates again.
* Close/discard a blank workout and confirm active workout state is cleared correctly.
* Complete a workout and confirm active state clears while completed history is preserved.
* No cloud-sync warning appears during normal authenticated use.
* Local fallback still works if Firestore genuinely fails.

VALIDATE:
Run lint/build/tests and report:

* exact root cause
* exact Firebase error encountered
* files changed
* whether Firestore rules/config required changes
* whether active-workout payload normalization changed
* validation performed
