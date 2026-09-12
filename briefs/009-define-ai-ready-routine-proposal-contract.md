PROJECT: Fitbot

CARD:
Define an AI-ready routine proposal contract

PHASE:
Future Compatibility

PRIORITY:
Medium

OBJECTIVE:
Create a deterministic, validated proposal boundary that future GPT coaching can use to suggest new routines or modifications to existing routines without directly mutating live Fitbot program data.

This card does **not** implement AI, model calls, chat, prompting, approvals UI, or automated routine generation.

The deliverable is the internal contract and validation/application boundary that future AI features will use.

The central rule is:

**Proposal data is inert until explicitly validated and applied.**

CURRENT ARCHITECTURE:
Fitbot already stores routine exercises using structured fields including:

```js
{
  exerciseId,
  sets,
  repRange,
  restSeconds,
  displayNameOverride,
  note,
  supersetGroupId,
}
```

Routine exercises use stable exercise IDs, while supersets are represented by shared `supersetGroupId` values. Workout sessions snapshot the effective exercise name and routine prescription at workout start.

Programs/routines are editable separately from completed workout history, and completed workout records are append-only historical snapshots.

The current persistence boundary uses explicit program saves rather than per-keystroke Firestore writes for routine editing.

TARGET OUTCOME:
Fitbot should have a proposal format capable of representing:

* a brand-new routine draft
* changes to an existing routine
* exercise additions
* exercise removals
* exercise reordering
* exercise replacements
* sets/rep-range/rest changes
* optional display-name changes
* optional notes
* superset grouping changes

The proposal must be:

* deterministic
* serializable
* reviewable
* validated before application
* separate from live persisted state
* safe against partial or invalid mutation

FUTURE INTENT:
A future GPT coach may eventually produce something conceptually like:

```json
{
  "proposalType": "modify_routine",
  "targetProgramId": "program-123",
  "targetRoutineId": "routine-a",
  "summary": "Reduce shoulder volume and replace one pressing movement.",
  "changes": [...]
}
```

This card should define the internal contract needed to support that future workflow without implementing the AI source.

IMPLEMENTATION REQUIREMENTS:

1. Inspect existing program/routine shape first
   Review:

* program/routine structures in current app state
* `src/services/programStore.js`
* any normalization helpers
* focused exercise editor
* superset logic
* program save/update helpers
* workout-start snapshot creation
* local cache and Firestore persistence flow

The proposal shape should align with existing Fitbot data rather than creating a parallel routine model.

2. Create a dedicated proposal module
   Prefer a focused module such as:

`src/services/routineProposal.js`

or equivalent.

Keep proposal logic isolated from UI rendering and persistence.

Suggested responsibilities:

* proposal constants/types
* validation
* normalization
* deterministic application to draft data
* proposal result/error helpers

Do not bury proposal logic inside `App.jsx` unless architecture makes that unavoidable.

3. Define proposal versioning
   Include an explicit proposal format version.

Example:

```js
{
  version: 1,
  ...
}
```

Validation must reject unsupported versions cleanly.

This creates a stable contract for future AI integration and migrations.

4. Support proposal intent explicitly
   At minimum support:

```text
create_routine
modify_routine
```

Do not add speculative program-generation modes unless required by existing architecture.

For `create_routine`, proposal should be able to define:

* routine name
* exercise sequence
* exercise configuration
* superset grouping

For `modify_routine`, proposal should identify:

* target program
* target routine
* requested changes

5. Prefer structured operations for modifications
   Do not represent routine modification as “replace this entire opaque blob”.

Prefer deterministic operations.

Suggested operation types:

```text
add_exercise
remove_exercise
replace_exercise
move_exercise
update_exercise
set_superset
clear_superset
rename_routine
```

Keep the operation set minimal.

Do not add operations unrelated to current routine-builder capabilities.

6. Stable targeting
   Proposal operations must target stable identities.

Use:

* `programId`
* `routineId`
* stable routine-exercise entry identity where available
* stable provider-backed `exerciseId`

Do not target by:

* display name
* array index alone
* exercise text name

