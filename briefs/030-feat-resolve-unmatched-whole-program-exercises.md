# Codex Implementation Brief — Resolve Unmatched Exercises Without Losing Whole-Program Proposals

**Project:** Fitbot (Nevfit)  
**Phase:** Exercise Resolution  
**Priority:** Critical  
**Sequence:** ROB-PROGRAM-04  
**Dependency:** Generate Complete Multi-Routine Programs with Rob — completed

## 1. Objective

Extend Fitbot's existing deterministic exercise-matching system to resolve every exercise in a Rob-generated, multi-routine `create_program` candidate.

A generated program must remain intact when some proposed exercises cannot be matched confidently to the exercise library.

Users must be able to review ambiguous matches, search for replacements and resolve outstanding exercises without another paid program-generation request.

The output of this card is a **fully resolved, validated, executable program proposal**, held in transient state and ready for the subsequent preview-and-approval card.

Do not apply, approve, persist, activate or schedule that proposal in this card.

## 2. ELI5

Rob generates a four-day program containing 25 exercises.

Fitbot recognises 22 confidently. Two have several plausible matches, and one cannot be recognised.

Instead of discarding the program:

1. Fitbot retains the entire generated program.
2. The 22 confident matches are resolved automatically.
3. The user chooses between library-backed alternatives for the two ambiguous exercises.
4. The user searches the existing library and selects a suitable replacement for the unmatched exercise.
5. Fitbot validates all 25 exercise identities and builds one executable program proposal.
6. The proposal is ready for a later explicit approval step.

**The user pays for generation once, not every time an exercise needs attention.**

## 3. Existing Architecture

Inspect the repository before making changes.

Relevant files include:

- `src/services/exerciseResolution.js`
- `src/services/exerciseProvider.js`
- `src/services/rob/robProposalResolver.js`
- `src/services/rob/robProposalClient.js`
- `src/services/rob/robProgramCandidateDetails.js`
- `src/services/programProposal.js`
- `src/services/routineProposal.js`
- `src/services/rob/robProgramIntake.js`
- `src/components/rob/RobProgramIntake.jsx`
- `src/App.jsx`

### Existing deterministic matching

`resolveProposedExercise()` supports:

- Exact or trusted alias matches.
- High-confidence automatic matches.
- Ambiguous candidates requiring explicit selection.
- Unresolved results.

Current provider-backed exercise records use IDs such as `wger-123`.

### Existing single-routine resolver

`resolveRobProposalCandidate()` supports `create_routine` and `modify_routine`.

It already includes provider searching, Fitbot-owned identity creation and candidate validation.

However, its unresolved-exercise path currently fails the proposal rather than providing a comprehensive recoverable search workflow.

**Preserve its existing behaviour unless a small shared refactor is necessary.**

### Existing whole-program candidate

The server returns a Stage-A candidate resembling:

```json
{
  "proposalType": "create_program",
  "program": {
    "name": "Four Day Hypertrophy",
    "summary": "Balanced upper/lower split",
    "days": [
      {
        "name": "Upper A",
        "focus": "Chest and back",
        "exercises": [
          {
            "exerciseRef": "Barbell row",
            "sets": 3,
            "repRange": "8-12",
            "restSeconds": 120,
            "note": null,
            "proposalGroupKey": null
          }
        ]
      }
    ]
  }
}
```

The surrounding generation result also contains coaching explanation and provider metadata.

This candidate has **no trusted Fitbot exercise, routine, program or proposal IDs**.

### Existing executable contract

`validateProgramProposal()` accepts a `create_program` proposal with Fitbot-owned identities and provider-backed exercise IDs.

Its established limits are:

- Maximum 6 routines.
- Maximum 12 exercises per routine.
- Maximum 50 exercises per program.

Reuse this validator as the authoritative executable-program boundary.

Do not create a competing executable proposal format.

## 4. Scope Clarification — User-Initiated Exercise Swaps

In addition to resolving ambiguous or unmatched exercises, allow users to replace **any** proposed exercise before program approval.

Example:

Rob proposes:

