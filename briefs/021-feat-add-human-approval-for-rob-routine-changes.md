I grounded this against the current `nevinbutcher-prog/nevfit` repo and its `docs/` source of truth github-fit. The key design decision I’ve made explicit is that **validator success alone is not sufficient stale detection**: if the routine changed but the proposal still happens to validate structurally, it should still be blocked as stale.

# Codex Implementation Brief — Add human review and approval for Rob changes

## PROJECT

Fitbot

## CARD

**Add human review and approval for Rob changes**

## PHASE

Proposal Integration

## PRIORITY

Critical

---

# 1. Objective

Add the human approval boundary between Fitbot's existing validated Rob routine proposals and the existing editable program draft workflow.

A validated proposal must remain inert until the user explicitly approves it.

Before approval, show the user a clear Fitbot-native description of every proposed change. The user must be able to deliberately:

- approve the complete proposal; or
- reject the complete proposal.

Approval must:

1. confirm the proposal is still valid for the same current draft state it was prepared against;
2. revalidate the proposal against the latest in-memory program draft;
3. call the existing pure `applyRoutineProposal(currentProgram, proposal)` boundary;
4. replace only that program's editable draft with the returned program;
5. perform no persistence.

The existing **Save Program** action remains the sole persistence commit for approved Rob changes.

Rejection must discard the transient proposal without modifying the program draft.

---

# 2. Current architecture to preserve

Fitbot already has the important safety boundaries required by this card.

Existing proposal contract:

```js
validateRoutineProposal(proposal, currentProgram)
// { valid, errors, normalizedProposal }

applyRoutineProposal(currentProgram, proposal)
// success:
// {
//   applied: true,
//   errors: [],
//   program,
//   routineId,
//   review
// }
//
// failure:
// {
//   applied: false,
//   errors,
//   program: null,
//   review: null
// }
```

Relevant existing modules/state include:

```text
src/services/routineProposal.js
src/services/rob/robProposalClient.js
src/App.jsx

programDrafts
programDraftsRef
robProposalState
```

Current Rob proposal state is transient and currently resembles:

```js
{
  status: "idle",
  explanation: null,
  proposal: null,
  error: null
}
```

Current Rob routine-review UX can prepare a validated proposal and reports:

```text
Proposal ready for review
```

but deliberately has no approval/application path yet.

The program builder already treats ordinary exercise editing as draft-only:

```text
add
swap
remove
reorder
prescription/config changes
superset changes
```

These modify `programDrafts`.

They do not persist automatically.

The existing **Save Program** path normalizes and persists the draft.

Do not weaken or bypass this boundary.

---

# 3. Core invariant

The required lifecycle is:

```text
Rob review
    ↓
candidate proposal
    ↓
exercise resolution
    ↓
validateRoutineProposal()
    ↓
validated transient proposal
    ↓
HUMAN REVIEW
    ↓
Approve ─────────────── Reject
    ↓                      ↓
freshness check          discard proposal
    ↓                      ↓
revalidate              no mutation
    ↓
applyRoutineProposal()
    ↓
programDrafts only
    ↓
user may continue editing
    ↓
Save Program
    ↓
persistence
```

At no point may Rob directly:

```text
save a program
write Firestore
write localStorage
modify active workout
modify history
modify planning
modify health
```

---

# 4. Scope

Implement:

1. human-readable proposal preview;
2. explicit Approve changes control;
3. explicit Reject control;
4. proposal freshness tracking;
5. mandatory revalidation immediately before application;
6. application through `applyRoutineProposal()` only;
7. replacement of the appropriate program draft only;
8. safe failure handling;
9. post-approval draft UX;
10. comprehensive tests.

Do not implement later Rob routine-creation UX beyond what is already inherently supported by the provider-neutral proposal contract.

In particular, do not implement the related later card:

```text
Create routines with Rob using existing proposal safety
```

Do not add new entry points asking Rob to create routines.

---

# 5. Proposal preview must not mutate state

Introduce a pure presentation-layer transformation for proposal review.

Preferred boundary:

```js
buildRoutineProposalPreview(currentProgram, proposal)
```

or an equivalently named pure helper.

It should:

- take the current program draft and validated proposal;
- resolve stable IDs to human-readable routine/exercise names;
- return presentation data;
- perform no state mutation;
- perform no persistence;
- perform no network request;
- not call Firestore;
- not call localStorage;
- not apply the proposal.

Keep proposal execution and proposal presentation separate.

Do not make React JSX understand the raw proposal schema in many different branches if this can be isolated cleanly into a small deterministic formatter/helper.

---

# 6. Preview UX

After successful proposal preparation, replace the current minimal:

```text
Proposal ready for review
```

state with a genuine review surface.

