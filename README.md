# NevFit

NevFit is a personal workout logging and program management app built with
Vite, React, and Tailwind CSS.

The current app supports:

- Dashboard-first landing screen
- Weekly workout scheduling
- Program and routine editing
- Workout session logging
- Append-only completed workout history
- Previous performance lookup from global completed history by stable exercise ID
- Rest timer and workout-mode feedback
- wger-native exercise search with common gym-language aliases
- Optional routine-level exercise display names for wger variants
- Lightweight routine superset pairing with grouped workout display
- Firebase Google sign-in and user profile document sync

## Development

Install dependencies, then run:

```bash
npm run dev
```

Validate changes with:

```bash
npm run lint
npm run build
```

## Data

NevFit uses `localStorage` as a local cache and Firebase Auth/Firestore for
authenticated workout, program, schedule, and history data.

Key docs:

- [Product notes](docs/01-product.md)
- [Technical notes](docs/02-technical.md)
- [Current state](docs/03-current-state.md)
- [User profile](docs/04-user-profile.md)
