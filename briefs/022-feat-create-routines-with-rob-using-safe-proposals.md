
# Codex Implementation Brief — Create Routines with Rob

**Project:** Fitbot  
**Phase:** Creation  
**Priority:** Medium  
**Dependency:** Add human review and approval for Rob changes

## 1. Objective

Allow users to request a new workout routine from Rob, specifying a concise training goal and optional constraints.

Rob should generate a proposed routine for the currently selected program, using Fitbot's existing training profile, program context, exercise provider, proposal validation and human approval workflow.

The user must inspect and explicitly approve the proposed routine before it enters the editable program draft.

**Save Program remains the sole persistence commit.**

Do not introduce autonomous program generation, scheduling or program activation.

## 2. Existing architecture

Inspect and reuse the current implementation, particularly:

```text
src/App.jsx

src/services/rob/
  robContext.js
  robProposalClient.js
  robProposalResolver.js
  robProposalApproval.js
  robProposalApprovalOrchestrator.js

src/services/
  routineProposal.js
  exerciseProvider.js

functions/src/rob/
  robProposal.js
```

The existing proposal contract already supports:

```js
proposalType: "create_routine"
```

The resolver already generates Fitbot-owned routine and row IDs, resolves provider-backed exercises and validates the resulting proposal.

The approval implementation already supports create-routine baselines and previews, including the existing draft-only application boundary.

**Extend these established paths. Do not build a separate AI routine generator or approval mechanism.**

## 3. Entry point

Add a **Create with Rob** action in the existing Programs/Routines builder.

Place it near the current routine creation controls, scoped to the selected program.

Suggested presentation:

```text
Program: Strength & Hypertrophy

[+ Add Routine]  [✨ Create with Rob]
```

Selecting Create with Rob opens a focused creation form.

Use existing Fitbot styling and responsive layout patterns.

Do not add a global unrestricted AI generator to the dashboard or main Rob chat.

## 4. Creation form

Capture minimal useful information.

Suggested fields:

**What would you like to train?** — required free-text input.

Example:

> A 45-minute upper-body hypertrophy workout focusing on shoulders and arms.

**Approximate duration** — optional.

Suggested choices:

```text
30 minutes
45 minutes
60 minutes
75 minutes
No preference
```

**Available equipment** — optional free-text override or constraint.

Example:

```text
Gym machines and cables only
```

**Additional considerations** — optional.

Example:

```text
Avoid movements requiring heavy gripping.
```

Do not create a full training-profile editor.

Do not require users to re-enter equipment, training goals or constraints already available in the existing `robTrainingProfile`.

The request should be concise, with sensible character limits.

Keep the interface straightforward rather than introducing numerous advanced controls.

## 5. Request semantics

Convert form input into a bounded, deterministic creation instruction.

The existing `robProposal` callable accepts a request shaped approximately as:

```js
{
  type: "create_routine",
  instruction: "..."
}
```

Its current server validation limits the instruction to 600 characters.

Respect this limit across all combined form fields.

Validate user input before making a paid AI request.

Distinguish between:

- required focus/instruction;
- optional session duration;
- optional equipment restrictions;
- optional additional constraints.

Never silently truncate a user's important restrictions.

If the combined request exceeds the supported limit, provide clear feedback before submission.

Treat explicit equipment exclusions and safety constraints as restrictions rather than optional suggestions.

Approximate duration is a planning target, not a guaranteed completion time.

## 6. Rob context

Use the existing:

```js
buildRobContext()
```

with:

```js
requestType: ROB_CONTEXT_TYPES.PROGRAM_REVIEW
```

for create-routine requests.

This is important because the existing server contract expects:

```text
create_routine → program_review context
```

and:

```text
modify_routine → routine_review context
```

Do not change that contract unnecessarily or create a new context type solely for this feature.

Context should include:

- existing Fitbot coaching profile;
- training goals;
- equipment;
- documented constraints;
- selected program identity;
- existing routines within that program;
- relevant bounded training history where available.

Use the current **in-memory selected program draft**, not stale persisted program definitions.

Rob should consider the existing program when designing a complementary routine rather than assuming the user is starting from scratch.

A program with no existing routines must also be supported.

