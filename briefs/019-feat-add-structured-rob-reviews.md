## Codex Implementation Brief — Add structured routine and program reviews

### Objective

Add explicit **Review with Rob** flows for a selected routine and the current program.

Unlike general Ask Rob chat, reviews must return a **validated, structured coaching result** designed for scanning:

- Strengths
- Concerns
- Suggested changes
- Limitations / missing context where relevant

Reviews remain **strictly read-only**. Rob may recommend changes in plain language, but must not yet generate or apply a `routineProposal`, alter drafts, or persist any program/workout state.

---

# Current architecture to preserve

Fitbot currently has:

```text
src/services/rob/
  robContext.js
  robTrainingProfile.js
  robClient.js

functions/src/rob/
  robAdvice.js
  robPrompt.js
```

The deterministic context builder already supports:

```js
ROB_CONTEXT_TYPES.ADVICE
ROB_CONTEXT_TYPES.ROUTINE_REVIEW
ROB_CONTEXT_TYPES.PROGRAM_REVIEW
```

Current context semantics:

- general advice can include the full active program;
- explicit routine advice can scope to a valid routine;
- `target.scope` identifies `program`, `routine`, or `none`;
- advice history is compact;
- routine/program review contexts already have the larger bounded review limits.

Current user-facing `robAdvice` is:

- authenticated;
- server-prompted;
- OpenRouter-backed through the provider abstraction;
- advisory only;
- non-persistent;
- non-mutating.

There is also an existing future-safe proposal boundary:

```js
validateRoutineProposal(...)
applyRoutineProposal(...)
```

in:

```text
src/services/routineProposal.js
```

**Do not call or modify that proposal flow in this card.**

---

# 1. Architectural approach

Introduce a dedicated review boundary rather than overloading ordinary Ask Rob prose.

Recommended flow:

```text
Routine / Program UI
        ↓
buildRobContext({
  requestType: ROUTINE_REVIEW | PROGRAM_REVIEW
})
        ↓
robReview callable
        ↓
server validates target/context
        ↓
server-owned review instructions
        ↓
provider
        ↓
JSON text
        ↓
server parses + validates review schema
        ↓
validated review object
        ↓
structured Fitbot UI
```

Keep review generation distinct from:

```text
robAdvice
```

because reviews have a stricter output contract.

Recommended server files:

```text
functions/src/rob/
  robReview.js
  robReviewPrompt.js
  robReviewSchema.js
```

and client adapter:

```text
src/services/rob/robReviewClient.js
```

Equivalent organization is acceptable.

---

# 2. Add authenticated `robReview` callable

Add a Firebase Gen 2 callable:

```text
robReview
```

in `us-central1`.

It must:

- require Firebase Authentication;
- bind the existing `OPENROUTER_API_KEY`;
- use the existing server-side provider abstraction;
- use the existing configured model/token/timeout safeguards;
- perform exactly one upstream generation attempt;
- perform no Firestore/localStorage/domain writes.

Do not expose provider/model selection to the browser.

---

# 3. Review request contract

Use a narrow contract such as:

```js
{
  context
}
```

The context itself determines review type:

```js
context.requestType === "routine_review"
```

or:

```js
context.requestType === "program_review"
```

No free-form question is required.

Do not accept:

```text
provider
model
systemPrompt
tools
proposal
changes
API key
```

from the client.

If a small optional user focus is later desirable, defer it unless trivial and clearly within scope. The MVP review should work without one.

---

# 4. Validate review request

Server-side validation must require:

```text
context.version === 1
```

and one of:

```text
routine_review
program_review
```

Reject:

```text
advice
unknown types
missing context
malformed context
oversized context
```

For routine review require:

```text
target.scope === "routine"
target.programId
target.routineId
```

and exactly one target routine in the supplied serialized program.

For program review require:

```text
target.scope === "program"
target.programId
target.routineId === null
```

