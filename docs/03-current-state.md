# Current State

## Implemented

- Dashboard default landing screen
- Today workout summary with Start/Resume action
- Current Program dashboard summary
- Configurable Current Cycle MVP
- Weekly completion count
- Latest Workout dashboard highlight
- Future placeholder dashboard cards for runs, steps, and progress highlights
- Schedule persistence
- Program editor
- Custom programs and routines
- Routine management: rename, duplicate, archive, add routine
- Exercise search and filtering
- wger-native selectable exercise results
- Add and Swap exercise picker flows
- Workout mode
- Active workout save/load
- Non-destructive blank workout close
- Append-only workout history persistence
- Historical session storage
- Previous performance lookup from completed history
- Rest timer
- Sticky workout footer
- Wake lock during active workouts
- Rep-range feedback and progression indicators
- Workout completion workflow improvements

## Current Known Limitations

- Exercise search depends on the public wger API.
- wger-selected exercise metadata is cached in memory for the current app session; saved routines retain stable wger IDs and can rehydrate metadata with `getExerciseById`.
- Timer completion notification still needs validation across devices.
- Minor mobile viewport movement has been reported on some devices when editing inputs.

## Next Likely Work

- Workout history screen
- Persist selected external exercise metadata more durably if offline reload behavior becomes important
- Custom exercise support
- PR tracking
- Historical progression analysis
- Runs and steps integrations

## Recent User Testing Findings

First live workout session identified:

- Timer can be missed during longer workouts
- Timer visibility decreases as user scrolls through exercises
- Screen sleep interrupts workout flow
- Workout completion actions are too far from end-of-session workflow
- Users want immediate feedback on rep-range performance and progression readiness
