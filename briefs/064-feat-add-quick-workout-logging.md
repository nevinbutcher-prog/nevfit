# NevFit — Quick Workout V1: Empty Session and Exercise Logging

**Checkpoint:** One approved implementation checkpoint
**Suggested implementation commit:** `feat: add quick workout logging`
**Workflow:** `AGENTS.md` and `docs/nevdev_workflow.md`

## User intent
A person who trains informally should be able to open NevFit, start a blank workout, add whichever exercises they perform, log sets using the familiar existing tracker, and finish with their actual performance preserved in the same history as planned workouts. They must not need to create a program, routine or schedule first. This is an additional entry point, not a separate logging engine.

## Expected experience
1. From the authenticated Dashboard, **Quick Workout** is clearly available alongside the existing planned-workout action. It starts an empty active session, not a previously used exercise list or prefilled routine. When a workout is already active, preserve the current resume/session protection behaviour rather than replacing it.
2. In the existing Workout screen, the quick session has an **Add Exercise** action using the established NevFit exercise search/picker and stable exercise IDs. Users can add another exercise at any point, and log sets with the existing right-edge confirmation, weight carry-forward, notes/history and timer behaviour. Provide a practical initial editable set row and a simple way to add further sets within the active session; do not require a routine prescription. Reuse current controls and styles.
3. Existing completed exercise history remains available for reference, but **do not automatically add exercises or prefill weights/reps from prior workouts**. Do not introduce a new diary data store. Preserve live session changes through the established UID-scoped active-workout persistence/resume path.
4. **Finish Workout** writes one normal completed-workout record with the performed exercise identities and sets, preserving the existing non-destructive/meaningful-effort safeguards; the quick workout can be distinguished from a scheduled routine without inventing fake program/routine IDs. Ensure historical readers, dashboard totals, previous-performance lookups, muscle workload, backup/export/import, and Rob context tolerate quick records with absent routine/schedule associations. A blank session must not create a completed workout.
5. Planned workouts, their routine definitions, and existing history must remain unchanged in behaviour. A user may choose Quick Workout without belonging to any custom program.

## Boundaries — deliberately excluded
- No independent routine library, program/routine data-model migration, save-as-routine prompt, or routine-update prompt.
- No exercise move-up/down or broader planned-workout editing in this checkpoint.
- No recent/favourite muscle-group picker, personalised ordering, autofill or AI recommendations yet. Use the existing exercise picker.
- No new Firebase collections, broad refactors, UI redesign, or parallel workout/session persistence system.

## Implementation guidance
Inspect actual Dashboard/Workout flows in `src/App.jsx`, `src/services/routineBuilder.js`, `src/services/workoutSnapshots.js`, relevant workout lifecycle/history/backup/Rob readers, and existing tests before editing. Choose the smallest backward-compatible way to distinguish a quick session (e.g. an explicit session kind), rather than relying on synthetic scheduled IDs. Exercise name and identity snapshots must stay stable. Do not loosen account isolation, cloud-sync safeguards or program draft/save boundaries. If a genuinely material architecture obstacle blocks this slice, stop and report the smallest alternatives rather than expanding scope.

## Focused verification
- Start blank Quick Workout; add two catalogue exercises; log and confirm multiple sets; finish; ensure one history entry and accurate previous-performance retrieval, including after refresh/re-authentication.
- Pause/refresh a quick workout and resume with recorded exercises/sets intact; verify planned workout still starts/resumes and finishes normally.
- Empty Quick Workout exits without completed history; existing meaningful-effort checks stay intact.
- Check relevant consumers of absent program/routine IDs and ensure they do not crash or inadvertently mutate program data.
- Run only directly relevant existing automated tests, a few focused tests for session/snapshot compatibility and guards if justified, and lint/build. No broad suites, paid AI calls, real account automation or automated visual/browser acceptance. User will assess mobile appearance and ergonomics.

## Handoff
Update only directly relevant `docs/` material; archive this brief with the next numeric prefix; clear `briefs/nextbrief.md`; commit/push to main and verify Git-triggered Vercel deployment where applicable. Report files changed, commit, actual tests, deployment state, limitations and precise manual checks. **Stop after this checkpoint** for independent review and user acceptance. Do not begin the separate routine-library or reorder work.