and one or more active routines unless the program genuinely contains none.

Keep hard serialized-context and prompt-size caps.

Reuse the privacy-safe validation diagnostic pattern already used for `robAdvice`.

Do not log context contents.

---

# 5. Define structured review schema

Introduce an explicit versioned schema.

Recommended result:

```js
{
  version: 1,

  reviewType: "routine" | "program",

  target: {
    programId: "...",
    routineId: "..." | null
  },

  summary: "Short overall assessment.",

  strengths: [
    {
      title: "Good upper-body push/pull balance",
      explanation: "Short plain-language explanation.",
      routineIds: ["..."],
      routineExerciseIds: ["..."]
    }
  ],

  concerns: [
    {
      title: "Shoulder work is clustered",
      explanation: "Short explanation grounded in the supplied prescription.",
      routineIds: ["..."],
      routineExerciseIds: ["..."]
    }
  ],

  suggestedChanges: [
    {
      title: "Move lateral raises later in the session",
      explanation: "Why this could improve session efficiency.",
      priority: "low" | "medium" | "high",
      routineIds: ["..."],
      routineExerciseIds: ["..."]
    }
  ],

  limitations: [
    "Fitbot has no recovery data for this review."
  ]
}
```

This is a **review**, not an executable change plan.

---

# 6. Bound all review output

Set hard limits.

Suggested:

```text
summary: <= 600 chars

strengths: max 4
concerns: max 4
suggestedChanges: max 5
limitations: max 4

item title: <= 120 chars
item explanation: <= 500 chars
limitation: <= 300 chars
```

Reference arrays must also be bounded.

For example:

```text
routineIds: max 6
routineExerciseIds: max 12
```

Do not allow arbitrary nested provider output through to the client.

---

# 7. Validate references against supplied context

Any AI-returned:

```text
routineIds
routineExerciseIds
```

must refer to IDs actually present in the review context.

Unknown IDs should not survive validation.

Preferred behaviour:

- remove invalid optional references;
- retain the finding itself if its text remains valid;
- reject the whole result only when the structural payload itself is malformed.

Do not invent replacement IDs.

These references are grounding metadata only.

They must not be interpreted as mutation targets in this card.

---

# 8. Server-owned review instructions

Create dedicated review instructions rather than reusing general advice prompting verbatim.

Rob should assess only information Fitbot actually provides.

Supported review dimensions include:

- exercise selection;
- exercise ordering;
- sets/prescribed volume;
- rep ranges;
- rest periods;
- obvious redundancy;
- broad movement/muscle balance where reasonably inferable;
- supersets;
- likely session efficiency;
- fit with documented goals;
- fit with documented equipment;
- fit with documented constraints.

Rob may refer to bounded workout history when present, but should not imply richer progression analysis than the supplied data supports.

---

# 9. Explicit unsupported inference rules

Tell Rob not to claim knowledge of:

```text
sleep
recovery
readiness
pain
injury status
RPE/RIR unless supplied
exercise technique/form
diet/nutrition
stress
heart rate
exact muscle stimulation
clinical safety
```

unless those facts are explicitly present in context.

Examples:

Bad:

```text
"You're clearly under-recovered."
```

Good:

```text
"Fitbot doesn't include recovery data, so I can't judge whether this volume is currently recoverable."
```

Bad:

```text
"This exercise is aggravating your back."
```

Good:

```text
"Your profile lists an L3-L5 constraint, so this movement is worth treating cautiously; the available context does not tell me whether it causes symptoms."
```

---

# 10. Routine review behaviour

For:

```text
routine_review
```

Rob should primarily assess the selected routine.

Context should contain:

- training profile;
- parent program identity;
- only the selected routine in full;
- relevant bounded workout history.

Do not send all unrelated routines in full.

It is acceptable for the context to include enough parent-program identity to anchor the routine.

Review dimensions should include:

