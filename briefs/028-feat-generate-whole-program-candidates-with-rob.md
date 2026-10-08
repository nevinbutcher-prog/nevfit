
# Codex Implementation Brief — Generate Complete Multi-Routine Programs with Rob

**Project:** Fitbot  
**Card:** Generate complete multi-routine programs with Rob  
**Phase:** Program Generation  
**Priority:** Critical  
**Dependency:** Build interactive Rob program-design conversation  
**Suggested commit:** `feat: generate whole-program candidates with Rob`

## ELI5 — What are we building?

I've already answered Rob's questions:

- I want to build muscle.
- I can train four days per week.
- I have around 60 minutes per session.
- I want extra emphasis on shoulders and arms.
- I've told Rob what equipment I can use.
- I've explained any exercises or movements I want to avoid.

Now I want Rob to actually design something.

**Rob should propose a complete four-day training program**, with all four routines designed to complement each other.

For example:

**4-Day Hypertrophy Program**

**Day 1 — Upper A**
- Incline Chest Press — 3 × 8–12
- Lat Pulldown — 3 × 8–12
- Shoulder Press — 3 × 8–12
- Lateral Raise — 3 × 12–15
- Triceps Pushdown — 3 × 10–15

**Day 2 — Lower A + Arms**
- Leg Press — 3 × 8–12
- Leg Curl — 3 × 10–15
- Leg Extension — 3 × 10–15
- Biceps Curl — 3 × 10–15

**Day 3 — Upper B**
- A complementary upper-body routine with different exercise emphases.

**Day 4 — Lower B + Shoulders**
- A complementary lower-body and shoulder routine.

These are illustrative only, not a prescribed program or required generated output.

The important point is that Rob understands the **entire program**, not four disconnected exercise lists.

Rob should consider the agreed goals, training frequency, available time, available equipment and constraints when designing the distribution of exercises across days.

### What I should experience after this card

From my confirmed program brief, I can request a complete proposed program.

Rob generates one coherent candidate.

I can see a simple indication that the candidate was generated, including its name and routine count.

**The candidate is not yet saved, approved or added to my programs.**

The next two cards will handle unresolved exercise matching and full-program preview/approval.

---

# 1. Existing architecture — inspect before implementation

Use the latest repository state.

Relevant existing modules include:

- `src/services/rob/robProgramIntake.js`
- `src/components/rob/RobProgramIntake.jsx`
- `src/services/rob/robProposalClient.js`
- `src/services/programProposal.js`
- `src/services/routineProposal.js`
- `src/services/rob/robProposalResolver.js`
- `functions/src/index.js`
- `functions/src/rob/robProposal.js`
- Existing Rob proposal prompt, response-validation and provider modules.

The current intake produces:

`robProgramIntake.confirmedRequirements`

This is the authoritative program-design input.

The existing `robProposal` callable is authenticated and provides server-side AI integration for routine proposals.

The existing `programProposal.js` provides pure domain validation for:

- `create_program`
- `modify_program`

The current program proposal limits are:

- Maximum 6 routines.
- Maximum 12 exercises per routine.
- Maximum 50 exercises per program.

These existing limits must be respected.

## Architectural principle

Do not rebuild working AI infrastructure.

Extend the existing secure, provider-neutral Rob proposal architecture, or introduce a narrowly scoped shared extension if the existing callable's responsibilities require it.

Do not create an unrelated AI integration just for whole-program creation.

Preserve existing `create_routine` and `modify_routine` behaviour.

---

# 2. Critical distinction — three data stages

Keep these boundaries explicit.

### Stage A — AI-generated program candidate

This is Rob's proposed training program.

It may contain:

- Program name.
- Explanation.
- Ordered routines.
- Proposed exercise names or semantic references.
- Sets, repetitions and rest.
- Notes.
- Suggested supersets.

It must not be trusted as executable Fitbot state.

### Stage B — Resolved executable proposal

A later stage maps each proposed exercise to a trusted Fitbot exercise-provider identity.

Fitbot assigns:

- Proposal ID.
- Program ID.
- Routine IDs.
- Routine exercise IDs.
- Normalised executable exercise identities.
- Valid superset identities where applicable.

The resulting payload is validated through the existing `create_program` contract.

### Stage C — Human-approved program draft

A still later stage previews the entire proposal and requires the user's approval before creating an editable draft.

**This card implements Stage A and the minimum deterministic handoff needed for Stage B.**

It does not implement Stage B's exercise-resolution UX or Stage C's approval workflow.

Do not assign placeholder provider IDs merely to make a candidate appear executable.

Do not bypass the existing proposal validator.

---

# 3. Whole-program candidate contract

Define a provider-neutral, bounded, versioned response schema.

Use a focused module or existing Rob proposal schema infrastructure.

Suggested conceptual output:

```json
{
  "version": 1,
  "proposalType": "create_program",
  "program": {
    "name": "Four-Day Hypertrophy",
    "summary": "A balanced four-day program with additional shoulder and arm emphasis.",
    "days": [
      {
        "name": "Upper A",
        "focus": "Chest, back and shoulders",
        "exercises": [
          {
            "exerciseRef": "incline chest press",
            "sets": 3,
            "repRange": "8-12",
            "restSeconds": 120,
            "note": null,
            "proposalGroupKey": null
          }
        ]
      }
    ]
  },
  "explanation": "The upper-body sessions use complementary pressing and pulling patterns."
}
```

This is illustrative; adapt to existing schemas and naming conventions.

## Requirements

The candidate must contain:

- Supported schema version.
- Explicit `create_program` intent.
- Concise program name.
- Ordered routine collection.
- Meaningful routine names.
- Ordered exercise prescriptions.
- Proposed exercise reference for each movement.
- Supported set count.
- Supported repetition range.
- Supported rest duration.
- Optional exercise note.
- Optional routine-local superset grouping.
- Concise program-level explanation.

### Trust boundary

AI output must not provide authoritative Fitbot IDs.

Reject or ignore unsupported identity fields according to the strict schema policy.

Do not allow model-supplied:

- `program.id`
- `routine.id`
- `routineExerciseId`
- Trusted `exerciseId`
- Saved-state metadata.
- Active-program settings.
- Workout-history mutations.
- Persistence instructions.

Separate model-generated prose from executable fields.

---

# 4. Candidate validation

Add a pure candidate validator.

It must verify structure before the candidate is accepted into transient workflow state.

Validate:

- Schema version and proposal type.
- Supported fields only.
- Non-empty program name.
- Required routine collection.
- Exact requested number of training days.
- Routine count within existing limits.
- Exercise count per routine.
- Total exercise count.
- Non-empty routine names.
- Non-empty exercise references.
- Valid sets, rep ranges and rest.
- Bounded notes and explanations.
- Superset membership.
- No orphaned or invalid superset groups.
- No duplicate or malformed proposal-local references.
- No trusted executable IDs originating from the model.

Preserve existing normalisation semantics where possible.

Do not duplicate the entire `programProposal.js` executable validator.

The candidate validator is responsible only for the pre-resolution AI boundary.

The existing program proposal validator remains authoritative once exercise identities are resolved.

## Exact frequency rule

If the user confirmed four training days, the candidate should contain four routines intended for those days.

Do not silently return three routines because the model generated fewer.

Do not manufacture missing routines client-side.

Reject incomplete candidates with an actionable generation failure.

---

# 5. Program coherence

The server-side Rob instructions must ask for a coordinated training program rather than independently generated sessions.

The model should consider:

- Primary training goal.
- Number of sessions.
- Session duration.
- Training priorities.
- Available equipment.
- User-stated exercise preferences.
- User-stated constraints.
- Appropriate distribution of training stress.
- Exercise selection and order.
- Avoiding unnecessary duplication.
- Reasonable session workload.
- Complementary movement patterns across the week.

For hypertrophy-oriented programs, encourage reasonable coverage of major muscle groups and an appropriate emphasis on the user's priorities.

Do not introduce complex progression analytics or pretend to know a user's actual recovery capacity.

