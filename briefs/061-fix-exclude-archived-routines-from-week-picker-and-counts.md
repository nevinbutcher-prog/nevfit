# NevFit — Exclude Archived Routines from Active UI

**Checkpoint:** Focused defect correction discovered during acceptance of tactile rep-range controls. This is a deviation/hardening checkpoint; email/password authentication remains deferred.  
**Suggested implementation commit:** `fix: exclude archived routines from week picker and counts`

## Issue / intended behaviour

The user created a test routine and archived it, but it remains selectable in the weekly schedule picker and the program card says **5 routines** although only **4 active routines** remain.

Code review identified two direct causes in `src/App.jsx`:
- Week picker spreads `activeProgramDefinitions.flatMap(program => program.days)` without filtering each `day.archived`.
- Program selection cards display `program.days.length` regardless of routine archive status.

## Fix

- Exclude archived routine days from the week picker for all active programs.
- Show active (non-archived) routine counts in program cards; use consistent active counts for any closely related visible routine totals in this surface.
- Preserve archived routines in persisted program data and history. Do not delete, unarchive, migrate or remap them.
- Preserve existing handling of schedule slots already referencing archived routines: they should not become selectable or startable. Present a safe Rest/unassigned state using existing behaviour; avoid destructive schedule writes unless demonstrably required.
- Ensure archiving a routine immediately updates the picker and count and remains correct after Save/reload. Respect existing explicit Save Program and established structural archive persistence behaviours.
- Follow existing component patterns. Avoid broad refactoring.

## Validation

Focused verification: a five-routine program with one archived routine displays **4 routines**, archived item absent from picker, four active items still selectable, existing archived schedule association cannot start a workout; reload preserves results; historical workout references intact.

Run only relevant existing tests and add at most one or two focused tests if genuinely useful. Lint/build as needed. **No Computer Use, browser automation requirement, Firebase changes, live AI calls or broad test suites.** User performs visual acceptance.

Follow `AGENTS.md` and `docs/nevdev_workflow.md`. Update directly relevant docs only if useful, archive this brief to the next sequential numbered brief, clear `briefs/nextbrief.md`, commit/push and report Vercel deployment. **Stop after this defect checkpoint**; do not start email/password authentication.
