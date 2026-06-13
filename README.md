# NevFit

NevFit is a personal workout logging and program management app built with
Vite, React, and Tailwind CSS.

The current app supports:

- Dashboard-first landing screen
- Weekly workout scheduling
- Program and routine editing
- Workout session logging
- Append-only completed workout history
- Previous performance lookup from completed history
- Rest timer and workout-mode feedback
- wger-native exercise search
- Routine-level exercise name overrides for wger variants
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

NevFit currently stores workout, program, schedule, and history state in
`localStorage`. Firebase Auth and a Firestore user-profile document are wired as
the identity foundation, but workout data has not been migrated.

Key docs:

- [Product notes](docs/01-product.md)
- [Technical notes](docs/02-technical.md)
- [Current state](docs/03-current-state.md)
- [User profile](docs/04-user-profile.md)