Suggested hierarchy:

```text
Rob's suggested changes

[proposal summary / explanation]

Routine A

• Add Lat Pulldown
  3 sets · 8–12 reps · 120 sec rest
  After Seated Cable Row

• Replace Wide-Grip Pull-Up
  with Neutral-Grip Pulldown

• Dumbbell Bench Press
  Sets: 3 → 4
  Reps: 8–12 → 6–10
  Rest: 120 sec → 150 sec

• Move Lateral Raise
  After Shoulder Press

• Rename routine
  Push A → Upper A

• Superset
  Cable Lateral Raise + Triceps Pushdown

[Reject]                [Approve changes]
```

Fit the styling into the existing Rob dark-panel visual language.

Do not create an unrelated visual system.

---

# 7. Plain Fitbot terminology

Normal users must never need to interpret raw proposal JSON.

Do not expose values such as:

```text
routineExerciseId
targetRoutineExerciseId
afterRoutineExerciseId
proposalGroupKey
exerciseId
targetProgramId
targetRoutineId
supersetGroupId
```

as primary UI.

Internal IDs may be useful in development diagnostics but are not user-facing change descriptions.

Use normal Fitbot terminology such as:

```text
Add
Remove
Replace
Move
Sets
Reps
Rest
Name
Superset
Routine
```

---

# 8. Changes that must be previewable

The preview layer must cover every currently supported modification operation.

## `add_exercise`

Show:

```text
Add <exercise>
```

Include useful prescription details:

```text
3 sets
8–12 reps
120 sec rest
```

If applicable show position:

```text
At start of routine
```

or:

```text
After <exercise>
```

Do not expose the anchor row ID.

---

## `remove_exercise`

Show:

```text
Remove <exercise>
```

Use the current draft to resolve the targeted row.

---

## `replace_exercise`

Show both identities:

```text
Replace:
Wide-Grip Pull-Up

With:
Neutral-Grip Pulldown
```

Where meaningful, also surface changed prescription values resulting from the replacement.

Remember that `applyRoutineProposal()` preserves the target stable routine-row identity while changing the provider exercise/prescription.

That implementation detail should remain internal.

---

## `move_exercise`

Show:

```text
Move <exercise>
```

plus:

```text
To start of routine
```

or:

```text
After <exercise>
```

Resolve both target and anchor names from the current draft.

---

## `update_exercise`

Only show fields that actually change.

Examples:

```text
Sets
3 → 4

Reps
8–12 → 6–10

Rest
120 sec → 90 sec

Name
Dumbbell Bench Press → Incline DB Press

Note
Old note → New note
```

Do not clutter the preview with unchanged fields.

Use existing normalized Fitbot values.

---

## `rename_routine`

Show:

```text
Routine name
Push A → Upper A
```

---

## `set_superset`

Resolve member row IDs to exercise names.

Example:

```text
Create superset

Cable Lateral Raise
+
Triceps Pushdown
```

Support the existing proposal grouping semantics rather than inventing a new superset representation.

---

## `clear_superset`

Explain the effect in human terms.

Example:

```text
Remove superset containing Cable Lateral Raise
```

If the current grouping can safely be resolved, show the affected members.

---

# 9. Duplicate exercise names

The underlying contract correctly targets:

```text
routineExerciseId
```

rather than display names.

Preserve this.

If a routine contains visually identical exercise names, preview generation must still resolve the correct row by stable `routineExerciseId`.

Do not change execution targeting to:

```text
exerciseId
array index
displayName
```

for convenience.

---

# 10. Proposal explanation and change preview

Keep these concepts distinct.

The Rob-provided explanation may remain visible as context:

```text
Rob suggests slightly reducing pressing redundancy and increasing lateral-delt volume.
```

But the authoritative approval content should be the deterministic Fitbot-generated change preview derived from:

```text
normalizedProposal + currentProgram
```

Do not let AI prose become the execution specification.

---

# 11. Approval must be explicit

Do not apply a proposal:

- when generation finishes;
- when the preview opens;
- when the panel closes;
- when navigating back;
- when clicking the proposal summary;
- when Save Program is later pressed.

Application requires an explicit control such as:

```text
Approve changes
```

The approval button should be visually primary relative to Reject but should not resemble **Save Program**.

Suggested terminology:

```text
Reject
Approve changes
```

Avoid ambiguous labels such as:

```text
OK
Continue
Done
Accept Rob
```

---

# 12. Reject semantics

Reject must:

1. discard/clear the transient executable proposal;
2. clear its associated proposal freshness metadata;
3. leave `programDrafts` logically unchanged;
4. leave persisted program definitions unchanged;
5. make no localStorage write;
6. make no Firestore write;
7. make no active-workout/history mutation.

