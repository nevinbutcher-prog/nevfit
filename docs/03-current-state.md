# Current State

- Rob whole-program generation is catalogue-grounded: a bounded verified WGER selection is filtered for the confirmed equipment context, validated again by Firebase against a server-owned reviewed ID catalogue, and used directly to materialise a transient executable proposal. Ordinary generated programs no longer enter mandatory exercise-name matching; legacy matching remains available for exceptional and older flows.

## Implemented

- Dashboard default landing screen
- Normal authenticated launches default to Dashboard without restoring builder navigation
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
- Multi-routine programs with stable routine IDs and safe routine selection
- Compact routine builder with collapsed program management and day tabs
- Collapsed exercise cards with single-item expanded editing
- Focused bottom-sheet exercise configuration with draft-only prescription, display-name, swap, and remove controls
- Exercise search and filtering
- Provider-neutral selectable exercise results
- Add and Swap exercise picker flows
- Dedicated Add Exercises modal for repeated exercise additions
- Routine-aware Added state with duplicate prevention scoped to one routine
- Recoverable exercise-provider error state with explicit retry
- wger result dedupe and cleaned English display names
- wger search query normalization and local aliases for common gym-language searches
- Exercise image normalization and display when available
- Exercise metadata display for primary muscle, secondary muscles, equipment, and instructions
- Optional routine-level exercise display name overrides
- Lightweight routine superset pairing
- Focused superset partner selection with compact grouped-row labels
- Versioned, validated routine proposal contract for future coaching integrations
- Pure proposal-to-draft application with stable routine-row targeting and no persistence side effects
- Automated builder regression coverage for normalization, add/swap/remove/reorder, supersets, duplication, persistence fallback, and workout snapshots
- Workout mode
- Supersetted exercises render in grouped workout-mode blocks
- Faster workout logging with independent per-set drafts, right-edge confirmation, automatic weight carry-forward, compact prior-session summaries, and clear set states
- Flat, table-style set rows with quiet inline progression feedback and a compact timer footer
- Active workout save/load
- Non-destructive blank workout close
- Append-only workout history persistence
- Historical session storage
- Previous performance lookup from global completed history by stable exercise ID
- Rest timer with repeated alarm sound, vibration support, and stronger complete state
- Sticky workout footer
- Wake lock during active workouts
- Rep-range feedback and progression indicators
- Workout completion workflow improvements
- Safe in-workout exercise swaps with original-exercise traceability
- Firebase Google sign-in gate
- Firestore user profile document sync at `users/{uid}`
- Firestore-backed custom programs and routines at `users/{uid}/programs/{programId}`
- Safe first-load program migration from `nevfit_programs` to Firestore
- Local program cache fallback with non-blocking cloud sync warnings
- Firestore-backed planning state at `users/{uid}/appState/planning`
- Firestore-backed health state at `users/{uid}/appState/health`
- Local cache fallback for schedule, active program, cycle, runs, steps, and weekly run target
- Firestore-backed active workout state at `users/{uid}/appState/activeWorkout`
- Active-workout Firestore writes strip optional undefined fields and include development-only sync diagnostics
- Firestore-backed completed workout history at `users/{uid}/completedWorkouts/{workoutId}`
- JSON backup export from Settings
- Confirmed JSON backup import that replaces Firestore-backed account data
- Settings/About attribution for exercise data and images
- Deployed Firebase-authenticated `aiGenerate` callable AI transport foundation
- Provider-neutral AI service boundary with OpenRouter as the current server-only provider
- Bounded AI request validation, server-configured model/output/timeout controls, normalized safe errors, and transient usage diagnostics
- No Rob advice flow can read or write application data beyond its supplied in-memory coaching context
- Ask Rob advisory surface with authenticated, server-owned persona/prompt instructions and transient recoverable responses
- Rob advice automatically supplies bounded deterministic advice context but cannot modify routines, programs, workouts, or other application data
- Deterministic pure Rob context builder for advice, routine review, and program review
- Static current coaching profile, stable program/routine/exercise IDs, and bounded newest-first meaningful workout history for future Rob requests
- Authenticated structured Rob routine and program reviews with server-validated JSON results, privacy-safe diagnostics, and no persistence or proposal application
- Program-editor review actions assess the current unsaved draft, then route transient strengths, concerns, suggested changes, and limitations to the Rob coaching panel
- Routine reviews can prepare a transient candidate proposal that Fitbot resolves and validates against the current draft, then presents as a readable change preview
- Rob routine proposals require explicit whole-proposal approval or rejection; rejection is non-mutating and approval applies only to the unsaved editable program draft
- Proposal approval fingerprints the relevant draft, checks freshness and revalidates immediately before the sole `applyRoutineProposal` application boundary; Save Program remains the only persistence commit
- Selected program builders include Create with Rob for one requested routine with optional duration, equipment, and constraints; proposals use existing provider resolution, human approval, and draft-only persistence boundaries
- Deterministic Rob exercise resolution uses provider display/original names, aliases, and verified equipment metadata plus bounded Fitbot terminology aliases; conflicting or missing requested equipment and material variants remain manual choices before validation
- Pending exercise resolution retains the original generation baseline, so edits made before validation invalidate rather than rebase the cached Rob candidate
- Pure, versioned provider-neutral program proposal domain contract for safe `create_program` and atomic multi-routine `modify_program` candidates
- Whole-program proposal validation reuses routine proposal operation semantics, protects unrelated programs and non-domain workout state, and has no AI, provider, persistence, or UI dependency
- Rob Home provides one primary coaching destination with Ask Rob a question, Review my program, and Build me a program actions
- Program review now starts from explicit program selection under Rob while retaining existing review findings, retry handling, and builder shortcuts into the same workflow
- Build me a program has an honest dedicated entry point and does not invoke the existing single-routine generator
- Rob review selection uses the current selected in-memory draft, labels unsaved drafts, preserves retry target identity, and ignores out-of-order program-review responses
- In-flight Rob reviews use an explicit transient lifecycle: changing targets, leaving Rob, or changing a reviewed draft releases loading and discards stale provider responses without creating another request
- Build Me a Program now collects and validates a transient, user-confirmed program-design brief through deterministic coaching-style questions; it neither calls AI nor changes program data
- Confirmed program briefs can request one authenticated, validated whole-program candidate; transient deterministic matching resolves confident provider results and supports manual library-backed choices or replacements before preparing a validated executable proposal. The proposal is not yet previewed, approved, saved, or applied.
- Catalogue-grounded whole-program generation balances conventional movement-pattern coverage with modest selected-muscle emphasis. Its trusted-metadata quality assessment returns advisory structured concerns for weekly coverage, concentration, redundancy, movement-pattern gaps, and clearly underfilled sessions; it does not reject or regenerate a candidate.
- A separate, versioned Rob exercise-planning taxonomy now provides provenance-aware primary/secondary stimulus, movement, role, fatigue, sequencing, setup, conventionality, confidence, overlap, and audit metadata for all catalogue records. It is foundation-only and is not yet used by generation or catalogue authorisation.
- A separate, versioned weekly programming-policy engine now turns confirmed intake requirements into an advisory pre-selection envelope for coverage, priorities, movement needs, session workload, recovery, and exercise interactions. It is foundation-only: it selects no exercises, changes no active generation, and exposes uncertainty rather than inventing missing calendar, recovery, equipment, or taxonomy facts.