Do not assert that a session fits exactly 60 minutes unless the product actually calculates and verifies session duration.

Treat the duration requirement as a design constraint, not an established measurement.

## Constraints

User-stated exercise limitations must be respected.

Do not deliberately prescribe excluded equipment or movements.

If a request is impossible or contradictory, fail clearly rather than silently disregarding the user's constraints.

Avoid medical diagnosis or unsupported rehabilitation prescriptions.

---

# 6. Confirmed intake is authoritative

Use the existing confirmed requirements snapshot.

Before generation:

- Verify the snapshot exists.
- Validate its version and fields.
- Verify it still matches the currently confirmed intake.
- Reject incomplete or stale confirmation.
- Do not infer missing requirements from unrelated application state.
- Do not substitute hardcoded `robTrainingProfile` values.

Use the confirmed snapshot as structured request data.

Do not send the visible conversational transcript as a substitute.

The server must validate the incoming requirements independently; client-side confirmation is not a security boundary.

## Important profile rule

`robTrainingProfile.js` currently contains static preferences.

These must not become implicit personal requirements for a new program.

If genuinely user-specific data is used as additional context, it must not override the confirmed intake.

---

# 7. Context sent to Rob

Create the smallest useful generation context.

Include:

- Confirmed requirements.
- Supported request type.
- Relevant, reliably sourced user preferences where appropriate.
- Strict response schema and generation constraints.

Do not automatically include:

- All saved programs.
- Raw workout history.
- Unrelated profile records.
- Firestore documents.
- Private application settings.
- Credentials.
- Previous Rob conversations.

A new program should be creatable even when the user has no existing program or workout history.

Avoid using the existing review-context builder if doing so unnecessarily requires a target program or includes irrelevant history.

A focused generation context is preferable.

---

# 8. Secure AI integration

Extend the existing server-side Firebase/Rob architecture.

Inspect the current:

`functions/src/rob/robProposal.js`

and related validator/provider modules.

## Required behaviour

- Authenticate the caller.
- Validate the structured intake request.
- Use the configured server-side AI provider and model.
- Preserve provider neutrality.
- Keep API credentials server-side.
- Enforce bounded input and output size.
- Enforce provider timeout behaviour.
- Validate AI JSON before returning it.
- Return a typed, safe response.
- Preserve existing provider error conventions.

Reuse existing AI error utilities and transport mechanisms.

Do not expose internal prompt content or secrets to the browser.

## Existing routine generation

All existing routine proposal requests must continue to use their current contracts.

Avoid changing the meaning of existing routine proposal request types.

Extend generation with a distinct `create_program` operation or equivalent separate typed request within the shared provider-neutral architecture.

---

# 9. Response and prompt safety

The AI response is untrusted data.

Do not execute instructions embedded in generated descriptions or notes.

Do not permit the model to request tool execution, persistence actions or additional privileged context through its response.

Only allow the expected structured candidate schema.

Apply bounded string lengths, bounded arrays and strict type validation.

Avoid returning unnecessary provider metadata to the UI.

User-provided constraints and preferences are input data, not instructions to override authentication, safety checks or backend validation.

---

# 10. Provider prompt design

Create a dedicated whole-program generation instruction or prompt builder.

Prefer separating:

- Shared Rob identity/instructions.
- Program-design rules.
- Confirmed intake context.
- Structured response requirements.

The generation prompt should explicitly require:

**One complete, coordinated program.**

Not:

- One routine.
- A collection of unrelated routine suggestions.
- A generic exercise list.
- A narrative description with no structured prescriptions.

The model should use practical coaching language.

Avoid excessive explanation, motivational filler or unnecessary repeated caveats.

Do not introduce hidden training assumptions unsupported by the input.

---

# 11. Generation workflow state

Introduce focused transient state for program generation.

Suggested conceptual states:

- `idle`
- `loading`
- `success`
- `error`

Optionally include a distinct `stale` state if useful.

Track:

- Confirmed requirements fingerprint.
- Request identity.
- Candidate response.
- Provider-safe error.
- Whether generation is currently pending.