Do not use `applyRoutineProposal()` on rejection.

A simple transition back to the existing completed Rob review is sufficient.

The review itself may remain visible so the user can still read Rob's reasoning.

---

# 13. Critical: freshness must be stronger than validation alone

Do not equate:

```text
validateRoutineProposal(proposal, latestDraft).valid === true
```

with:

```text
proposal is fresh
```

These are different guarantees.

Example:

1. Rob proposes changing Chest Press from 3 sets to 4.
2. User manually changes Chest Press from 3 sets to 5.
3. The proposal may still structurally validate because the same row exists.
4. Applying it would overwrite the user's newer intent with 4 sets.

That proposal is stale and must be blocked.

---

# 14. Capture a generation baseline

When a proposal successfully reaches validated executable state, retain transient freshness metadata describing the exact target draft state against which it was validated.

Prefer a deterministic snapshot/fingerprint of the relevant target.

For `modify_routine`, capture at least the normalized target routine state.

For example:

```js
{
  proposal,
  baseline: {
    programId,
    routineId,
    fingerprint
  }
}
```

The fingerprint must be deterministic and derived from domain data, not object identity.

Do not use:

```js
currentRoutine === originalRoutine
```

as the freshness check.

React state objects can be recreated without meaningful data changes.

---

# 15. Fingerprint contents

For a modification proposal, the fingerprint should detect relevant changes including:

```text
routine name
exercise order
routineExerciseId
exerciseId
sets
repRange
restSeconds
displayNameOverride
note
supersetGroupId
```

Use normalized values.

Ignore unrelated transient UI state such as:

```text
expanded card
search query
active tab
Rob panel state
loading flags
```

The aim is:

> Has the actual target routine draft changed since the proposal was prepared?

not:

> Has React rendered again?

---

# 16. Do not use timestamps as freshness authority

Do not solve this with only:

```text
proposalCreatedAt
programUpdatedAt
```

unless the existing domain model already has authoritative draft revision tracking, which it currently does not appear to.

A deterministic target snapshot/fingerprint is safer and easier to test.

---

# 17. Approval-time stale check

When the user presses **Approve changes**:

1. obtain the latest target program from `programDraftsRef.current` or equivalently authoritative current draft state;
2. confirm the target program still exists;
3. confirm the target routine still exists where applicable;
4. calculate the latest target fingerprint;
5. compare it with the proposal-generation baseline;
6. if different, block application as stale;
7. then independently run `validateRoutineProposal()` again against that latest program;
8. only then call `applyRoutineProposal()`.

Order conceptually:

```js
const latestProgram = getCurrentDraftProgram();

if (!proposalMatchesBaseline(latestProgram, baseline)) {
  return stale;
}

const validation = validateRoutineProposal(proposal, latestProgram);

if (!validation.valid) {
  return invalidated;
}

const result = applyRoutineProposal(
  latestProgram,
  validation.normalizedProposal
);
```

Even though `applyRoutineProposal()` validates internally, retain the explicit pre-application validation step because this UI boundary needs to distinguish:

```text
stale proposal
invalid proposal
application failure
```

and give the user appropriate feedback.

---

# 18. Always apply the normalized proposal

Do not fall back to:

```text
raw provider candidate
unresolved candidate
original AI JSON
```

Only the validated normalized proposal from the existing Rob proposal pipeline may enter approval state.

At approval, revalidate and prefer applying the resulting latest:

```js
validation.normalizedProposal
```

rather than assuming the previously normalized object remains authoritative.

---

# 19. Async safety

Do not close over an old `selectedProgramDraft` and later apply to it.

The user may edit the builder while Rob proposal state exists.

Approval must obtain the current draft at click time.

Use the existing current-draft reference pattern where appropriate:

```text
programDraftsRef
```

rather than relying solely on stale render-time closures.

---

# 20. Stale UX

If the target changed after proposal preparation, do not silently regenerate or reinterpret the proposal.

Show a clear message such as:

```text
This routine has changed since Rob prepared these suggestions.

Review the latest routine with Rob again before applying them.
```

Then prevent application.

Preferred behaviour after detecting staleness:

- proposal is no longer executable;
- Approve is disabled/removed;
- offer a clean path back to the review;
- user can deliberately prepare a new proposal.

Do not automatically make another paid AI request.

---

# 21. Existing proactive stale clearing

The previous proposal-generation work may already clear or invalidate proposal state when relevant draft edits occur.

Preserve that behaviour.

However, **do not depend on it as the only safety mechanism**.

Approval must perform its own freshness check immediately before application.

This protects against:

- missed mutation paths;
- async state races;
- future editor changes;
- stale closures.

---

# 22. Revalidation failures

The latest:

```js
validateRoutineProposal()
```

may fail even if the proposal was originally valid.

Examples:

```text
target program removed
target routine removed
target row removed
anchor removed
superset membership changed incompatibly
proposal target now invalid
operation conflict introduced
```

Treat this as an invalidated/stale proposal.

Do not attempt partial application.

Do not repair the proposal automatically.

Do not ask the model to fix it automatically.

Show a safe user-facing message and require a new proposal.

---

# 23. Application boundary

The approval handler must call the existing:

```js
applyRoutineProposal(currentProgram, proposal)
```

Do not reproduce proposal operations manually in React.

Do not implement separate UI mutation branches such as:

```js
if add -> addRoutineExercise(...)
if move -> reorderRoutineExercise(...)
if rename -> updateProgramDay(...)
```

The entire purpose of the existing proposal contract is to provide a single deterministic application boundary.

Use it.

---

# 24. Atomic application

A proposal is all-or-nothing.

If:

```js
applyRoutineProposal()
```

returns:

```js
{
  applied: false
}
```

then:

```text
programDrafts must remain untouched
```

Do not apply the successful prefix of a multi-change proposal.

Do not mutate the existing draft before the apply call succeeds.

---

# 25. Draft-only update

On successful application:

```js
result.applied === true
result.program != null
```

replace only the matching entry inside `programDrafts`.

Conceptually:

```js
setProgramDrafts((drafts) =>
  drafts.map((program) =>
    program.id === result.program.id
      ? result.program
      : program
  )
);
```

Use the project's established state-update conventions rather than copying this literally if there is an existing helper.

Do not call the persistence helper during this update.

---

# 26. Important distinction from structural-action persistence

Fitbot currently retains some existing automatic persistence semantics for structural program/routine actions such as:

```text
program creation
routine creation
routine duplication
routine archive
```

Do not accidentally route approved Rob changes through those structural-action handlers.

Rob approval has an explicit requirement:

```text
draft only
```

Therefore even if `applyRoutineProposal()` technically returns a newly created routine for a `create_routine` proposal, this card's application boundary must still update only the editable program draft.

It must not invoke any existing create-routine auto-save path.

---

# 27. No persistence on approval

Approval must not call:

```text
persistProgramDrafts
saveProgram
programStore
setDoc
localStorage.setItem
setProgramsAndPersist
```

or another persistence wrapper.

Expected state immediately after approval:

```text
programDrafts = changed
programDefinitions/persisted program = unchanged
```

until the user deliberately clicks:

```text
Save Program
```

---

# 28. Save Program after approval

After approval, the user should return to the normal builder workflow with the Rob changes represented as ordinary unsaved edits.

The existing **Save Program** control must behave exactly as it does for manual edits.

When clicked:

```text
approved Rob draft
    ↓
normal program normalization
    ↓
normal local-first persistence
    ↓
normal Firestore attempt
```

Do not create a special:

```text
Save Rob changes
```

persistence path.

Rob changes cease to be special once successfully applied to the draft.

---

# 29. Cancel/discard after approval

Preserve existing editor semantics for abandoning unsaved draft edits.

If the current builder has an existing cancel/reset/reload/discard mechanism, an approved-but-unsaved Rob change must participate in that workflow exactly like a manual unsaved edit.

Do not persist merely because the proposal was approved.

Tests should prove:

```text
approve -> cancel/discard
```

does not make Rob's changes durable.

---

# 30. Proposal state after successful application

After a successful approval:

- clear the executable proposal;
- clear its freshness baseline;
- do not allow the same proposal to be applied a second time;
- retain enough benign presentation state to show a success acknowledgement if useful.

Suggested message:

```text
Changes added to your program draft.

Review them in the routine, then use Save Program when you're ready.
```

This copy is important because:

```text
Approve changes
```

must not imply persistence.

---

# 31. Return to builder

After successful application, prefer returning the user to the affected routine/program editor so the visible draft itself becomes the final inspection surface.

For a modify proposal:

```text
return to target routine
```

If the Rob panel already maintains a builder return target, reuse it.

Do not invent a separate navigation model.

The user should be able to immediately inspect and further edit the approved changes before saving.

---

# 32. Apply failure handling

Wrap the UI application boundary safely.

Potential failure classes:

```text
freshness mismatch
validation failure
applyRoutineProposal result.applied === false
unexpected application exception
```

For any failure:

- preserve the current draft exactly;
- do not persist;
- do not partially apply;
- show a useful error;
- prevent accidental duplicate application.

Unexpected failure copy may be along the lines of:

```text
Fitbot couldn't apply these changes safely. Your routine hasn't been changed.
```

Do not display a success message unless state replacement actually succeeded.

---

# 33. Proposal preview failure