**Barbell Bent-Over Row — 3 × 8–12**

Fitbot finds a confident match.

The user nevertheless prefers a seated cable row.

The user selects **Change exercise**, searches the existing library and chooses **Seated Cable Row**.

The proposed program now contains the selected provider-backed cable row while retaining the original prescription.

This is a deterministic, user-controlled substitution.

It does not require AI.

### Required distinction

- **Resolve match:** Identify the exercise Rob intended.
- **Replace exercise:** Deliberately select a different exercise.

Both must be supported.

Do not automatically treat a plausible alternative as equivalent.

The user remains responsible for choosing a suitable replacement; Fitbot should provide enough metadata to make an informed selection.

A future card will support conversational requests such as "Rob, replace all barbell rows." That is not part of this implementation.

## 5. Architecture — Candidate, Resolution, Executable Proposal

Keep three stages clearly separated.

### Stage A — Generated candidate

Already implemented.

Contains the complete AI-generated program, exercise names, prescriptions and explanation.

No trusted exercise IDs.

### Stage B — Exercise resolution

Implemented by this card.

Contains:

- Original immutable candidate.
- Original confirmed requirements.
- Stable candidate fingerprint.
- Matching/freshness baseline.
- Deterministic references to individual exercise positions.
- Automatic resolved matches.
- Ambiguous choices.
- Unresolved exercises.
- User-selected substitutions.
- Resolution statuses and errors.

### Stage C — Executable proposal

Materialised only after every exercise has a trusted library-backed identity.

Contains:

- Fitbot-owned proposal ID.
- Fitbot-owned program ID.
- Fitbot-owned routine IDs.
- Fitbot-owned routine-exercise IDs.
- Trusted exercise IDs.
- Original routine order.
- Original exercise order.
- Original sets, reps, rest, notes and valid group relationships.

Run `validateProgramProposal()` before the proposal is exposed as ready for the subsequent approval stage.

Do not invoke `applyProgramProposal()`.

Do not write to program drafts.

## 6. New Pure Resolution Service

Introduce a focused service, for example:

`src/services/rob/robProgramResolution.js`

It should coordinate whole-program exercise resolution while reusing existing deterministic matching and provider code.

Suggested responsibilities:

- Create a resolution session.
- Enumerate proposed exercises.
- Assign stable candidate-local references.
- Resolve confident matches.
- Record ambiguous/unresolved entries.
- Record explicit user selections.
- Revalidate or clear selections.
- Determine completion status.
- Materialise an executable proposal.
- Validate the proposal.
- Report stale or invalid state.

Keep domain logic pure wherever possible.

Avoid putting the entire matching workflow directly into `App.jsx`.

## 7. Deterministic Exercise References

Every generated exercise needs a reference stable throughout the matching session.

Use original routine and exercise indexes, bound to the immutable candidate fingerprint.

For example:

```text
days.0.exercises.0
days.0.exercises.1
days.1.exercises.0
days.3.exercises.5
```

These are candidate-local lookup keys, not persistent Fitbot IDs.

Requirements:

- References must uniquely identify positions across routines.
- Duplicate exercise names must not collide.
- Routine names must not be used as unique identifiers.
- User selections must always be bound to the original candidate fingerprint.
- Unknown or forged keys must be rejected.
- Selections must not transfer silently to a different candidate.

Keep the original order unchanged.

## 8. Automatic Matching

For every exercise in the generated program:

1. Read the AI-proposed `exerciseRef`.
2. Use the existing `searchExercises()` provider.
3. Run the existing `resolveProposedExercise()` logic.
4. Accept only confident matches under existing rules.
5. Collect ambiguous matches for explicit user selection.
6. Collect unresolved matches for manual search.

Do not automatically choose the highest-scoring result when the resolver reports ambiguity.

Do not invent provider IDs.

Preserve exercise metadata needed to display understandable search results.

### Bounded processing

Whole-program candidates may contain up to 50 exercises.

Avoid launching unbounded concurrent provider searches.

Use bounded concurrency and reasonable caching of identical search queries within the resolution session.