If required target-program context is missing or unavailable, block generation safely.

Respect existing context-size limits. Do not silently omit material program constraints when context is truncated.

## 7. Generation

Call the existing authenticated:

```js
requestRobProposal({
  context,
  request: {
    type: "create_routine",
    instruction
  }
})
```

Do not include a structured review object for this creation flow.

The existing `robProposal` callable should generate an untrusted candidate using the established `create_routine` schema.

Expected conceptual result:

```js
{
  proposalType: "create_routine",
  targetProgramId: "...",
  title: "...",
  summary: "...",
  routine: {
    name: "...",
    exercises: [...]
  }
}
```

Rob may propose:

- routine name;
- exercises;
- exercise order;
- sets;
- rep ranges;
- rest periods;
- notes;
- supported superset groupings.

Do not allow unrelated operations such as program modification, scheduling, archiving or automatically activating a program.

## 8. Exercise resolution and proposal validation

Pass the candidate through the existing:

```js
resolveRobProposalCandidate()
```

This must:

1. Resolve proposed movements using `exerciseProvider.js`.
2. Reject missing or ambiguous exercise identities.
3. Reject AI-invented provider IDs.
4. Generate stable routine and routine-exercise IDs through Fitbot.
5. Preserve the supported superset proposal representation.
6. Run `validateRoutineProposal()`.
7. Return only a validated normalized executable proposal.

Do not treat valid-looking AI JSON as an executable proposal.

Preserve the existing rule that exercise identity must come from Fitbot's provider boundary, not from Rob's assumptions.

Unsupported or unresolved exercises must fail safely.

Do not automatically substitute a different movement without user awareness.

## 9. Feasibility and constraints

Rob should use the requested duration, equipment and training focus to produce a plausible session.

For example:

```text
Request:
30-minute machine-only shoulder session
```

should not result in a large workout requiring 90 minutes or movements requiring unavailable free weights.

Where possible, enforce deterministic checks for explicit restrictions that can be reliably evaluated using existing exercise metadata.

Do not invent a comprehensive exercise-compatibility or workout-duration prediction engine.

Where precise verification is not possible, communicate limitations clearly.

For conflicting, unsupported or impossible requests:

- do not fabricate exercise availability;
- do not silently ignore hard restrictions;
- do not apply partial results;
- fail safely with a useful explanation.

No automatic second AI request should occur.

## 10. Async freshness

The selected program draft may change while Rob is generating the routine.

Capture the program identity and initial relevant draft state when generation begins.

Before accepting the returned candidate into executable proposal state:

1. Read the latest program draft.
2. Confirm the original target program still exists.
3. Confirm the target has not materially changed during generation.
4. Resolve and validate against that current draft.
5. Capture the existing create-routine freshness baseline.

Preserve the current conservative `create_routine` program-level fingerprint behaviour.

Do not accidentally apply a proposal to a different program because the user switched selection while the request was running.

Generation must remain read-only.

## 11. Preview and approval

Reuse:

```js
buildRoutineProposalPreview()
createRoutineProposalBaseline()
approveRobProposalWorkflow()
rejectRobProposalWorkflow()
```

and the existing application boundary.

The create-routine preview should prominently show:

```text
Rob's proposed routine

Upper Body — Shoulders & Arms

Approx. 45 minutes (estimate)

1. Machine Shoulder Press
   3 sets · 8–12 reps · 120 sec rest

2. Cable Lateral Raise
   3 sets · 12–15 reps · 90 sec rest

3. Lat Pulldown
   3 sets · 8–12 reps · 120 sec rest

4. Cable Triceps Pushdown
   3 sets · 10–15 reps · 90 sec rest

[Reject]                [Approve routine]
```

The duration estimate is optional and should only appear if supported by reliable local estimation or explicitly qualified as approximate.

Use the existing proposal preview formatter for authoritative exercise and prescription details.

Include any proposed superset groupings and meaningful notes.

Do not display raw JSON or internal IDs.

The creation preview should be read-only.

Do not introduce inline AI proposal editing, individual exercise approval or drag-and-drop modification in this card.

## 12. Approval behaviour

Approval must use the existing:

```js
prepareRoutineProposalApplication()
```

and:

```js
applyRoutineProposal()
```

through the established orchestrator.

Immediately before application:

- obtain the latest target program draft;
- verify the baseline fingerprint;
- revalidate the normalized proposal;
- block stale or invalidated proposals;
- apply atomically.

Successful approval must add the generated routine to **the selected program's editable draft only**.

The existing orchestrator should select the newly created routine in the builder using the returned `routineId`.

Do not invoke the ordinary create-routine handler if that handler persists structural changes automatically.

Do not change the active program, weekly schedule or workout session.

After approval, show:

```text
Routine added to your program draft.

Review it and use Save Program when you're ready.
```

The user must be able to adjust the routine using the ordinary editor before saving.

## 13. Rejection

Rejecting a proposal must:

- discard the executable proposal;
- clear its freshness baseline;
- leave all drafts unchanged;
- leave saved program definitions unchanged;
- perform no persistence.

If convenient, retain the user's original creation request in the form so it can be adjusted and resubmitted.

Do not retry or regenerate automatically.

## 14. Save Program

After approval:

```text
Rob proposal
    ↓
Human approval
    ↓
New routine in programDrafts
    ↓
Normal routine editing
    ↓
Save Program
    ↓
Existing persistence path
```

No separate Rob save action should exist.

Approval must not write to:

```text
Firestore
localStorage
programDefinitions
planning state
active workout
completed workout history
health state
```

The existing Save Program path must remain responsible for normalization, local persistence and cloud sync.

Preserve existing cloud-failure messaging and recovery behaviour.

## 15. Loading and error handling

Show a clear generation state:

```text
Rob is building your routine…
```

Disable duplicate generation submissions while pending.

Support clear user-facing errors for:

- missing program;
- empty or oversized request;
- invalid context;
- AI provider failure;
- malformed candidate;
- unsupported proposal type;
- unresolved exercise;
- invalid prescription;
- duplicate/conflicting exercise identity;
- stale target;
- preview-generation failure;
- failed application.

All errors must be non-destructive.

Keep retries explicit.

Do not expose raw AI responses, credentials, training-context JSON or provider diagnostics to the user.

Avoid automatic retries that create additional paid inference requests.

## 16. Testing

Extend the existing proposal, resolver and approval test suites rather than duplicating their coverage.

### Creation request

Verify:

- required focus is enforced;
- optional duration/equipment/constraints are incorporated;
- combined instruction length is bounded;
- empty inputs do not invoke AI;
- missing target program blocks generation;
- context uses the current unsaved draft;
- empty programs are supported;
- incorrect context/request combinations are rejected.

### Proposal generation

Cover:

- valid `create_routine` response;
- malformed AI output;
- unsupported candidate operations;
- incorrect target program;
- unsupported version;
- missing exercises;
- invalid prescriptions;
- unresolved provider exercise;
- ambiguous provider results;
- valid create-routine supersets;
- correct Fitbot-owned stable IDs.

### Freshness

Verify:

- program changes during generation invalidate the request;
- switching programs cannot redirect the proposal;
- changes after preview but before approval block application;
- unchanged drafts remain approvable.

### Approval/rejection

Verify:

- preview is generated before application;
- no draft changes before approval;
- rejecting causes no mutation;
- approving adds exactly one routine;
- duplicate approval is blocked;
- approval uses the existing pure application boundary;
- application failure leaves the draft unchanged;
- the newly created routine is selected for editing.

### Persistence

Explicitly test:

```text
Generate → Reject → zero writes
Generate → Approve → draft only
Generate → Approve → Save Program → persists
Generate → Invalid proposal → zero writes
Generate → Stale proposal → zero writes
```

Verify unrelated programs, active workouts, history, planning and health remain unchanged.

### Regression

Retain existing tests covering:

- modification proposal preparation;
- modification approval;
- routine proposal validation;
- superset grouping;
- persistence boundaries;
- ordinary manual routine creation.

Do not weaken existing tests to accommodate the new flow.

## 17. Manual validation

Test the deployed flow with these representative requests:

**A. Normal gym routine**

> Create a 60-minute upper-body hypertrophy routine using gym machines and cables.