If deterministic preview generation cannot resolve a target that should exist:

- do not render misleading fallback text;
- treat the proposal as unsafe/stale/invalid;
- disable approval.

For example, do not render:

```text
Remove Unknown exercise
```

and still offer Approve.

An unresolved execution target means the proposal needs to be rejected from the approval path.

---

# 34. React state design

Keep transient Rob workflow state separate from program data.

Either extend `robProposalState` carefully or introduce a small approval-specific object.

Example concept:

```js
{
  status: "success",
  explanation,
  proposal,
  baseline: {
    programId,
    routineId,
    fingerprint
  },
  preview,
  error: null
}
```

Possible statuses may include:

```text
idle
loading
success
applying
stale
error
applied
```

Do not over-engineer a generic workflow state machine if simple explicit state is sufficient.

The important requirement is that executable proposal data and its freshness baseline remain coupled.

---

# 35. Prevent duplicate actions

While approval is executing:

```text
Approve changes
Reject
Prepare routine proposal
```

should not permit conflicting duplicate transitions.

The application itself is synchronous today, but keep the UI transition atomic enough that rapid double-clicks cannot apply the same proposal twice.

After success, the proposal must no longer be executable.

---

# 36. Do not regenerate on Approve

Approving must not call:

```text
robProposal
requestRobProposal()
OpenRouter
searchExercises()
```

again.

Approval operates on the already resolved and validated proposal, subject to local freshness and validation checks.

If stale, the user must explicitly prepare a new proposal.

This avoids both surprising changes and unnecessary paid AI inference.

---

# 37. No individual-change approval in this card

The proposal is approved or rejected as one unit.

Do not implement:

```text
per-change checkboxes
accept some / reject some
inline proposal editing
dragging proposed changes
proposal patch editing
manual JSON editing
```

Those create substantially more conflict/freshness complexity and are outside this card.

---

# 38. No undo system in this card

Do not create a bespoke Rob undo/history system.

Before **Save Program**, the approved result is simply draft state and should use the existing builder's normal editing/discard semantics.

A future generalized undo feature can be handled separately.

---

# 39. Do not persist proposal state

Do not persist:

```text
proposal
approval state
proposal preview
baseline fingerprint
Rob explanation
rejection
approval result
```

to:

```text
Firestore
localStorage
program documents
routine documents
workout history
```

Proposal review state remains transient.

Refreshing the app may legitimately discard it.

---

# 40. Preview helper tests

Unit-test the deterministic preview formatter.

Cover at minimum:

```text
add_exercise
remove_exercise
replace_exercise
move_exercise
update_exercise
rename_routine
set_superset
clear_superset
```

Verify the preview contains meaningful names and before/after values.

Verify it does not require exposing raw IDs.

---

# 41. Prescription preview tests

Given:

```js
{
  sets: 3,
  repRange: "8-12",
  restSeconds: 120,
  displayNameOverride: null,
  note: null
}
```

and updates to:

```js
{
  sets: 4,
  repRange: "6-10",
  restSeconds: 90
}
```

verify the preview exposes:

```text
Sets: 3 → 4
Reps: 8–12 → 6–10
Rest: 120 sec → 90 sec
```

and does not list unchanged fields.

Use existing normalization rules when comparing values.

---

# 42. Approval success test

Arrange:

- current program draft A;
- valid normalized proposal P;
- matching generation baseline.

Approve.

Verify:

1. latest program draft is obtained;
2. baseline is still current;
3. `validateRoutineProposal(P, latestDraft)` succeeds;
4. `applyRoutineProposal()` executes;
5. only target program inside `programDrafts` changes;
6. persisted definitions remain unchanged;
7. no persistence service is called;
8. proposal can no longer be reapplied.

---

# 43. Reject test

Snapshot:

```text
programDrafts
programDefinitions
```

Reject a valid proposal.

Verify:

```text
programDrafts unchanged
programDefinitions unchanged
proposal cleared
baseline cleared
no persistence call
applyRoutineProposal not called
```

---

# 44. Stale prescription test

This is critical.

1. Generate proposal against:

```text
Chest Press
3 × 8–12
```

2. Retain valid proposal.
3. User manually changes draft to:

```text
Chest Press
5 × 8–12
```

4. Proposal remains structurally valid.
5. Press Approve.

Expected:

```text
blocked as stale
applyRoutineProposal not called
draft stays at 5 sets
no persistence
```

This proves stale detection is stronger than validator validity.

---

# 45. Stale order test

Generate a proposal.

Then manually reorder the target routine without deleting any rows.

Approve.

Expected:

```text
baseline mismatch
application blocked
```

even if all stable IDs still exist.

---

# 46. Stale superset test

Generate proposal.