Reuse any existing exercise-provider caching.

The matching UI must stay responsive during longer scans.

Provider failures should not discard the candidate.

## 9. Matching Status Model

Each exercise should have an explicit, understandable state.

Suggested statuses:

- `resolving` — initial provider lookup underway.
- `resolved` — confident automatic match.
- `ambiguous` — explicit choice required.
- `unresolved` — no suitable confident match found.
- `selected` — user has chosen a library-backed match or replacement.
- `error` — provider lookup or verification failed.

At the whole-program level, distinguish:

- Not started.
- Resolving.
- Needs user input.
- Resolution complete.
- Validation failed.
- Stale/restart required.

Do not conflate provider failure with no matching exercise.

Show recoverable errors.

## 10. Ambiguous Matches

For ambiguous exercises, show bounded library-backed choices.

Each choice should display, where available:

- Exercise name.
- Equipment.
- Primary muscle or body part.
- Relevant secondary muscles.
- Exercise image or description if already available.

Example:

**Rob suggested: Cable Row**

Possible matches:

- Seated Cable Row — Cable · Back
- One-Arm Cable Row — Cable · Back
- Standing Cable Row — Cable · Back

The user can:

- Select a suggested match.
- Search for another exercise.
- Leave the item unresolved and continue elsewhere.

Clearly distinguish the suggested movement from the selected provider record.

Do not present unsupported metadata or invented exercise descriptions.

Do not show an excessively long unbounded list of ambiguous candidates.

## 11. Unresolved Exercise Search

If Fitbot cannot confidently match an exercise, retain it in the proposal and show a manual search interface.

Requirements:

- Prepopulate the search with the proposed exercise name.
- Allow editing the search query.
- Search the existing exercise library.
- Display genuine provider-backed results.
- Support selecting one result.
- Support clearing or changing that selection.
- Show an understandable empty state.
- Allow retry after provider failure.

No AI call is required.

Do not search a separate catalogue.

Do not accept arbitrary typed exercise names as trusted identities.

The user must choose a genuine exercise-library result.

## 12. Manual Replacement of Recognised Exercises

Every exercise, including an automatically resolved exercise, must offer a **Change exercise** action.

When selected:

- Show the same provider-backed search interface.
- Display the existing chosen exercise.
- Allow searching for another movement.
- Let the user select an alternative.
- Preserve the original sets, rep range, rest and note by default.
- Clearly distinguish the original Rob suggestion from the user's replacement.
- Keep the exercise in the same routine position.

Example:

```text
Rob suggested:
Barbell Bent-Over Row

Selected replacement:
Seated Cable Row

Prescription:
3 sets | 8-12 reps | 120s rest
```

No need to introduce prescription editing in this card.

Program prescription adjustments belong to the later preview/draft workflows.

## 13. Validate User Selections Against Actual Library Data

This is a critical trust boundary.

A selection such as:

```json
{
  "key": "days.2.exercises.4",
  "exerciseId": "wger-123"
}
```

must not become trusted merely because its ID matches the expected syntax.

Validate that the selected exercise:

- Originated from genuine provider-backed search results.
- Has a valid provider identity.
- Corresponds to an actual record returned by the trusted exercise provider.
- Is associated with the current candidate-local key.
- Is permitted by the supported exercise-provider contract.

Retain the verified exercise object or supporting provider provenance within the resolution session.

Revalidate any client-side selection data at the materialisation boundary against that provenance. If freshness or provenance is uncertain, obtain fresh trusted provider confirmation before proceeding.

Do not rely solely on regex validation of an ID.

Do not allow callers to forge a provider result object.

Do not trust manually constructed exercise IDs or metadata.

Reject unsupported selections safely.

## 14. Preserve Original Generation Context

Create a transient resolution-session envelope containing at least:

- Version.
- Confirmed requirements snapshot.
- Original generation candidate.
- Candidate fingerprint.
- Generation identity/fingerprint.
- Initial matching baseline.
- Current resolution state.
- User selections.
- Current status.
- Error information where applicable.