Confirm the proposed exercises and prescriptions are sensible and preview correctly.

**B. Restricted equipment**

> Create a 30-minute shoulder and arm workout using dumbbells only.

Check that the output respects equipment restrictions.

**C. Existing program context**

Request another upper-body routine for a program that already contains multiple upper-body sessions.

Confirm Rob receives those routines as context and attempts a complementary session rather than ignoring the existing program.

**D. Rejection**

Generate, preview and reject.

Confirm the program remains unchanged.

**E. Approval without saving**

Approve, navigate to the routine editor and confirm the new routine is present only in the draft.

Confirm no persistence occurs.

**F. Approval with saving**

Approve, inspect, click Save Program and reload.

Confirm the new routine persists using the established path.

**G. Impossible or unsupported request**

Request equipment or movements unavailable through the existing exercise provider.

Confirm Fitbot fails safely rather than inventing provider identities.

## 18. Scope exclusions

Do not implement:

- whole-program generation;
- multi-routine generation;
- automatic scheduling;
- changing the active program;
- automatic workout activation;
- new training-profile editing;
- autonomous Rob actions;
- per-exercise proposal approval;
- proposal persistence/history;
- new AI provider/model selection;
- generic AI workflow engines;
- paid-usage dashboards, quotas or diagnostics enhancements.

The related **Harden Rob usage controls and diagnostics** card remains separate.

Reuse existing safety, error and provider controls without implementing that later card early.

## 19. Documentation

Update the source-of-truth documentation:

```text
docs/01-product.md
docs/02-technical.md
docs/03-current-state.md
```

Document:

- Create with Rob entry point;
- request inputs and program context;
- reuse of `program_review` context for creation;
- `create_routine` proposal generation;
- exercise-provider resolution;
- validation and freshness;
- human preview and approval;
- draft-only routine insertion;
- explicit Save Program persistence;
- current limitations.

Do not describe autonomous scheduling or whole-program generation as implemented.

## 20. Validation and deployment

Run the established:

```text
lint
full test suite
production build
```

Run relevant Firebase Functions validation if server code changes.

If only client-side code changes, avoid unnecessary Functions deployment.

If the server proposal request validation or prompts require modification, deploy only the relevant function using existing Firebase configuration and secrets.

Do not recreate or replace existing provider credentials.

Confirm the production Vercel deployment and perform an authenticated creation smoke test.

## 21. Completion criteria

This card is complete when:

1. Create with Rob is available inside the selected program builder.
2. Users can provide a concise routine goal and optional constraints.
3. Rob receives the existing profile and selected-program context.
4. Requests use the existing `create_routine` proposal contract.
5. Generated exercises resolve through Fitbot's existing provider.
6. The AI cannot invent accepted persistent exercise IDs.
7. New routine and row IDs are Fitbot-owned.
8. Invalid candidates never become executable proposals.
9. Users see the full routine preview before approval.
10. Approve and Reject are explicit.
11. Rejection leaves draft and saved state unchanged.
12. Stale proposals are blocked.
13. Application uses the existing approval orchestrator and pure apply boundary.
14. Approval inserts exactly one routine into the correct program draft.
15. No automatic program activation or scheduling occurs.
16. Approval performs no persistence.
17. Save Program persists through the normal path.
18. Invalid/impossible requests fail without partial drafts.
19. Existing modification workflows remain unaffected.
20. Tests and production build pass.
21. Documentation is current.

**Suggested commit:**

`feat: create routines with Rob using safe proposals`

## Final architectural requirement

The feature must be a new entry point into an existing safety-controlled workflow, not a new parallel implementation.

```text
User's routine request
        ↓
Current Fitbot profile + program context
        ↓
Existing authenticated robProposal callable
        ↓
create_routine candidate
        ↓
Existing exercise resolution
        ↓
validateRoutineProposal()
        ↓
Existing preview + human approval
        ↓
Existing freshness + revalidation
        ↓
applyRoutineProposal()
        ↓
Unsaved program draft
        ↓
Explicit Save Program
        ↓
Existing persistence
```

**Rob designs the routine. Fitbot validates it. The user approves it. Save Program commits it.**