Then manually change a superset relationship.

Approve.

Expected:

```text
stale
no application
```

---

# 47. Stale rename test

Generate proposal.

Rename the routine manually.

Approve.

Expected:

```text
stale
no application
```

This is particularly important if the proposal itself also includes a rename.

---

# 48. Missing-target test

After proposal preparation, remove/archive/change context such that its target program or routine is no longer available.

Approve.

Expected:

```text
blocked safely
no crash
no mutation
no persistence
```

---

# 49. Revalidation failure test

Construct a proposal with a matching baseline fixture but which fails latest:

```js
validateRoutineProposal()
```

Expected:

```text
applyRoutineProposal not called
draft unchanged
structured safe error shown
```

This ensures revalidation is a mandatory application gate.

---

# 50. Apply failure test

Mock:

```js
applyRoutineProposal()
```

returning:

```js
{
  applied: false,
  errors: [...],
  program: null,
  review: null
}
```

Verify:

```text
setProgramDrafts does not receive a modified program
draft unchanged
proposal not treated as successfully applied
no persistence
```

---

# 51. Unexpected application exception test

Make the application boundary throw.

Verify:

```text
draft unchanged
persisted data unchanged
user receives non-destructive error
```

No partial mutation should be possible because application receives and clones the source program rather than mutating it.

---

# 52. Save-after-approval test

Workflow:

```text
prepare proposal
approve
inspect changed programDrafts
Save Program
```

Verify:

- approval itself triggers zero persistence;
- existing Save Program path then persists the approved draft normally;
- no special Rob persistence code is used.

---

# 53. Cancel/discard-after-approval test

Workflow:

```text
prepare
approve
do not save
cancel/discard/reload persisted builder state through existing workflow
```

Verify the approved changes are not durable.

Use the actual existing builder cancellation/reset semantics available in the codebase rather than inventing a test-only workflow.

---

# 54. Unrelated state test

Snapshot:

```text
activeWorkout
completedWorkouts
planning
health
```

Approve a Rob routine proposal.

Verify every unrelated domain remains unchanged.

---

# 55. Persistence spy test

During:

```text
preview
reject
approve
stale detection
validation failure
apply failure
```

spy/mock the relevant persistence boundaries.

There must be zero writes from this card's approval flow.

Useful targets include the existing equivalent of:

```text
persistProgramDrafts
saveProgram
localStorage.setItem
Firestore writes
```

The only persistence test expected to write is the explicit subsequent **Save Program** test.

---

# 56. Source-level safety regression

Add/retain a regression assertion where practical ensuring the approval helper/application service does not import persistence infrastructure.

For example, a pure service used for:

```text
fingerprint
preview
approval validation
```

should have no dependencies on:

```text
firebase
firestore
programStore
localStorage
```

Keep UI orchestration thin.

---

# 57. Recommended service split

Avoid making `App.jsx` responsible for every detail.

A reasonable implementation could introduce a pure helper such as:

```text
src/services/rob/robProposalApproval.js
```

containing functions conceptually similar to:

```js
createRoutineProposalBaseline(program, proposal)

isRoutineProposalFresh(program, baseline)

buildRoutineProposalPreview(program, proposal)

prepareRoutineProposalApplication(program, proposal, baseline)
```

However, do not create abstractions merely for naming symmetry.

The important separation is:

```text
pure domain comparison/preview logic
vs
React state orchestration
```

`applyRoutineProposal()` itself remains in:

```text
src/services/routineProposal.js
```

Do not relocate or duplicate it.

---

# 58. Fingerprint implementation guidance

Prefer a deterministic canonical representation rather than a general-purpose hashing dependency.

For example, normalize the relevant target into a stable POJO containing only proposal-relevant fields and compare or stringify that canonical structure.

Conceptually:

```js
{
  id: routine.id,
  name: routine.name,
  exercises: routine.exercises.map((entry) => ({
    routineExerciseId: entry.routineExerciseId,
    exerciseId: entry.exerciseId,
    sets: entry.sets,
    repRange: entry.repRange,
    restSeconds: entry.restSeconds,
    displayNameOverride: entry.displayNameOverride ?? null,
    note: entry.note ?? null,
    supersetGroupId: entry.supersetGroupId ?? null,
  })),
}
```

Avoid adding a crypto/hash package just for this feature unless the repository already has an appropriate utility.

The fingerprint is an in-process stale-detection token, not a security signature.

---

# 59. Create-routine proposal freshness

The provider-neutral proposal contract already supports:

```text
create_routine
```

even though the later product card will expose broader Rob routine creation.

Keep this approval implementation compatible with the contract without building that later UX.

For a create proposal, stale detection should conservatively detect relevant target-program changes since proposal validation.