Do not modify the original generated candidate when the user changes a match.

Selections should be represented as a separate overlay.

This allows users to change their minds without losing the original Rob recommendation.

The original coaching explanation should remain available.

### Fingerprinting

Use stable, deterministic fingerprints based on the exact relevant snapshot.

Do not treat JSON-object reference equality as sufficient freshness validation.

A new candidate must never inherit selections from an older candidate.

## 15. Resume Without Regeneration

Resolution must remain available when the user:

- Leaves Rob Home temporarily.
- Returns to the same generated program.
- Switches between routines in the matching interface.
- Searches for a replacement.
- Changes an earlier selection.
- Experiences a recoverable exercise-provider error.

Keep session state lifted to the appropriate existing application level.

Avoid remount-driven loss of progress.

### Persistence boundary

This card does not require durable Firestore or localStorage storage.

Use the existing transient session-state model.

A full page reload may lose the candidate and matching decisions, provided this limitation is made clear.

Never persist partial matches into program definitions or drafts.

Do not trigger paid program regeneration automatically.

## 16. Stale-State Handling

Staleness must be explicit.

Examples:

- The confirmed program requirements are edited.
- A new Rob generation replaces the current candidate.
- The original candidate fingerprint changes.
- Required exercise-provider provenance can no longer be established.
- A materialisation operation encounters a relevant state conflict.
- A late async search result belongs to an older session or query.

Expected behaviour:

- Invalidate stale matching results.
- Ignore out-of-order responses.
- Do not silently rebase selections onto another program.
- Do not silently carry matches forward to a new candidate.
- Explain when a restart is required.

Important distinction:

A temporary provider outage should allow the user to retry matching the same candidate.

It should not force another paid program-generation request.

If program identities collide with current drafts at materialisation, generate fresh Fitbot-owned identities or report an explicit validation/restart error as appropriate. Do not silently mutate existing programs.

## 17. Materialise Trusted Program Proposal

Only after all required exercise identities are resolved:

1. Confirm the original candidate remains current.
2. Confirm all selected exercises are genuine provider-backed results.
3. Confirm no pending or failed matches remain.
4. Confirm routine and exercise counts remain within limits.
5. Generate trusted Fitbot proposal/program/routine/row identities.
6. Convert Stage-A exercises into the executable `create_program` format.
7. Preserve original exercise order and prescriptions.
8. Preserve routine names and order.
9. Convert proposal-local superset relationships using the existing executable-proposal conventions.
10. Run `validateProgramProposal()` with the current relevant program collection.

Do not supply unsupported fields to executable validation.

Specifically, generated `focus` and coaching explanation should remain presentation metadata where the executable program contract does not support them.

Do not force them into unsupported executable fields.

### Identity generation

Use Fitbot-owned identity generation.

Do not trust IDs supplied by the model.

Do not use original candidate indexes as permanent program or exercise-row IDs.

Avoid regenerating identities on every React render.

Materialisation should be stable within the same completed resolution session.

### Validation failure

If validation fails:

- Return structured errors.
- Do not expose a ready executable proposal.
- Preserve the candidate and applicable matching decisions for inspection.
- Allow a recoverable correction where appropriate.
- Do not create partial program data.

## 18. Superset Handling

Card 03 already established:

- Straight sets are the default.
- Supersets remain optional.
- Valid routine-local supersets are preserved.
- Orphaned superset keys are safely normalised.

This card must preserve that behaviour.

Exercise replacement must not accidentally:

- Change a superset group key.
- Move an exercise into another routine.
- Combine groups between routines.
- Create an orphaned executable superset.

If a replacement remains in the same exercise slot, retain the original valid grouping unless the existing validation rules require otherwise.

Do not implement new superset editing controls in this card.

## 19. User Experience

Extend the current generated-program candidate view rather than creating a separate AI interface.

Suggested flow:

**Generated Program → Match Exercises → Ready for Preview**

Display a whole-program resolution overview.

Example:

```text
Four Day Hypertrophy

24 exercises
20 matched automatically
2 need confirmation
2 need replacement

Upper A       5/6 matched
Lower A       6/6 matched
Upper B       5/6 matched
Lower B       4/6 matched

[Review exercises]
```

The counts above are illustrative only.

### Routine-level presentation

Keep expandable routines.

For each exercise display:

- Rob's original suggested name.
- Current resolved or selected name.
- Sets and rep range.
- Matching status.
- Change exercise action.

For ambiguous exercises, make the outstanding selection prominent.

For unresolved exercises, show Search library.

For automatically resolved exercises, show the match and offer Change exercise.

### Navigation

Allow users to:

- Move between routines.
- Resolve items in any order.
- Return to the program overview.
- Leave and return to Rob without losing in-session progress.
- Cancel resolution without changing program drafts.

Don't force the user to revisit every automatically matched exercise.

### Completion

When every exercise has been resolved and the resulting proposal validates successfully:

Display a clear **All exercises matched** state.

The next card will add full-program preview and approval.

For now, do not show a Save Program or Approve Program button.

Do not create a fake action that implies saving is available.

## 20. Loading, Error and Retry Behaviour

Provider operations should be observable and recoverable.

Handle:

- Empty search results.
- Provider timeout.
- Provider unavailable.
- Malformed provider results.
- Duplicate candidate names.
- Stale search results.
- Repeated rapid searches.
- Invalid user selection.
- Resolution completion failure.
- Candidate replacement during matching.

Avoid hidden automatic paid AI operations.

Provider-backed exercise search is not itself a request to regenerate the Rob program.

Use existing search-loading conventions.

An error matching exercise 24 must not discard the first 23 exercise matches.

## 21. Automated Tests — Pure Resolution

Test:

1. One complete four-day program.
2. All exercises confidently resolved.
3. Multiple ambiguous exercises in different routines.
4. Multiple unresolved exercises in different routines.
5. Same exercise name appearing in different routines.
6. One exercise replaced manually.
7. One automatically matched exercise deliberately replaced.
8. User changes an earlier selection.
9. Original exercise order preserved.
10. Original prescriptions preserved.
11. Original generated candidate remains immutable.
12. Valid routine-local supersets retained.
13. Candidate-local references unique and stable.
14. Unexpected candidate-local key rejected.
15. Fully resolved status computed correctly.
16. Partially resolved candidate cannot materialise.
17. Fully resolved candidate can materialise.
18. Executable proposal passes `validateProgramProposal()`.
19. AI-supplied persistent identities cannot enter the proposal.
20. Invalid selection fails safely without losing valid selections.

## 22. Automated Tests — Provider Integration

Mock the existing provider search boundary.

Verify:

- Exact trusted matches resolve automatically.
- High-confidence matches resolve under existing rules.
- Ambiguous matches remain pending.
- Unresolved matches allow manual search.
- Genuine provider-backed selections are accepted.
- Forged `wger-*` IDs are rejected.
- Fabricated exercise objects are rejected.
- Unsupported provider IDs are rejected.
- Malformed results are excluded.
- Search failures preserve the candidate.
- Retry does not regenerate the program.
- Bounded search/concurrency behaviour.
- Identical search requests can reuse appropriate cached data.

Do not weaken existing matching confidence thresholds merely to improve the completion rate.

## 23. Automated Tests — State and UI

Test the actual workflow wherever practical.

Cover:

1. Generated candidate enters resolution.
2. Progress counts update correctly.
3. Multiple pending matches across routines.
4. Ambiguous candidate selection.
5. Manual replacement search.
6. Replacement of an already resolved exercise.
7. Search empty/error states.
8. Changing a selection.
9. Leaving and returning without losing the session.
10. Candidate change invalidates matching.
11. Late search result cannot overwrite a newer selection.
12. Incomplete matching cannot proceed.
13. Complete matching reaches ready state.
14. Cancelling does not modify program drafts.
15. Repeated clicks cannot create duplicate materialisation.
16. No unexpected AI generation calls.
17. Existing single-routine matching still works.

Prefer behavioural tests over source-string checks alone.

