# NevFit — Compact Weekly Check-In Dashboard State

**Checkpoint:** 1 of the agreed rotation; dashboard UI refinement only.  
**Suggested implementation commit:** `fix: compact weekly check-in dashboard states`

## User intent

The Monday Weekly Check-In is working, but its dashboard card is too prominent after a review is completed. The user wants a small, unobtrusive countdown between check-ins and a clear action when the next Monday check-in becomes available.

## Expected experience

- After the previous completed week's check-in is saved, replace the existing large dashboard card with a **single compact row**: e.g. `Weekly Check-In · 4 days until next check-in`. No repeated date range, completion summary, or large button consuming dashboard space.
- On **Monday**, when a new prior-week check-in becomes available, show a noticeable but compact `Check-in available now` state with a clear action to open it.
- If that Monday check-in has not been completed by Tuesday or later, keep it available and actionable until completed; don't hide it behind a countdown.
- After completion, switch to the compact countdown automatically. Next Monday activates the next week.
- Keep access to the existing saved review through **Rob Home**; do not remove the underlying saved-review functionality.
- Preserve the existing local-week logic and distinguish loading/unavailable saved-status from truly incomplete; don't misleadingly claim the check-in is available when its saved state couldn't be loaded.

## Implementation boundaries

Inspect and reuse the dashboard state already in `src/App.jsx` and `weeklyCheckInPeriod`. Make the smallest presentation/conditional-rendering adjustment. Retain the current Monday previous-completed-week selection, Rob component, saved review storage, step-entry flow and generation logic unchanged.

Do **not** touch Rob prompt, AI callable, health/Firestore data structures, authentication, rep-range editor or other future checkpoints. No new dashboard settings, notifications or redesign.

## Verification and testing

- Verify visually: (a) saved review -> compact countdown, (b) new Monday with no saved review -> available action, (c) later in week still unsaved -> available action, (d) newly saved review -> compact state, (e) saved-state loading/error -> honest status.
- Use existing date/state helper tests if relevant. Add at most a small focused test if necessary; this is a minor UI change. Run relevant existing checks and build/lint as appropriate, **no full regression suite, Firebase deployment or live AI calls** for this presentation-only change.
- Report actual validation, Git commit, frontend deployment status and any outstanding findings.

Follow `AGENTS.md` and `docs/nevdev_workflow.md`. Update only directly relevant docs if needed, archive this brief according to the sequential convention, clear `briefs/nextbrief.md` and **stop after this checkpoint**. Do not automatically start rep-range controls or email/password authentication.