- exercise sequence;
- exercise redundancy;
- sets/rep/rest prescription;
- supersets;
- apparent target balance within the routine;
- likely session efficiency;
- compatibility with stated goals/equipment/constraints.

Do not pretend to assess whole-program weekly balance from a one-routine context.

If that would require other routines, mention the limitation.

---

# 11. Program review behaviour

For:

```text
program_review
```

include all active routines in the selected/current program.

Assess:

- broad distribution across routines;
- repeated movements;
- apparent coverage/balance;
- order within routines;
- prescribed volume;
- session efficiency;
- alignment with documented goals;
- obvious avoidable duplication.

Avoid pretending that the routine list proves actual adherence or recovery.

---

# 12. Review response generation

The provider currently returns text.

For this card, instruct Rob to return **JSON only** matching the review schema.

Do not require OpenRouter-specific structured-output APIs unless there is a compelling architectural reason.

Keep the Rob review layer provider-neutral.

Conceptually:

```text
Return exactly one JSON object.
Do not use Markdown fences.
Do not add prose before or after the JSON.
```

The server must still distrust that output.

---

# 13. Parse provider output safely

Add a dedicated parser.

Preferred behaviour:

1. trim response;
2. attempt direct `JSON.parse`;
3. optionally tolerate a single Markdown JSON code fence if models occasionally emit one;
4. reject anything else.

Do **not** use:

```text
eval
Function()
regex-based object execution
```

Do not render malformed raw provider text to the user.

---

# 14. Validate parsed output

After parsing, validate every field.

At minimum verify:

```text
version
reviewType
target
summary
strengths
concerns
suggestedChanges
limitations
```

Normalize optional arrays to:

```js
[]
```

where appropriate.

Reject:

- unexpected review type;
- wrong target program/routine;
- non-arrays where arrays are required;
- excessive list lengths;
- nested objects outside schema;
- invalid priority;
- huge strings;
- structurally malformed items.

Do not trust the provider to echo the correct target.

The server knows the authoritative target from the supplied review context.

Prefer replacing returned target metadata with validated context target rather than trusting model-generated IDs.

---

# 15. Malformed-output behaviour

Do not render arbitrary AI output.

If JSON parsing or schema validation fails, normalize to something like:

```text
ai_invalid_response
```

with a safe user-facing message:

```text
Rob couldn't produce a usable review. Try again.
```

This error should be retryable.

Do not automatically make a second billable inference call.

Explicit user retry only.

---

# 16. Avoid silent prose fallback

Do **not** fall back to displaying malformed raw text as a review.

The purpose of this card is a reliable structured contract.

A rejected malformed review is preferable to presenting unverifiable provider output.

---

# 17. Client review adapter

Add:

```js
requestRobReview({ context })
```

in a dedicated client module or alongside the existing Rob client if separation stays clean.

It should call:

```text
robReview
```

and return only the validated server response.

Normalize callable errors consistently with existing Rob client behaviour.

No persistence.

No proposal code imports.

---

# 18. Routine review UI entry point

Add an explicit review action in the selected routine builder surface.

Preferred placement:

near the selected routine heading/actions, e.g.:

```text
Day 1 – Upper
[ Review with Rob ]
```

Do not bury routine review inside general Rob chat.

The user should clearly understand which routine is being reviewed.

Build context using the **current routine draft state** if the builder currently has unsaved draft edits.

This is important:

If the user has edited a routine but not yet clicked Save Program, Rob should review what is visibly on screen, not stale persisted data.

However:

- review must not save that draft;
- review must not change the persistence boundary;
- Save Program remains explicit.

Use the existing in-memory selected program/routine draft where appropriate.

---

# 19. Program review UI entry point

Add a program-level action in the program builder/header area.

Example:

```text
PCYC 1
4 routines

[ Review Program ]
```

Review the program state currently visible in the builder.

Again, if current program edits exist in memory, review the draft without saving it.

Do not trigger persistence just to review.

---

