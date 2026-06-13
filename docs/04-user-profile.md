# User Profile And Identity

## Current Scope

NevFit has Firebase identity wired, but workout data remains local.

Implemented:

- Firebase app initialization
- Firebase Auth export
- Firestore export
- Google sign-in
- Sign-out
- App-level auth state: `currentUser` and `authLoading`
- Firestore profile sync at `users/{uid}`

Not implemented yet:

- Cloud workout storage
- Cloud program or routine storage
- Cloud schedule storage
- User settings editor
- Profile editing UI

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

Current rules intentionally expose only each user's own profile:

```js
match /users/{userId} {
  allow read, write: if request.auth != null
    && request.auth.uid == userId;
}
```

Do not broaden these rules when adding future workout storage. Add explicit
paths for each new data shape.

## Data Boundary

The profile document is currently the only application Firestore write.

These remain in `localStorage`:

- Programs
- Routines
- Schedule
- Active workout
- Completed workout history
- Cycle settings

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