At minimum include enough program/routine structure in its baseline to ensure a newly created routine is not inserted based on materially changed program context.

Do not add a new "Create routine with Rob" entry point in this card.

---

# 60. Accessibility

Approval controls must:

- use real `button` elements;
- retain keyboard activation;
- expose visible focus states;
- not communicate approve/reject solely through colour;
- disable appropriately during unavailable states;
- surface stale/error text in a readable manner.

Do not use tiny icon-only confirmation controls for this safety boundary.

This is a deliberate human approval event and should read as one.

---

# 61. Mobile behaviour

Fitbot is used during workouts and on mobile-sized screens.

The proposal preview must:

- wrap long exercise names cleanly;
- avoid horizontal scrolling for before/after values;
- keep Approve and Reject reachable;
- avoid a huge raw-data table;
- support multiple changes without crushing each item into one line.

A stacked card/list presentation is preferable to a desktop-style diff table.

---

# 62. UX success state

After successful approval, clearly distinguish:

```text
applied to draft
```

from:

```text
saved
```

Recommended copy:

```text
Changes added to your program draft. Review them and use Save Program when you're ready.
```

Avoid:

```text
Changes saved
Rob updated your program
Program updated successfully
```

because those imply persistence.

---

# 63. Logging/privacy

Do not add logs containing:

```text
full proposal JSON
exercise notes
Rob review text
training context
health data
program contents
```

If development diagnostics are useful, limit them to safe metadata such as:

```text
proposal ID
proposal type
result code
change count
stale true/false
```

and follow the project's existing privacy-safe Rob diagnostics conventions.

---

# 64. Error codes

Where a pure approval helper returns structured results, prefer stable codes suitable for tests rather than parsing display strings.

Examples:

```text
rob_proposal_stale
rob_proposal_invalidated
rob_proposal_apply_failed
rob_proposal_target_missing
```

Do not leak lower-level exceptions directly into UI copy.

Reuse existing error conventions where they already cover these cases.

---

# 65. Non-goals

Do not implement:

```text
automatic proposal application
automatic proposal saving
partial proposal approval
proposal editing
proposal persistence
proposal history
Rob undo stack
AI tool calling
AI direct exercise mutation
AI direct save
automatic regeneration
whole-program Rob rewriting
new routine-creation entry points
in-workout Rob swaps
later related-card functionality
```

Stay strictly inside this card.

---

# 66. Documentation updates

Update:

```text
docs/01-product.md
docs/02-technical.md
docs/03-current-state.md
```

Document the new state accurately:

- routine-review proposals can now be inspected before application;
- preview uses human-readable Fitbot terminology;
- approval is explicit;
- rejection is non-mutating;
- proposals are checked for freshness;
- proposals are revalidated immediately before application;
- `applyRoutineProposal()` remains the sole proposal application boundary;
- successful approval changes `programDrafts` only;
- approved changes remain unsaved;
- Save Program remains the persistence boundary;
- proposal/approval state remains transient;
- Rob cannot directly persist or mutate unrelated domains.

Remove/update statements that currently say:

```text
no approval or Apply UI
```

where they describe the current state.

Do not document the later Rob routine-creation card as implemented.

---

# 67. Validation commands

Run the repository's established checks.

At minimum:

```text
lint
unit tests
build
```

Also run any existing Rob/proposal-specific suites.

Ensure current `routineProposal` regression coverage continues passing unchanged unless an assertion legitimately needs expansion.

Do not weaken existing tests to accommodate this feature.

---

# 68. Manual validation — approve

1. Open an existing routine.
2. Run **Review with Rob**.
3. Prepare a valid routine proposal.
4. Confirm the current routine has not changed.
5. Inspect the proposed changes.
6. Confirm all changes are readable without JSON.
7. Press **Approve changes**.
8. Confirm the routine editor now shows the proposed changes.
9. Confirm messaging says the changes are in the draft, not saved.
10. Refresh/reopen without saving using the normal persisted-state workflow.
11. Confirm the approved changes were not persisted.

Then repeat and explicitly press **Save Program**.

Confirm they persist through the existing path.

---

# 69. Manual validation — reject

1. Prepare a valid proposal.
2. Record the visible routine state.
3. Press **Reject**.
4. Confirm proposal UI disappears/returns to review state.
5. Confirm no routine field changed.
6. Confirm no save/sync indicator was triggered.

---

# 70. Manual validation — stale draft

1. Prepare a valid proposal.
2. Before approving, change one target routine field manually.
3. If existing proactive proposal invalidation clears it immediately, confirm it can no longer be approved.

Also exercise the lower-level automated path where stale proposal state survives long enough to reach approval.

Confirm the approval-time guard independently blocks it.

