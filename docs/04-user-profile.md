# User Profile And Identity

## Current Scope

NevFit has Firebase identity wired. Workout history and session data remain
local; program and routine definitions are cloud-backed with a local cache.

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

Not implemented yet:

- Cloud workout storage
- Cloud schedule storage
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

Current rules intentionally expose only each user's own profile and programs:

```js
match /users/{userId} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId;
}

match /users/{userId}/programs/{programId} {
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

Programs and routines also remain cached locally in `nevfit_programs` for the
first migration phase. Firestore is the source of truth when cloud programs
already exist; local programs upload only when the user's cloud program
collection is empty.

These remain in `localStorage`:

- Schedule
- Active program selection
- Active workout
- Completed workout history
- Cycle settings
- Manual steps
- Manual runs
- Weekly run target

Future cloud-sync work should migrate those surfaces deliberately, one slice at
a time.

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