If the current routine-exercise shape lacks a stable per-instance ID and duplicate exercises are allowed, inspect existing architecture carefully.

If needed, introduce the smallest backwards-compatible instance identity required to make proposals deterministic.

Do not perform a broad schema rewrite.

7. Represent exercise prescription completely
   A proposal-added or replacement exercise must be able to specify:

```js
{
  exerciseId,
  sets,
  repRange,
  restSeconds,
  displayNameOverride,
  note
}
```

Superset relationships should be represented separately or through deterministic temporary proposal grouping keys.

Do not depend on provider display text as identity.

8. Keep proposal grouping independent from live group IDs
   Do not require future AI/model output to invent valid production `ss-*` IDs.

Prefer proposal-local grouping references such as:

```js
{
  proposalGroupKey: "superset-1"
}
```

Then translate valid proposal groupings into Fitbot-compatible `supersetGroupId` values only when the proposal is applied.

This avoids exposing implementation-specific group ID generation to future AI output.

9. Proposal metadata
   Allow lightweight review metadata such as:

```js
{
  id,
  version,
  proposalType,
  targetProgramId,
  targetRoutineId,
  title,
  summary,
  changes
}
```

Keep metadata optional where appropriate.

Do not add AI-specific fields such as:

* model
* prompt
* tokens
* confidence
* cost

Those belong to the later AI integration layer.

10. Validation boundary
    Implement a pure validation step that checks a proposal without mutating application state.

Validation should detect:

* unsupported version
* unknown proposal type
* missing target identifiers
* invalid operation types
* malformed exercise IDs
* invalid sets
* invalid rep range
* invalid rest seconds
* references to missing routine items
* duplicate/conflicting operations
* invalid reorder targets
* self-superset/grouping errors
* malformed proposal grouping
* attempts to target another program/routine unexpectedly

Return structured validation results.

Example:

```js
{
  valid: false,
  errors: [
    {
      code: "missing_target_exercise",
      path: "changes[2]",
      message: "..."
    }
  ]
}
```

Do not throw raw exceptions for expected validation failures.

11. Validation must not require persistence
    Proposal validation should operate on:

* proposal input
* supplied current program/routine draft/context

It should not query Firestore directly.

This keeps the contract testable and provider-neutral.

12. Apply only to cloned draft data
    Implement proposal application as a pure or near-pure transformation.

Conceptually:

```js
const result = applyRoutineProposal(currentProgram, proposal)
```

Requirements:

* clone source program/routine state
* validate first
* return new draft state
* never mutate input objects
* never write to Firestore
* never write to localStorage
* never alter completed workouts
* never alter active workout state

13. Explicit application boundary
    Applying a valid proposal should produce draft program/routine data only.

Existing `Save Program` remains the persistence commit.

Do not automatically call:

* `setDoc`
* `saveProgram`
* local cache persistence
* workout history writes

This is the most important architectural requirement in the card.

14. Preserve user reviewability
    Structure proposal data so future UI can present a readable review/diff.

Each change should contain enough information to answer:

* what changes?
* which exercise/routine does it affect?
* what is the proposed new value?

Do not implement the future approval UI here.

But avoid proposal shapes that require reconstructing intent from a full replaced routine blob.

15. Deterministic conflict handling
    Reject or normalize ambiguous/conflicting proposals.

Examples:

* remove the same exercise twice
* update an exercise after removing it
* move an exercise that has already been removed
* assign impossible superset relationships
* target a nonexistent routine entry

Prefer validation failure over guessing.

16. Preserve ordering explicitly
    For new routines:

* exercise order must be deterministic

For modification:

* move operations must produce deterministic order

Do not depend on object iteration order.

17. Preserve superset semantics
    When applying a proposal:

* generate valid shared `supersetGroupId` values
* preserve valid grouping
* clean orphaned groups
* do not leave single-member superset groups
* preserve current compatibility with workout snapshots

Current Fitbot superset semantics use shared group IDs and cleanup of orphaned groups.