## 24. Persistence and Regression Safety

Verify this card does not mutate:

- Saved programs.
- Program drafts.
- Active program.
- Weekly schedule.
- Active workout.
- Completed workout history.

Do not call:

- `applyProgramProposal()`
- Program save/persist operations.
- Firestore writes for generated programs.
- Automatic program activation.

The executable proposal is an in-memory, validated handoff object for the next card.

Also verify that the existing single-routine Rob workflows continue to function.

## 25. Mobile and Accessibility

The matching flow must work on small screens.

Pay particular attention to:

- Long exercise names.
- Multiple search results.
- Expandable routines.
- Clearly distinguishable suggested and selected exercises.
- Readable provider metadata.
- Search-field focus.
- Scroll position when resolving an exercise.
- Keyboard operation.
- Accessible selection controls.
- Screen-reader status messages.
- No controls obstructed by fixed bottom buttons.

Reuse Fitbot's existing styling.

Do not introduce a broad Rob UI redesign.

If an authenticated mobile browser session is unavailable for interactive testing, report that limitation explicitly.

## 26. Documentation

Update relevant documentation:

- `docs/01-product.md`
- `docs/02-technical.md`
- `docs/03-current-state.md`

Document the three-stage flow:

1. AI candidate generation.
2. Deterministic exercise resolution.
3. Executable program proposal awaiting approval.

Clearly state that saving/approval is not yet supported.

Describe transient session retention, freshness rules, manual matching and provider trust boundaries.

## 27. Explicitly Out of Scope

Do not implement:

- Full-program approval UI.
- Applying executable proposals.
- Creating or saving program drafts.
- Automatic scheduling.
- Selecting an active program.
- Conversational Rob modifications.
- AI-generated exercise substitutions.
- New exercise-provider integrations.
- Longitudinal training analytics.
- Automated workout progression.
- Billing or monetisation.
- Durable matching-session persistence.
- General prescription editing.
- Broad UI redesign.

Do not implement later cards early.

## 28. Completion Criteria

This card is complete when:

1. Every exercise across a generated multi-routine program can be resolved independently.
2. Confident matches resolve automatically.
3. Ambiguous matches offer genuine library-backed choices.
4. Unresolved exercises support manual search and replacement.
5. Any already matched exercise can also be deliberately replaced.
6. All original routines and exercises remain present.
7. Order and prescriptions are preserved.
8. Original generation context is retained.
9. Matching can resume in-session without regeneration.
10. Stale candidates cannot receive mismatched selections.
11. Forged exercise identities are rejected.
12. Provider failures are recoverable.
13. Incomplete candidates cannot become executable proposals.
14. Completed resolution produces trusted Fitbot identities.
15. `validateProgramProposal()` passes for a valid complete candidate.
16. No saved program or draft is modified.
17. Existing single-routine proposal matching remains functional.
18. Tests, lint and production build pass.
19. Documentation is accurate.
20. Remaining mobile/manual verification limitations are reported.

## 29. Implementation Debrief Required

On completion, report:

- Files created and modified.
- New resolution service/API.
- Candidate-local reference strategy.
- Exercise matching and manual-search implementation.
- How user selections are verified.
- How original candidate data is preserved.
- How stale requests and candidates are invalidated.
- How executable IDs are generated.
- How `validateProgramProposal()` is invoked.
- Whether provider results are cached or revalidated.
- What happens when provider search fails.
- How duplicate generation requests are avoided.
- Tests added.
- Test/lint/build results.
- Mobile verification status.
- Remaining known limitations.

Do not claim that generated programs can be saved until the later approval card is implemented.

## Product Direction

The eventual experience should be:

**Build Program → Rob Generates → Match/Swap Exercises → Preview Full Program → Approve → Editable Draft → Save Program**

This card implements only:

**Match/Swap Exercises → Fully Resolved Proposal Ready for Preview**

The key product principle is that **the user should never lose a good generated program merely because Fitbot couldn't recognise one or two exercises**.

And the user should never be forced to accept a movement they dislike simply because Fitbot matched it successfully.