This second validation is essential; UI clearing alone is not sufficient proof.

---

# 71. Manual validation — comprehensive preview

Use fixtures/tests as needed to verify readable previews for:

```text
addition
removal
replacement
move
sets change
rep-range change
rest change
display-name change
note change
routine rename
superset creation
superset removal
```

No normal approval workflow should require opening developer tools or reading JSON.

---

# 72. Acceptance checks

This card is complete when:

1. A successfully prepared Rob proposal remains inert until human approval.
2. The user can inspect every proposed change before approval.
3. Additions are human-readable.
4. Removals are human-readable.
5. Replacements show before/after movements.
6. Moves show the affected movement and destination.
7. Prescription changes show useful before/after values.
8. Routine renames show old/new names.
9. Superset additions are readable.
10. Superset removals are readable.
11. Raw proposal JSON is not required for normal use.
12. Stable row IDs remain the underlying targeting mechanism.
13. The user has an explicit **Approve changes** action.
14. The user has an explicit **Reject** action.
15. Rejecting causes no program-draft mutation.
16. Rejecting causes no persistence.
17. Proposal preparation records a deterministic freshness baseline.
18. Meaningful target-routine changes make a modify proposal stale.
19. A proposal can be stale even if it still structurally validates.
20. Approval checks freshness against the latest current draft.
21. Approval does not rely on a stale React closure.
22. Approval reruns `validateRoutineProposal()`.
23. Invalidated proposals are blocked.
24. Stale proposals are blocked.
25. Stale proposals are not silently regenerated.
26. No automatic paid AI retry occurs.
27. Approved proposals are applied exclusively through `applyRoutineProposal()`.
28. React does not manually reproduce proposal operations.
29. Application is atomic.
30. Apply failures leave the draft untouched.
31. Unexpected application errors leave the draft untouched.
32. Successful approval replaces only the appropriate program draft.
33. Successful approval does not change persisted program definitions.
34. Successful approval does not write localStorage.
35. Successful approval does not write Firestore.
36. Successful approval does not modify active workouts.
37. Successful approval does not modify completed history.
38. Successful approval does not modify planning.
39. Successful approval does not modify health state.
40. The proposal cannot be applied twice.
41. Successful approval clearly says the changes are unsaved draft changes.
42. The affected routine/program can be inspected normally after approval.
43. Existing manual editing can continue after approval.
44. **Save Program** remains the sole persistence commit.
45. A later Save Program persists approved changes using the existing path.
46. Existing unsaved-draft cancellation/discard behaviour also applies to approved Rob changes.
47. Proposal state remains transient.
48. Tests cover approve.
49. Tests cover reject.
50. Tests cover a structurally-valid-but-stale proposal.
51. Tests cover stale ordering.
52. Tests cover stale prescription.
53. Tests cover stale superset state.
54. Tests cover missing targets.
55. Tests cover revalidation failure.
56. Tests cover `applyRoutineProposal()` failure.
57. Tests cover post-approval Save Program.
58. Tests prove approval itself causes zero persistence.
59. Existing proposal-contract tests continue to pass.
60. Documentation reflects the new approval boundary accurately.
61. No later **Create routines with Rob** UX is implemented early.
62. Lint, tests and production build pass.

---

# 73. Suggested implementation order

Implement in this order:

```text
1. Pure target snapshot/fingerprint helper
2. Pure proposal preview formatter
3. Unit tests for both
4. Capture freshness baseline on successful proposal preparation
5. Render proposal review UI
6. Add Reject path
7. Add approval-time freshness check
8. Add approval-time revalidation
9. Call applyRoutineProposal()
10. Replace matching programDraft only
11. Add applied-to-draft success/return UX
12. Add integration/regression tests
13. Verify Save/Cancel behaviour
14. Update docs
15. lint/test/build
```

Keeping freshness/preview logic pure before touching React should make the safety behaviour much easier to verify.

---

# 74. Architectural rule to preserve

The final authority chain must be:

```text
AI recommendation
    ↓
untrusted candidate
    ↓
Fitbot resolution
    ↓
Fitbot validation
    ↓
human inspection
    ↓
freshness check
    ↓
Fitbot revalidation
    ↓
human approval
    ↓
pure applyRoutineProposal()
    ↓
unsaved Fitbot draft
    ↓
explicit Save Program
    ↓
persistence
```

Neither Rob nor the proposal UI may skip a layer.

---

# 75. Suggested commit

```text
feat: add human approval for Rob routine changes
```

The stale-baseline requirement is the bit I’d treat as non-negotiable here. Simply running `validateRoutineProposal()` again catches broken IDs/anchors, but it would not necessarily catch “the user changed 3 sets to 5 while Rob was proposing 4”; this brief closes that hole.