## Current Known Limitations

- Rob can resolve or manually replace whole-program exercises transiently, but whole-program preview, approval, and saving are not yet available.
- Confirmed program-design briefs are transient and reset on a full browser reload; no personal preference profile is persisted for this flow yet.
- Rob does not yet generate `modify_program` recommendations.
- Progression analytics are not implemented.

- Exercise search depends on the public wger API.
- The local exercise alias layer is intentionally small and is not a full exercise taxonomy.
- wger equipment metadata can be incomplete, so the equipment filter is hidden for now.
- wger-selected exercise metadata is cached in memory for the current app session; saved routines retain stable wger IDs and can rehydrate metadata with `getExerciseById`.
- Some legitimate exercise descriptions may remain unresolved when the provider lacks a sufficiently clear match; Fitbot blocks rather than guesses.
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
- Perform an authenticated production AI smoke test from a signed-in client before enabling future Rob features

## Recent User Testing Findings

First live workout session identified:

- Timer can be missed during longer workouts; a repeated file-backed alarm has been added and needs field validation
- Timer visibility decreases as user scrolls through exercises; sticky footer and stronger complete state have been added
- Screen sleep interrupts workout flow
- Workout completion actions are too far from end-of-session workflow
- Users want immediate feedback on rep-range performance and progression readiness