Keep the state independent of existing routine proposal and program review state.

Do not repurpose `robProposalState` if doing so risks collisions with routine-level approval/resolution flows.

## No persistence

The generated candidate remains transient.

Do not write it to:

- Firestore.
- Saved program definitions.
- Program drafts.
- Workout records.
- Scheduling state.
- LocalStorage.

The next card will extend this state for exercise matching and recovery.

---

# 12. Generation action in Rob Home

Extend the existing Build Me a Program intake experience.

After the user confirms the program brief, offer a clear action:

**Generate my program**

Do not expose this action before valid confirmation.

## During generation

Display a useful progress state:

"Rob is putting your program together…"

Prevent duplicate submission.

Avoid displaying fabricated progress percentages.

Allow users to navigate away without damaging other Fitbot state.

## On successful generation

Show a compact candidate-ready state with:

- Proposed program name.
- Number of routines.
- Total number of proposed exercises.
- A concise explanation or status.

Do not build the full-program preview UI in this card.

Clearly indicate that the proposed program has not been added or saved.

If useful, show the candidate routine names as a simple summary, but avoid implementing the later approval workflow.

## Important UX honesty

Until the next card is implemented, do not offer a nonfunctional approval button or pretend exercise resolution has occurred.

An informational success state is acceptable:

"Your proposed program has been generated. Exercise matching and full preview are the next steps."

---

# 13. Candidate retention and regeneration

Preserve a successfully generated candidate within the current application session.

If the user returns to Rob Home and then reopens Build Me a Program, do not automatically regenerate and charge again.

Retain:

- Confirmed requirements.
- Candidate.
- Generation context fingerprint.
- Candidate identity.

If the user edits any intake answer, invalidate the previous confirmed requirements and its generated candidate.

Do not let a candidate created for four training days remain associated with a newly edited five-day intake.

## Explicit regeneration

If regeneration is offered, it must be a deliberate user action.

Make clear that another request may incur AI usage.

Do not trigger regeneration as a side effect of component rerenders, navigation or exercise resolution.

---

# 14. Duplicate requests and race conditions

Implement robust request identity handling consistent with recent Rob review lifecycle work.

At minimum:

- Disable duplicate submissions while one request is active.
- Enforce an imperative in-flight guard, not just React disabled state.
- Associate each request with the confirmed requirements snapshot.
- Ignore responses from superseded requests.
- Ignore responses that no longer match current confirmed requirements.
- Handle late successes and late failures.
- Prevent a stale response from overwriting a newer candidate.
- Release loading when a request is invalidated.
- Do not automatically retry paid requests.

Client-side cancellation or invalidation does not necessarily stop a request already submitted to the AI provider.

Document that distinction.

## Spend protection

Avoid unnecessary duplicate paid calls.

Use bounded retries and request limits.

Where existing backend architecture supports practical request idempotency or deduplication, reuse it.

Do not introduce a heavyweight billing or job-management system in this card.

---

# 15. Error handling and recovery

Handle:

### Missing confirmation

Ask the user to complete and confirm their program brief.

### Invalid requirements

Show actionable validation feedback.

### Provider timeout

Display a clear retryable error.

Do not silently retry.

### Rate limit

Explain that Rob is temporarily unavailable or rate-limited.

### Invalid AI output

Explain that the generated program could not be validated.

Do not display malformed JSON as a valid program.

### Incomplete program

Reject candidates that omit requested routines or mandatory exercise details.

### Impossible requirements

Return a meaningful failure rather than silently ignoring constraints.

### Connection interruption

Preserve confirmed requirements.

Allow explicit retry when safe.

### Stale response

Do not display or retain a candidate from an outdated requirements snapshot.

## No partial results

If four routines were requested and the model generated three valid routines and one invalid routine, do not accept the three valid routines as a completed candidate.

Treat the entire program candidate as one generation result.

---

# 16. Candidate-to-proposal handoff

This card must prepare a stable handoff for the next exercise-resolution card.

The candidate should retain sufficient information to:

- Identify every proposed exercise.
- Preserve its routine association.
- Preserve exercise ordering.
- Preserve sets, reps and rest.
- Preserve routine-local superset group references.
- Preserve program name and explanation.
- Associate it with the confirmed requirements snapshot.
- Distinguish original generation output from user-resolved exercises.

Use deterministic proposal-local references or stable array paths where appropriate.

The next card must not need to make another AI call merely to identify or resolve an exercise.

## Identity materialisation boundary

If introducing Fitbot-owned candidate identity helpers now, keep them deterministic and independent of AI-supplied identity values.

Do not claim that the entire candidate is executable before all exercises resolve.

`validateProgramProposal()` should remain the authoritative validator for the fully materialised `create_program` proposal in the subsequent card.

---

# 17. Preserve current routine features

The implementation must not break:

- Ask Rob a Question.
- Review My Program.
- Routine Review.
- Create Routine with Rob.
- Existing `modify_routine` proposals.
- Existing `create_routine` proposals.
- Existing exercise resolution.
- Existing routine preview/approval.
- Existing Save Program behaviour.
- Manual program builder.
- Active workout logging.

Whole-program generation must be an additional typed capability, not a replacement of existing routine generation.

---

# 18. Tests — candidate contract

Add comprehensive pure unit tests.

Cover:

### Valid three-day program

Candidate contains three ordered routines and valid exercise prescriptions.

### Valid four-day program

Candidate contains four complementary routines.

### Valid five-day program

Candidate contains five routines within limits.

### Six-day upper boundary

Respect the established maximum routine count.

### Mismatched frequency

A four-day intake receiving a three-day candidate fails.

### Oversized candidate

Reject:

- More than six routines.
- More than twelve exercises per routine.
- More than fifty total exercises.

### Invalid prescriptions

Reject invalid:

- Sets.
- Repetition range.
- Rest duration.
- Exercise reference.

### Invalid superset

Reject single-member groups, malformed group references and unsupported grouping structure.

### Identity injection

Reject or strip AI-supplied persistent executable IDs according to the strict boundary policy.

### Malformed output

Reject missing arrays, wrong types, unsupported versions, unexpected executable fields and invalid JSON.

---

# 19. Tests — backend integration

Using existing mock-provider infrastructure, verify:

- Unauthenticated requests are rejected.
- Valid confirmed requirements are accepted.
- Invalid requirements never reach the provider.
- Existing routine proposal requests still work.
- Program generation uses the correct instruction/schema.
- The server validates candidate output.
- Provider errors return existing safe error shapes.
- Timeouts and malformed responses fail safely.
- No provider credentials or private prompts are exposed.
- Usage diagnostics are bounded and avoid private training data.

Do not rely solely on successful mocked JSON.

Test representative invalid model responses.

---

# 20. Tests — workflow and state

Cover:

1. Confirmed program intake enables generation.
2. Unconfirmed intake blocks generation.
3. One click produces one generation request.
4. Rapid repeated clicks do not produce duplicate in-flight calls.
5. Successful candidate is retained in transient session state.
6. Returning to Rob Home does not trigger another request.
7. Reopening Build Me a Program does not regenerate automatically.
8. Editing a confirmed answer invalidates the candidate.
9. A stale response cannot overwrite current state.
10. A stale failure cannot overwrite a newer successful candidate.
11. Invalid generation does not produce partial candidate state.
12. Provider errors retain the confirmed intake for retry.
13. Existing program drafts and definitions remain unchanged.
14. Existing routine proposal workflows continue working.

Use existing testing conventions.

Keep testing focused on actual orchestration logic, not only static constants.

---

# 21. Persistence and security regression tests

Verify generation cannot directly mutate:

- Program definitions.
- Program drafts.
- Active program.
- Weekly schedule.
- Active workout.
- Completed workout history.

Ensure the candidate module does not acquire direct Firebase persistence dependencies.

Confirm that program generation uses the established authenticated server boundary.

Review logs and user-visible errors for accidental disclosure of:

- API keys.
- Complete private prompts.
- Sensitive training constraints.
- Raw provider payloads.