# 20. Review presentation

Render the result as a dedicated structured panel/page/sheet.

Recommended mobile layout:

```text
Rob's Review
PCYC 1 · Program

Overall
Short summary...

STRENGTHS
✓ Good exercise variety
  Explanation...

✓ Sensible push/pull distribution
  Explanation...

CONCERNS
! Redundant pressing volume
  Explanation...

SUGGESTED CHANGES
1. Reduce duplicate pressing
   Explanation...
   High priority

LIMITATIONS
• I don't have recovery or pain data.
```

Use Fitbot's existing dark card styling.

Do not display JSON.

---

# 21. Visual hierarchy

Sections should be immediately scannable.

Use restrained semantic treatment:

```text
Strengths        positive/emerald accent
Concerns         amber accent
Suggested changes neutral/primary accent
Limitations      subdued/slate
```

Do not make the screen excessively colourful.

Do not turn suggested changes into editable controls yet.

No Apply buttons.

---

# 22. Findings can reference exercises

When valid `routineExerciseIds` are supplied, optionally show associated exercise names underneath a finding.

Example:

```text
Applies to:
Incline Chest Press · Pec Fly
```

Resolve names from the local review context, not another network call.

This is optional if it significantly complicates UI.

Do not make references clickable mutation actions.

---

# 23. Loading UX

On review request:

- clearly indicate Rob is reviewing;
- disable duplicate review submission;
- preserve current program/routine draft state;
- do not blank the builder.

Example:

```text
Rob is reviewing this routine…
```

No fake progress percentage.

No fake streaming.

---

# 24. Retry/error UX

On failure:

```text
Rob couldn't complete the review.
```

Show:

```text
Retry
```

where retryable.

Retry should rebuild the review context from current in-memory state so the user receives a review of the latest visible draft.

Prevent double-click duplicate inference.

---

# 25. Review freshness

Reviews are transient.

If the user edits the routine/program after a review completes, do not pretend the previous review automatically applies to the new draft.

Recommended minimal behaviour:

- clear the displayed review when relevant program/routine draft data changes; or
- visibly mark the review as stale.

Prefer clearing/resetting the review state for this card unless stale-state messaging is already easy.

Do not persist review results.

---

# 26. No conversation persistence

Do not save reviews to:

```text
Firestore
localStorage
IndexedDB
```

Do not create:

```text
robReviews
reviewHistory
coachReports
```

collections/documents.

This card is live read-only analysis only.

---

# 27. Hard mutation boundary

Review generation and review rendering must never call:

```text
saveProgram
savePrograms
persistProgramDrafts
saveActiveWorkout
saveCompletedWorkout
saveHealthState
savePlanningState
applyRoutineProposal
validateRoutineProposal
```

The only state changed by the review flow should be transient UI state such as:

```text
loading
error
reviewResult
```

---

# 28. Keep proposal functionality completely dormant

Do not:

- ask Rob to emit `routineProposal`;
- generate operation arrays;
- emit `add_exercise`, `remove_exercise`, etc.;
- call proposal validation;
- generate stable proposal IDs;
- show Apply/Accept buttons.

Even if a suggestion says:

```text
"Replace exercise X with Y"
```

it remains plain review advice.

The next card will convert recommendations into validated proposals.

---

# 29. Review schema should remain proposal-neutral

Do not make `suggestedChanges` structurally identical to proposal operations.

Good:

```js
{
  title: "Reduce duplicate chest isolation",
  explanation: "...",
  priority: "medium",
  routineExerciseIds: ["ri-..."]
}
```

Not yet:

```js
{
  operation: "remove_exercise",
  targetRoutineExerciseId: "..."
}
```

That distinction is important.

---

# 30. Context-size considerations

Routine/program reviews intentionally need more information than general Ask Rob.

The existing review limits are currently much larger than advice limits.

Before blindly using the maximum:

- inspect realistic current PCYC-style program context size;
- ensure full program review stays comfortably inside server prompt limits;
- reduce review history detail if needed before truncating program prescriptions.

Priority for review context should be:

1. training profile;
2. complete target routine/program prescription;
3. stable IDs;
4. small relevant history sample.

Program structure is more important than deep history for this card.

---

# 31. If separate review limits are useful

It is acceptable to add explicit limits such as:

```js
ROB_ROUTINE_REVIEW_CONTEXT_LIMITS
ROB_PROGRAM_REVIEW_CONTEXT_LIMITS
```

rather than reusing one oversized generic set.

For example, keep:

```text
all active target routines
all prescribed exercises within sensible cap
2–4 recent relevant workouts
small performed-set samples
```

The exact limits should be based on realistic Fitbot data and tested.

---

# 32. Server logging

Log only privacy-safe metadata:

```text
operation: rob_review
reviewType
model
durationMs
usage
result/error code
context length
authenticatedUidPresent
```

Do not log:

```text
program names
routine names
exercise names
review text
context JSON
Firebase uid value
email
provider key
```

---

# 33. Structured review server tests

Add focused Functions tests.

Cover successful routine review:

```text
authenticated
routine_review context
valid JSON provider response
→ validated structured result
```

Cover successful program review.

Verify provider invoked exactly once.

---

# 34. JSON parsing tests

Cover:

- valid plain JSON;
- valid JSON inside one code fence if intentionally supported;
- prose before JSON;
- prose after JSON;
- malformed JSON;
- array instead of object;
- empty provider output.

Invalid forms must never leak raw text to client UI.

---

# 35. Schema validation tests

Cover:

- excessive strengths;
- excessive concerns;
- excessive suggested changes;
- invalid priority;
- oversized title/explanation;
- malformed finding;
- wrong review type;
- wrong target IDs;
- unknown routine/routineExercise references;
- missing optional limitations;
- empty arrays.

Make normalization deterministic.

---

# 36. Grounding tests

Routine review test should prove only the intended routine is sent.

Program review test should prove all active routines are present.

Archived routines should remain excluded.

Stable:

```text
programId
routineId
routineExerciseId
exerciseId
```

must survive context construction.

---

# 37. UI/state tests

Where practical with the existing test approach, cover:

- routine Review action uses selected routine;
- program Review action uses selected/current program;
- duplicate request blocked;
- loading state;
- successful structured sections render;
- retry path;
- malformed response shows error rather than raw text;
- switching/editing target clears/stales review state appropriately.

Do not introduce a large new component test framework solely for this card.

---

# 38. Read-only regression tests

Add explicit protection that review flow does not mutate:

```text
programs
programDrafts
activeWorkoutSession
completedWorkouts
planning
health
```

Review modules should have no persistence imports.

Inputs to `buildRobContext()` must remain unmodified.

---

# 39. Manual routine-review smoke test

After deployment, while signed in:

1. Open a real routine.
2. Trigger **Review with Rob**.
3. Confirm title/target clearly shows the intended routine.
4. Verify sections render:
   - strengths;
   - concerns;
   - suggested changes.
5. Confirm recommendations correspond to the actual exercises shown.
6. Confirm no routine fields change after the review.

---

# 40. Manual program-review smoke test

Using the current `PCYC 1` program:

1. Trigger **Review Program**.
2. Confirm Rob recognizes the correct program.
3. Confirm all 4 active routines are represented in context.
4. Verify findings can discuss program-wide balance/redundancy.
5. Confirm no program draft changes.
6. Refresh/reopen and verify no review has been persisted.

This is also a useful regression check for the previous full-program context issue.

---

# 41. Missing-data smoke test

Ensure at least one review acknowledges unsupported information appropriately.

For example, if Rob discusses whether volume is recoverable, it should say that recovery data is unavailable rather than asserting:

```text
"You are recovering well."
```

`limitations` is the appropriate place for these qualifications.

