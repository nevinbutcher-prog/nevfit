# NevFit — Monday Weekly Check-In V1

**Checkpoint:** Implement the first usable Monday Weekly Check-In experience.
**Status:** Approved for implementation.
**Suggested implementation commit:** `feat: introduce Monday weekly check-in flow`

## Goal and intended experience

Give the user a predictable Monday coaching ritual. The dashboard counts down to the next Monday check-in; from Monday onward, the user can complete missing activity records for the **previous fully completed Monday–Sunday week**, say how they felt, and receive a positive but evidence-grounded holistic Rob assessment. That assessment may inform the coming week, but should not reflexively prescribe changes. Preserve consistent training when it is working.

This V1 establishes functionality. Prompt wording and coaching quality will be refined through real use over subsequent weeks, not through extensive synthetic evaluation now.

## Scope

1. **Dashboard state and entry.** Add a compact Weekly Check-In card/countdown, using device-local calendar dates, that becomes actionable every Monday for the *previous* Monday–Sunday week and remains actionable if the user arrives later in the week. After completion, show the completed state with a way to reopen the saved review and the next Monday countdown. Avoid duplicate or confusing parallel flows: adapt the existing Rob Home weekly-review entry to the same check-in flow.
2. **Prepare last week's activity.** Before generation, show the exact review dates and the existing recorded steps for each day; let the user enter/correct missing or inaccurate daily steps using existing health-state storage and validation. Missing stays unknown, not zero; explicit zero is valid. Show a brief summary of logged runs and completed strength sessions and provide a route to correct/add runs through existing logging facilities where practical. Do not invent or require cardio plans. Do not require seven step entries: user may continue with missing information, clearly labelled. Existing completed workouts remain read-only here.
3. **Feeling and context.** Ask an optional simple wellbeing choice plus optional bounded free-text note (e.g. sore knees after several weeks of running); permit skipping both. Use the information as self-reported context, not medical evidence. Do not silently persist sensitive free text as a new long-term coaching profile.
4. **Generate a complete-week review.** Reuse `src/services/rob/robWeeklyContext.js`, current authenticated callable and fresh Firestore reads. Select the previous completed Mon–Sun regardless of whether opened Monday or later; compare it with the week before that. Save any corrected steps successfully to the existing user health document **before** fetching/building review context; on failed cloud sync, show a clear retry/error and do not generate from stale or incorrectly claimed synced activity. Avoid changing the old general `weeklyBounds` semantics unexpectedly if shared; add a narrow date-selection helper if needed.
5. **Rob guidance.** Adjust `functions/src/rob/robWeeklyReview.js` instructions minimally to consider *all* available strength, running and step evidence holistically alongside optional self-reported wellbeing/context. Recognise genuine consistency and completed *known* intentions, be constructive about deviations, never claim seven planned sessions solely from seven days of recorded activity. Offer a forward-looking adjustment **only when justified** (e.g. discomfort or persistent difficulties), preferably framed as options rather than automatically rewriting a training plan. Maintaining the current approach is often a valid next action. No diagnoses or medical assurance; appropriately recommend medical assessment for persistent/worsening pain. Keep uncertainty and missing records explicit. Preserve the existing model/AI boundary.
6. **Revisit without repaying.** Persist the completed review per signed-in account and reviewed week (minimal dedicated user-scoped Firestore document or equivalent established app-state mechanism), including week boundaries, generated response and concise completion metadata; make it available on reload and across devices. Do not automatically call the paid AI route when opening a previously completed review. Any re-generation must be an explicit action with clear user intent, not a consequence of viewing. Keep access scoped to the authenticated owner using existing rules where possible, otherwise deploy the smallest necessary non-destructive rules adjustment. Avoid caching full raw coaching input or free-text wellbeing answers unless necessary and explicitly justified.
7. **Lifecycle.** Handle loading, missing records, retry, stale requests, account switching and failure paths. Do not mark a check-in completed or overwrite a previous successful review on AI or persistence failure. If persistence after generation fails, clearly report that the review is not saved; don't silently regenerate/charge again on retry.

## Exclusions

No cardio scheduling/planning, recovery-day programme editor, push notifications, automatic AI generation, long-term wellbeing tracking, plan modifications, expanded progression analytics, or historical backfilling. Do not implement next rotation's speculative enhancements. Keep existing ordinary workout and health logging usable.

## Acceptance / manual verification

- Before Monday the dashboard displays a sensible countdown; on Monday (and later if missed) the action opens the prior fully completed Monday–Sunday period, never the in-progress week.
- Existing steps prefill; an omitted day remains missing unless entered; a deliberately entered zero counts as recorded. Corrections persist and are reflected in the generated review; cloud write failures don't result in false completed reviews.
- The user can provide or skip a feeling and comment; Rob receives them for that request and considers them without overriding evidence.
- Rob reviews strength, runs and steps together; is encouraging without blind praise and can recommend simply continuing when warranted.
- A successful review persists for the correct week and reopens after reload without another AI call; the new Monday creates a distinct review period.
- Account isolation and historical workouts remain intact. Review status is honest when generation/save fails.

## Implementation and validation discipline

Follow `AGENTS.md` and `docs/nevdev_workflow.md`. Inspect current dashboard/Rob flow, health persistence, weekly context, and Firestore user-scoped data path before editing. Implement the **smallest coherent V1** within this checkpoint and reuse established styles/components.

Keep tests proportionate: a few focused tests for Monday date boundaries (including year rollover), missing vs zero steps and review-persistence/duplicate-call behaviour, plus a small prompt-context check if needed. Run relevant existing checks, lint/build and necessary Firebase tests only for touched integration paths. Do not run extensive AI evaluations, stress tests, or unrelated suites. No live paid AI calls as part of routine automated testing. Report what was not tested.

Update directly relevant docs; archive this brief according to AGENTS.md; leave `briefs/nextbrief.md` empty on implementation completion. Implement/deploy approved production changes under the standing non-destructive authorisations, report any deployment blockers, and hand off for independent review and user verification. **Stop after this one checkpoint.**
