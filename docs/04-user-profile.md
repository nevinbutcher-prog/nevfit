# User Profile And Identity

## Current Scope

NevFit has Firebase identity wired. Program/routine, planning, health, active
workout, and completed workout history state are cloud-backed with local
caches.

Implemented:

- Firebase app initialization
- Firebase Auth export
- Firestore export
- Google sign-in
- Sign-out
- App-level auth state: `currentUser` and `authLoading`
- Authenticated UI gate
- Firestore profile sync at `users/{uid}`
- Firestore program/routine sync at `users/{uid}/programs/{programId}`
- Firestore planning sync at `users/{uid}/appState/planning`
- Firestore health sync at `users/{uid}/appState/health`
- Firestore active workout sync at `users/{uid}/appState/activeWorkout`
- Firestore completed workout sync at `users/{uid}/completedWorkouts/{workoutId}`

Not implemented yet:

- User settings editor
- Profile editing UI

Signed-out users see only the NevFit sign-in screen. While auth state is
loading, the app shows a loading screen so the main app does not flash before
Firebase resolves the current user.

## Profile Document

On sign-in, NevFit creates or updates:

```text
users/{uid}
```

The profile sync uses `setDoc(..., { merge: true })`.

Expected fields:

```js
{
  uid,
  displayName,
  email,
  photoURL,
  providerId,
  createdAt,
  updatedAt,
}
```

`createdAt` is preserved for existing documents. `updatedAt` refreshes on each
profile sync.

## Firestore Rules

Current rules intentionally expose only each user's own profile, programs, and
app-state documents:

```js
match /users/{userId} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId;
}

match /users/{userId}/programs/{programId} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId;
}

match /users/{userId}/completedWorkouts/{workoutId} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId;
}

match /users/{userId}/appState/{docId} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId;
}
```

Do not broaden these rules when adding future workout storage. Add explicit
paths for each new data shape.

## Data Boundary

Current application Firestore writes are:

- `users/{uid}` for the profile document
- `users/{uid}/programs/{programId}` for program and routine definitions
- `users/{uid}/appState/planning` for schedule, active program selection, and cycle settings
- `users/{uid}/appState/health` for manual steps, manual runs, and weekly run target
- `users/{uid}/appState/activeWorkout` for the resumable active workout session
- `users/{uid}/completedWorkouts/{workoutId}` for append-only completed workout snapshots

Programs and routines also remain cached locally in `nevfit_programs` for the
first migration phase. Firestore is the source of truth when cloud programs
already exist; local programs upload only when the user's cloud program
collection is empty.

Planning and health state also keep localStorage caches. When cloud app-state
documents exist, Firestore is the source of truth and refreshes those caches.
When a document is missing, NevFit initializes it from the current cache/default
state and saves it to Firestore.

Active workout and completed workout history also keep localStorage caches.
Firestore is the source of truth when cloud workout state exists. If cloud
history is empty and local completed workouts exist, NevFit uploads the local
snapshots once during migration.

Future identity work should add user-facing profile and settings editing without
broadening these data paths.

## Primary Training Profile

Primary user:

- Nevin

Age:

- 42

Goals:

- Shoulders
- Arms
- Hypertrophy

Equipment:

- Dumbbells
- Barbell
- Bench
- High pulley

Constraints:

- L3-L5 nerve issues
- No leg press

Training style:

- 4 day rotation
- 60 minute workouts
- Home gym