---

# 42. Medical-safety behaviour

Retain the existing Rob safety principles.

If a constraint such as an L3-L5 issue is relevant:

- Rob may highlight a movement for caution;
- Rob must not diagnose;
- Rob must not declare clinical safety;
- Rob should not fabricate pain symptoms.

Structured review format does not override these boundaries.

---

# 43. Error codes

Reuse existing AI errors where sensible.

Suggested:

```text
ai_invalid_request
ai_invalid_response
ai_timeout
ai_rate_limited
ai_provider_unavailable
```

Do not create a large parallel error taxonomy unless needed.

Malformed structured provider output should normalize to:

```text
ai_invalid_response
```

and be retryable via explicit user action.

---

# 44. Deployment

This card introduces a new production callable, so:

1. run repository lint/tests/build;
2. run Functions checks/tests;
3. deploy Functions;
4. verify `robReview` is live in `us-central1`;
5. verify existing secret binding;
6. push commit;
7. verify Vercel deployment;
8. perform authenticated production routine and program smoke tests.

Do not recreate or replace `OPENROUTER_API_KEY`.

---

# 45. Documentation

Update:

```text
docs/01-product.md
docs/02-technical.md
docs/03-current-state.md
```

Document:

- structured routine reviews;
- structured program reviews;
- validated response schema;
- strengths/concerns/suggested-changes presentation;
- server parsing and rejection of malformed output;
- read-only/non-persistent behaviour;
- review context targeting semantics;
- no executable AI proposals yet.

Do not describe later approval/application functionality as implemented.

---

# 46. Explicit non-goals

Do not implement:

- executable routine proposals;
- proposal conversion;
- `validateRoutineProposal()` integration;
- `applyRoutineProposal()` integration;
- Accept/Apply buttons;
- automatic exercise changes;
- automatic routine changes;
- program generation;
- routine generation;
- persisted reviews;
- review history;
- comparison of two saved reviews;
- long-term Rob memory;
- multi-pass model critique;
- automatic retry;
- streaming;
- tool calling;
- model selector;
- provider selector;
- new health/recovery tracking;
- performance/PR analytics beyond supplied bounded history.

---

# Completion criteria

This card is complete when:

1. A signed-in user can explicitly review the selected routine with Rob.
2. A signed-in user can explicitly review the current/selected program with Rob.
3. Routine review uses `routine_review` deterministic context for exactly the intended routine.
4. Program review uses `program_review` context containing all active target routines.
5. Reviews return a versioned validated structured object.
6. The rendered result contains clear Strengths, Concerns and Suggested Changes sections.
7. Limitations/missing context can be represented explicitly.
8. Review item counts and text sizes are bounded.
9. Optional stable routine/exercise references are validated against supplied context.
10. Provider output is parsed and schema-validated server-side.
11. Malformed provider output is rejected as a safe `ai_invalid_response`.
12. Raw malformed model output is never rendered.
13. No automatic second inference is made.
14. Retry is explicit.
15. Routine/program draft state is preserved during review.
16. Unsaved visible draft state can be reviewed without being persisted.
17. Reviews never call the routine-proposal application path.
18. Reviews never write programs, active workouts, history, planning or health.
19. Review results are transient and not persisted.
20. Editing/changing the target does not leave a misleading current review attached.
21. Rob avoids unsupported recovery/pain/medical claims.
22. Server logs remain privacy-safe.
23. Tests cover successful routine/program reviews, malformed JSON, schema failures, context targeting and read-only behaviour.
24. Frontend lint/tests/build pass.
25. Functions checks/tests pass.
26. `robReview` is deployed with the existing secret.
27. A real authenticated routine review succeeds in production.
28. A real authenticated `PCYC 1` program review recognizes the correct program/routines.
29. Documentation accurately reflects structured read-only reviews and does not claim proposal functionality.

### Suggested commit message

```text
feat: add structured Rob reviews
```