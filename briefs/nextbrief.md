# NevFit — Checkpoint 065: Quick Workout Usability and Week Navigation

**Status:** Approved for implementation
**Suggested implementation commit:** `feat: polish quick workout and move week access to dashboard`
**Workflow:** Follow `AGENTS.md` and `docs/nevdev_workflow.md`.

## User intent

Checkpoint 064's Quick Workout is functionally accepted, including cross-device previous-performance history. Make it genuinely convenient on a phone: adding exercises should stay within reach, previously performed exercises should be easy to find without imposing a routine, and finishing should return to Dashboard. The user also wants to demote Week from primary navigation and instead access the existing week planner through a clear **Plan Your Week** action in Dashboard's **This Week** area.

## Expected experience

1. **Add Exercise stays accessible.** During Quick Workout, provide an easy-to-reach Add Exercise action while scrolling a long workout, ideally a restrained sticky/floating control above (not behind) the existing rest timer/footer and above iOS safe areas. Avoid overlapping set confirmation, text inputs, keyboard, End/Finish controls, or timer interactions; do not create duplicate visually competing primary actions. Reuse the existing exercise picker and session-only add logic. Keep planned workout logging visually/functionally intact.

2. **Recently used exercises, grouped by muscle.** In Quick Workout's Add Exercise picker, when the query is empty, offer an unobtrusive, collapsible or compact **Recently Used** section grouped by existing trusted primary-muscle metadata (with a sensible Other/Uncategorised fallback). Derive from the signed-in account's existing completed-workout history and canonical catalogue/provider lookup already available; do not add a new persisted favourites list or infer muscle groups from exercise names. Prefer recent unique exercise IDs, reasonable bounded number of items, most recently performed first within groups, and graceful handling of missing metadata or history. Searching still works through the normal catalogue picker. Selecting a recent item adds that exercise to the session with empty editable weight/reps and an initial blank set; prior weights/reps remain **reference only**, never auto-populated. Respect duplicate prevention, identity, and account isolation. A user with no history sees a clean picker without a misleading empty section. Keep the existing Add/Swap program-builder flows unchanged.

3. **Return to Dashboard.** Successfully finishing, closing an empty workout, or discarding an active workout returns to Dashboard, for both Quick Workout and planned sessions. Preserve meaningful-effort safeguards, confirmation of finish/discard, and any pending transition to a specifically requested other workout. Avoid a delayed pending-action callback sending the user back to Week after finishing. Failed history saves must keep the active workout available.

4. **Week accessed from Dashboard.** Remove the **Week** top-level navigation tab; primary tabs become Dashboard, Programs, Rob with sensible mobile widths. In Dashboard's existing **This Week** card, add an obvious but proportionate **Plan Your Week** action that opens the existing Week/planner screen, with its schedule assignment/editing and current behaviours unchanged. Include an obvious **Back to Dashboard** control on the Week screen, so it is not a navigation dead end. Keep internal `planner` viewMode as needed; this is a navigation/placement change, not a new planning model. All existing schedule persistence, active workout protection, and planned Start/Resume actions must work.

## Boundaries

- **Do not** implement new-account onboarding or remove the Starter Program / change weekly-check-in eligibility yet. Those were identified separately and need their own product decision/checkpoint.
- **Do not** implement independent routines, Save as Routine, post-workout Update Routine, in-workout reorder, or a new full diary mode.
- No exercise history autofill, schema changes, new collections, paid AI calls or unrelated design work.
- Retain the existing dark/emerald UI and the current log-set controls.

## Investigation and implementation

Consult current `docs/` source of truth and inspect actual `src/App.jsx` Dashboard, planner, exercise finder, workout footer, completion/discard pending-action flow, history reader, and `src/services/exerciseProvider.js` / current catalogue metadata. Reuse existing state/services; use a small pure selector helper only if it materially simplifies grouping/testing. Avoid separately copying history into persistent state. Check footer stacking, scroll/keyboard behaviour and the screen's header at mobile sizes. Change only what is required for this approved checkpoint.

## Proportionate verification

- Quick workout with several exercises: Add Exercise accessible near bottom of long scroll, modal usable, no timer or set-control obstruction; user performs phone visual acceptance.
- Historical account: Recently Used shown under muscle groups and a recent exercise can be added with **blank** input fields; search and existing history reference still work. New account/no completed history: no stale or cross-account recent items. Test missing muscle metadata fallback and duplicates.
- Finish/blank close/discard return to Dashboard; planned workout too; pending switch-to-another-workout remains correct; failed save does not navigate away.
- Dashboard Plan Your Week opens working planner; Back returns to Dashboard; no Week primary tab; schedule edits persist.
- Run relevant existing tests and a few narrow tests for grouping/navigation logic if useful, plus lint/build. No broad test suites, browser automation/Computer Use acceptance, real-account automated creation, extensive visual tests, or paid AI evaluation. State what was *not* verified.

## Handoff

Update only directly relevant `docs/`; archive this brief with sequential numeric prefix; clear `briefs/nextbrief.md`; commit/push to main, verify Git-triggered Vercel deployment and provide actual change summary, commit, tests and unresolved findings. Stop after this checkpoint for ChatGPT independent review and user's visual/functional acceptance. No automatic next card.
