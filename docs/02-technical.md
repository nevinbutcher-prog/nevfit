Stack

- Vite
- React
- Tailwind v4

localStorage Keys

nevfit_schedule
nevfit_active_workout
nevfit_completed_workouts
nevfit_routines

Future Storage

- Firebase Auth
- Firestore

Current Structure

src/
data/
App.jsx
index.css

State model
Data shapes
Persistence keys
Component architecture

Workout History Model

Completed workouts are append-only.

Previous performance is derived from
nevfit_completed_workouts.

Completed workout records are historical snapshots and are not modified when routines are edited later.

Routine Architecture

Routine definitions are user-editable.
Routine definitions persist separately from workout history.
Workout sessions snapshot the routine at workout start.
