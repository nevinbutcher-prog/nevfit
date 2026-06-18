# Current State

## Implemented

- Dashboard default landing screen
- Today workout summary with Start/Resume action
- Current Program dashboard summary
- Configurable Current Cycle MVP
- Weekly completion count
- Latest Workout dashboard highlight
- Collapsible manual runs dashboard card with weekly target progress
- Collapsible manual steps dashboard card with 7-day average
- Progress Highlights placeholder dashboard card
- Schedule persistence
- Program editor
- Custom programs and routines
- Routine management: rename, duplicate, archive, add routine
- Compact routine builder with collapsed program management and day tabs
- Collapsed exercise cards with single-item expanded editing
- Exercise search and filtering
- Provider-neutral selectable exercise results
- Add and Swap exercise picker flows
- Dedicated Add Exercises modal for repeated exercise additions
- wger result dedupe and cleaned English display names
- wger search query normalization and local aliases for common gym-language searches
- Exercise image normalization and display when available
- Exercise metadata display for primary muscle, secondary muscles, equipment, and instructions
- Optional routine-level exercise display name overrides
- Lightweight routine superset pairing
- Workout mode
- Supersetted exercises render in grouped workout-mode blocks
- Active workout save/load
- Non-destructive blank workout close
- Append-only workout history persistence
- Historical session storage
- Previous performance lookup from completed history
- Rest timer with repeated alarm sound, vibration support, and stronger complete state
- Sticky workout footer
- Wake lock during active workouts
- Rep-range feedback and progression indicators
- Workout completion workflow improvements
- Firebase Google sign-in gate
- Firestore user profile document sync at `users/{uid}`
- Firestore-backed custom programs and routines at `users/{uid}/programs/{programId}`
- Safe first-load program migration from `nevfit_programs` to Firestore
- Local program cache fallback with non-blocking cloud sync warnings
- Firestore-backed planning state at `users/{uid}/appState/planning`
- Firestore-backed health state at `users/{uid}/appState/health`
- Local cache fallback for schedule, active program, cycle, runs, steps, and weekly run target
- Firestore-backed active workout state at `users/{uid}/appState/activeWorkout`
- Firestore-backed completed workout history at `users/{uid}/completedWorkouts/{workoutId}`
- JSON backup export from Settings
- Confirmed JSON backup import that replaces Firestore-backed account data
- Settings/About attribution for exercise data and images

## Current Known Limitations

- Exercise search depends on the public wger API.
- The local exercise alias layer is intentionally small and is not a full exercise taxonomy.
- wger equipment metadata can be incomplete, so the equipment filter is hidden for now.
- wger-selected exercise metadata is cached in memory for the current app session; saved routines retain stable wger IDs and can rehydrate metadata with `getExerciseById`.
- Previous performance lookup is derived from cloud-loaded completed workout history state.
- Timer completion alarm still needs real-device validation with workout music and mobile browser audio policies.
- Minor mobile viewport movement has been reported on some devices when editing inputs.

## Next Likely Work

- Workout history screen
- Persist selected external exercise metadata more durably if offline reload behavior becomes important
- Custom exercise support
- PR tracking
- Historical progression analysis
- Automatic runs and steps integrations

## Recent User Testing Findings

First live workout session identified:

- Timer can be missed during longer workouts; a repeated file-backed alarm has been added and needs field validation
- Timer visibility decreases as user scrolls through exercises; sticky footer and stronger complete state have been added
- Screen sleep interrupts workout flow
- Workout completion actions are too far from end-of-session workflow
- Users want immediate feedback on rep-range performance and progression readiness