---

# 22. Mobile and accessibility

Use existing Fitbot styling.

Verify:

- Clear Generate action.
- Understandable loading and error states.
- Small-screen layout.
- Long program names.
- Long routine names.
- Text wrapping.
- Disabled state while generating.
- Keyboard accessibility.
- Visible focus.
- Readable candidate summary.

Do not introduce a giant candidate-preview modal.

Do not redesign Rob Home.

If interactive browser testing cannot run due to missing session, report this as an outstanding manual verification item.

---

# 23. Documentation

Update:

- `docs/01-product.md`
- `docs/02-technical.md`
- `docs/03-current-state.md`

Clearly distinguish implemented functionality from upcoming stages.

## Implemented after this card

- Structured intake confirmation.
- Whole-program AI candidate generation.
- Provider-neutral candidate validation.
- Bounded complete-program responses.
- Transient candidate retention.
- Trusted identity boundary.
- Cost-aware generation workflow.

## Not yet implemented

- Whole-program exercise matching and manual recovery.
- Fully executable program proposal materialisation.
- Full-program preview/approval.
- Editable draft creation from generated programs.
- AI-generated `modify_program` recommendations.
- Longitudinal progression analytics.

Do not claim users can save Rob-generated whole programs until the later approval card is complete.

---

# 24. Completion criteria

This card is complete when:

1. Confirmed intake can initiate whole-program generation.
2. Unconfirmed or stale intake cannot generate.
3. Server independently validates confirmed requirements.
4. One request produces one complete, structured program candidate.
5. Routine count matches the confirmed frequency.
6. The entire program is designed as one coordinated plan.
7. Exercise prescriptions are bounded and valid.
8. AI output cannot introduce trusted persistent identities.
9. Existing program proposal limits are respected.
10. Invalid or incomplete candidates are rejected atomically.
11. Generated explanations remain separate from executable data.
12. Candidate state can support subsequent exercise matching.
13. No provider-backed exercise identity is fabricated.
14. No program draft or saved program is created.
15. No automatic program activation or scheduling occurs.
16. No automatic AI retry or hidden regeneration occurs.
17. Duplicate in-flight requests are prevented.
18. Stale successes and failures are discarded.
19. Existing routine-generation flows remain functional.
20. Existing Rob advice/review flows remain functional.
21. Provider errors are recoverable without losing confirmed requirements.
22. Mobile display and accessibility are verified where possible.
23. Automated tests pass.
24. Lint passes.
25. Production build passes.
26. Documentation accurately describes the delivered capability.

---

# 25. Implementation debrief required

On completion, report:

- Files created and modified.
- Candidate response contract.
- Backend generation integration.
- How confirmed requirements reach Rob.
- How AI-supplied identities are prevented from becoming trusted IDs.
- How candidates are validated.
- How candidate state is retained and invalidated.
- Duplicate-request safeguards.
- Error and retry behaviour.
- Tests added.
- Test/lint/build results.
- Whether interactive mobile verification was performed.
- Remaining limitations.

If any acceptance criterion is incomplete, identify it explicitly.

Do not claim success solely because tests and build pass.

---

# Explicitly out of scope

Do not implement:

- Manual exercise matching.
- Ambiguous exercise recovery UI.
- Full-program preview and approval.
- `applyProgramProposal()` invocation.
- Program draft creation.
- Save Program integration.
- `modify_program` AI generation.
- Program scheduling.
- Automatic active-program selection.
- Training progression analytics.
- New user-profile persistence.
- Billing, subscriptions or usage dashboards.
- Broad UI redesign.

These capabilities belong to subsequent cards.

# Product direction

The desired experience is:

**Rob Home → Build Me a Program → Answer Questions → Confirm Brief → Generate Complete Candidate**

Then, in subsequent cards:

**Resolve Exercises → Preview Entire Program → Approve → Editable Draft → Save Program**

Do not compromise this architecture by falling back to separate single-routine generation.

Rob should design one coherent training program, and Fitbot should remain responsible for validating, approving and eventually saving it.