18. Preserve routine snapshot compatibility
    Proposal application must produce routine data fully compatible with existing workout start behavior.

No new workout-specific fields should be required.

After user save, workouts should continue to snapshot:

* stable exercise ID
* effective name
* sets
* rep range
* rest
* superset group

19. Backward compatibility
    Do not make existing routines require proposal metadata.

Proposal support must be additive.

Existing programs should continue to:

* load
* edit manually
* save
* start workouts

without any proposal involvement.

20. Error handling
    Proposal validation/application must fail safely.

On failure:

* return structured errors
* leave original draft unchanged
* do not partially apply operations
* do not persist anything

Avoid partial mutation.

21. Security boundary
    Although this card does not implement AI or backend calls, design the contract assuming future model output is **untrusted input**.

Do not trust:

* IDs
* operation names
* numeric values
* grouping references
* ordering data

Everything must pass validation before application.

Do not weaken Firestore security rules.

TEST REQUIREMENTS:

Add focused automated tests.

At minimum cover:

A. Create routine proposal

* valid proposal creates a correct draft routine
* exercise order preserved
* no persistence side effects

B. Modify routine

* update sets
* update rep range
* update rest
* update display name
* update note

C. Add exercise

* stable exercise ID preserved
* inserted at deterministic position

D. Remove exercise

* intended routine item removed
* unrelated exercises unchanged

E. Replace exercise

* target entry receives new `exerciseId`
* prescription behavior matches defined semantics

F. Reorder

* deterministic final order
* configuration remains attached to correct items

G. Superset creation

* proposal-local grouping converts to valid shared `supersetGroupId`

H. Superset removal

* grouping removed cleanly
* orphaned groups normalized

I. Invalid proposal
Test rejection for:

* unsupported version
* invalid operation
* missing target routine
* missing target exercise entry
* invalid sets/reps/rest
* conflicting operations
* invalid superset grouping

J. Mutation safety

* input program object unchanged
* completed workout history untouched
* active workout untouched

K. Reviewability

* proposal operations retain enough before/after structure for future review

L. Save boundary

* proposal application alone causes zero Firestore/localStorage writes

MANUAL VALIDATION FLOW:

1. Load an existing program/routine.
2. Construct a local test proposal that:

   * updates one exercise
   * adds one exercise
   * reorders one exercise
   * creates a superset
3. Validate proposal.
4. Confirm structured success result.
5. Apply proposal to a cloned draft.
6. Confirm routine draft reflects intended changes.
7. Confirm original program remains unchanged.
8. Confirm no Firestore/localStorage write occurred.
9. Reject/discard the draft and confirm live state remains untouched.
10. Repeat with malformed proposal and confirm:

    * structured validation errors
    * no partial application
11. Save an approved transformed draft through the existing Save Program flow.
12. Reload.
13. Confirm resulting routine persists normally.
14. Start a workout and confirm snapshot compatibility.

OUT OF SCOPE:
Do not implement:

* OpenAI/GPT API calls
* chat UI
* coach UI
* model prompts
* model selection
* server functions
* token/cost accounting
* AI-generated recommendations
* approval/review UI
* automatic proposal application
* proactive coaching
* background execution
* Firestore schema redesign
* new workout features

SUCCESS CRITERIA:
This card is complete when:

* Fitbot has a versioned structured routine proposal format
* new routine creation can be represented
* existing routine changes can be represented
* proposals validate deterministically
* invalid proposals are rejected safely
* valid proposals apply only to cloned/draft state
* no proposal can silently persist or mutate live program data
* stable exercise identity and ordering are preserved
* superset grouping maps safely into existing `supersetGroupId` semantics
* resulting routine data remains compatible with workout snapshots
* no AI integration has been implemented prematurely

DELIVERABLE REPORT:
At completion, report:

* files changed
* proposal version/schema chosen
* supported operation types
* stable targeting strategy
* whether routine-item identity required any change
* superset proposal/group translation strategy
* validation/error shape
* application API
* tests added
* confirmation that proposal application causes no persistence side effects
* any constraints intentionally deferred to the later AI integration sequence
