
# Codex Implementation Brief — Define Safe Whole-Program Proposal Contract

## PROJECT

Fitbot

## CARD

**Title:** Define provider-neutral whole-program proposal contract

## PHASE

Program-Level Rob Coaching

## PRIORITY

High

## WHY THIS CARD EXISTS

Fitbot already has safe routine-level Rob infrastructure:

- Rob can review routines and programs;
- Rob can generate structured routine proposals;
- exercises resolve through Fitbot's provider boundary;
- proposals are validated before use;
- users preview and explicitly approve proposals;
- approved changes go to drafts only;
- Save Program remains the persistence boundary.

Keep all of that.

The missing architectural layer is a **whole-program proposal model**.

Rob currently cannot safely say:

> “I recommend changing Upper A, Upper B and Lower A together.”

Nor can he safely propose:

> “Here is a complete four-day program.”

without reducing the work to separate routine-level proposals.

This card introduces that domain contract.

It does **not** add the final Rob program-generation UI yet.

---

# ELI5 VERSION

Right now Rob understands:

> “Here is one routine. I want to change it.”

We need Fitbot to also understand:

> “Here is an entire program made up of four routines.”

and:

> “Here are coordinated changes across several routines.”

This card teaches **Fitbot**, not Rob, how to safely represent and validate those ideas.

No fancy UI yet.

No program-generation conversation yet.

No automatic program changes.

We are building the **safe container** that future Rob program recommendations must fit inside.

Think:

```text
CURRENT

Rob
↓
one routine proposal
↓
Fitbot validates it


AFTER THIS CARD

Rob
↓
whole program proposal
↓
Fitbot validates the entire thing
```

If one part of a four-routine proposal is invalid, **none of it applies**.

---

# 1. Product/navigation rule for Rob

Rob must have a clear primary home in the application's **Rob area/menu**.

The intended long-term Rob home should contain primary actions such as:

```text
Ask Rob a question

Ask Rob to review my program

Ask Rob to build me a program
```

Conceptually:

```text
ROB

What would you like Rob to help with?

[ Ask a question ]

[ Review my program ]
  → choose program
  → review
  → later: proposed program changes

[ Build me a program ]
  → short coaching conversation
  → whole-program proposal
  → preview / approval
```

This is an important product rule for future cards.

Do not make users discover core Rob capabilities by hunting through:

```text
program builder
routine editor
workout tracker
settings
```

Rob should be a coherent coaching destination.

---

# 2. Contextual Rob shortcuts are allowed later

Having a primary Rob home does **not** mean Rob must be isolated from the rest of Fitbot forever.

As the product matures, contextual shortcuts may be appropriate.

Examples might eventually include:

```text
Program builder:
[Ask Rob to review this program]

Workout:
[Ask Rob about this exercise]

Progress insight:
[Review this with Rob]
```

However, those should be **shortcuts into Rob workflows**, not separate duplicated Rob implementations.

The rule is:

```text
Rob has one home
+
Fitbot may later offer contextual doors into that home
```

Do not create multiple unrelated AI surfaces with different logic or state.

---

# 3. Scope of this card

Introduce a provider-neutral program proposal contract supporting:

```text
create_program
modify_program
```

The implementation must remain pure domain logic.

Do not connect this card directly to:

- Rob AI calls;
- program-generation UI;
- approval UI;
- Firebase;
- Firestore;
- localStorage;
- scheduling;
- active-program state.

This card establishes the safe domain boundary first.

The Rob navigation rules above guide later cards but should not cause UI work in this card.

---

# 4. New module

Introduce:

```text
src/services/programProposal.js
```

Suggested exports:

```js
PROGRAM_PROPOSAL_VERSION
PROGRAM_PROPOSAL_TYPES

validateProgramProposal()
applyProgramProposal()
```

Optionally expose narrowly useful helpers where appropriate.

Keep this module independent of React and persistence.

---

# 5. Proposal types

Define:

```js
PROGRAM_PROPOSAL_TYPES = {
  CREATE: "create_program",
  MODIFY: "modify_program"
}
```

Version:

```js
PROGRAM_PROPOSAL_VERSION = 1
```

Reject unknown versions and proposal types.

---

# 6. `create_program`

Purpose:

> Create one complete new Fitbot program containing multiple routines.

Conceptual normalized proposal:

```js
{
  id: "proposal-*",
  version: 1,
  proposalType: "create_program",

  title: "4-day hypertrophy program",
  summary: "Four balanced sessions with additional shoulder and arm emphasis.",

  program: {
    id: "program-*",
    name: "4-Day Hypertrophy",

    days: [
      {
        id: "routine-*",
        name: "Upper A",

        exercises: [
          {
            routineExerciseId: "ri-*",
            exerciseId: "wger-*",
            sets: 3,
            repRange: "6-10",
            restSeconds: 120,
            displayNameOverride: null,
            note: null,
            supersetGroupId: null
          }
        ]
      }
    ]
  }
}
```

Fitbot-generated IDs are expected by the time the executable proposal reaches this contract.

The AI layer added later must never supply trusted executable IDs directly.

---

# 7. `modify_program`

Purpose:

> Apply coordinated changes across multiple existing routines in one program.

Conceptual shape:

```js
{
  id: "proposal-*",
  version: 1,
  proposalType: "modify_program",

  targetProgramId: "program-1",

  title: "Adjust upper-body progression",
  summary: "Change pressing and shoulder prescriptions across multiple sessions.",

  routineChanges: [
    {
      targetRoutineId: "upper-a",
      changes: [
        {
          type: "update_exercise",
          targetRoutineExerciseId: "row-1",
          updates: {
            repRange: "6-10"
          }
        }
      ]
    },

    {
      targetRoutineId: "upper-b",
      changes: [
        {
          type: "update_exercise",
          targetRoutineExerciseId: "row-7",
          updates: {
            sets: 4
          }
        }
      ]
    }
  ]
}
```

---

# 8. Reuse existing routine operation vocabulary

Do not invent a second set of mutation operations.

Reuse the existing routine proposal semantics:

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

Where practical, reuse existing routine validation/application helpers internally.

The program layer should coordinate routine proposals, not duplicate their logic.

---

# 9. Atomicity

This is essential.

A program proposal is applied as a single logical transaction.

Example:

```text
Upper A changes: valid
Upper B changes: valid
Lower A changes: invalid
Lower B changes: valid
```

Expected:

```text
entire program proposal fails
```

Not:

```text
Upper A applied
Upper B applied
Lower A failed
Lower B applied
```

No partial results.

---

# 10. Validation — common fields

Validate:

- object shape;
- supported version;
- supported proposal type;
- proposal ID;
- readable title;
- readable summary;
- no unsupported executable fields;
- proposal size limits.

Return structured validation errors.

Use existing Fitbot error style where appropriate:

```js
{
  valid: false,
  errors: [
    {
      code,
      path,
      message
    }
  ]
}
```

Never throw for ordinary invalid proposal content unless current domain conventions require it.

---

# 11. `create_program` validation

Validate at minimum:

- program exists in proposal;
- valid program ID;
- non-empty program name;
- supported routine collection;
- routine count within limits;
- unique routine IDs;
- routine names valid;
- exercise counts within limits;
- unique `routineExerciseId`s;
- valid provider-backed `exerciseId`s;
- valid sets;
- valid rep ranges;
- valid rest;
- supported notes/display names;
- valid superset structure;
- no orphaned superset members;
- no proposal-only transient fields remain in executable result.

Use current Fitbot normalization rules where possible.

---

# 12. Creation limits

Use conservative bounded limits.

Suggested starting point:

```text
maximum routines per generated program: 6
maximum exercises per routine: 12
maximum total exercises: 50
```

Adjust if existing Fitbot limits already establish better values.

Reject proposals exceeding limits.

Do not silently truncate.

---

# 13. Program ID collisions

For `create_program`, reject a proposed program ID already present in existing program definitions/drafts.

Do not overwrite an existing program.

Creation is additive.

---

# 14. `modify_program` validation

Validate:

- target program exists;
- target program ID matches;
- at least one routine change exists;
- routine-change count bounded;
- every target routine exists;
- no duplicate routine-change entries unless explicitly supported;
- each routine's changes pass existing routine proposal validation semantics;
- no conflicting cross-routine operations;
- no archived/deleted target unless current Fitbot rules explicitly permit it.

---

# 15. Routine validation reuse

For each `routineChanges` entry, construct an internal routine-modification proposal compatible with:

```text
validateRoutineProposal()
```

Conceptually:

```js
{
  version: ROUTINE_PROPOSAL_VERSION,
  proposalType: "modify_routine",
  targetProgramId,
  targetRoutineId,
  changes
}
```

Reuse existing validator authority.

Do not manually reproduce all routine rules inside `programProposal.js`.

---

# 16. Whole-program validation ordering

Validation should occur before any application.

Conceptually:

```text
validate program proposal shape
↓
validate target program
↓
validate every routine proposal
↓
ensure cross-routine constraints
↓
produce normalized proposal
```

Only after every component validates may application begin.

---

# 17. `applyProgramProposal()`

Signature may resemble:

```js
applyProgramProposal(programs, proposal)
```

or another shape consistent with existing domain modules.

Return something conceptually like:

```js
{
  applied: true,
  programs: nextPrograms,
  programId,
  review
}
```

Failure:

```js
{
  applied: false,
  programs: null,
  errors
}
```

Follow existing proposal conventions where possible.

---

# 18. Pure application

`applyProgramProposal()` must:

- validate first;
- never mutate source objects;
- return a new graph;
- perform no persistence;
- perform no React state changes;
- perform no network calls.

---

# 19. `create_program` application

Successful create should:

- append exactly one new program;
- preserve existing programs unchanged;
- preserve active-program state outside this module;
- preserve schedule outside this module;
- preserve completed workouts;
- preserve health data;
- preserve active workout.

The new program should **not** automatically become active.

---

# 20. `modify_program` application

Successful modification should:

- change only the targeted program;
- apply all validated routine changes;
- preserve unaffected routines;
- preserve unrelated programs;
- preserve program identity;
- preserve historical workouts;
- preserve active workout state;
- preserve scheduling.

Application must remain atomic.

---

# 21. Program-level review metadata

Return deterministic review information suitable for a future preview.

For example:

```js
{
  title,
  summary,
  routines: [
    {
      routineId,
      routineName,
      changes: [...]
    }
  ]
}
```

This is domain data.

Do not generate user-facing AI prose here.

---

# 22. Create-program review metadata

For program creation, return enough normalized data for future UI to display:

```text
program name
routine names
exercise order
sets
rep ranges
rest
superset membership
notes
```

Do not calculate muscle-volume science metrics in this card.

---

# 23. Superset handling

Reuse the existing proposal-local superset translation semantics where possible.

For a generated program, each routine may contain proposal-local grouping keys before normalization.

Ensure:

- group keys are routine-local;
- groups contain valid members;
- normalized executable state uses Fitbot superset IDs;
- no proposal-group key leaks into persisted program state.

If existing routine proposal helpers already solve this, reuse them.

---

# 24. Stable identity

Keep identity ownership explicit.

Future flow:

```text
Rob:
exerciseRef / names / prescriptions

Fitbot resolution layer:
provider exercise IDs

Fitbot proposal materializer:
program IDs
routine IDs
routineExerciseIds

programProposal:
validates executable identity
```

Do not permit AI-origin IDs to bypass those boundaries.

---

# 25. No exercise resolution in this module

`programProposal.js` receives already resolved executable exercises.

Do not import:

```text
exerciseProvider
searchExercises
resolveProposedExercise
Rob
Firebase
```

Exercise resolution belongs upstream.

---

# 26. No persistence

Add a source-level regression test ensuring the module does not depend on:

```text
firebase
firestore
localStorage
savePrograms
persistProgramDrafts
setDoc
```

---

# 27. Tests — create program

Add comprehensive pure tests.

At minimum:

### Valid 3-day program

Confirm:

- validation succeeds;
- application creates one program;
- ordering preserved;
- source graph untouched.

### Valid 4-day program

Confirm multiple routines and exercises normalize correctly.

### Valid 5-day program

Confirm supported size.

### Duplicate program ID

Reject.

### Duplicate routine IDs

Reject.

### Duplicate routineExerciseIds

Reject.

### Invalid provider exercise ID

Reject.

### Invalid prescription

Cover:

```text
zero sets
invalid rep range
invalid rest
```

### Oversized program

Reject rather than truncate.

### Invalid superset

Reject atomically.

---

# 28. Tests — modify program

Cover:

### Single routine change

Program-level proposal containing one routine change works.

### Multiple routine changes

Changes across Upper A and Upper B both apply atomically.

### Three or more routines

Confirm orchestration remains deterministic.

### Missing target program

Reject.

### Missing target routine

Reject entire proposal.

### One invalid routine among valid routines

Reject entire proposal.

### Conflicting operations

Reject.

### Unaffected routines

Remain byte-for-byte/domain-equivalent where appropriate.

### Unrelated programs

Remain unchanged.

---

# 29. Mutation safety tests

For both proposal types, verify source state remains unchanged after:

```text
successful validation
failed validation
successful application
failed application
```

Application returns a new graph.

---

# 30. Non-domain state protection

Use representative source fixtures containing:

```text
completedWorkouts
activeWorkout
other program metadata
```

Confirm program proposal application does not mutate or rewrite them unexpectedly.

---

# 31. Do not wire Rob yet

This card must **not** modify:

```text
functions/src/rob/*
robProposalClient
Rob prompt schemas
Create with Rob UI
program review UI
proposal approval UI
```

unless a minimal compile-safe shared export is genuinely required.

There should be no AI call producing `create_program` yet.

---

# 32. Do not change current UI

This is important.

Do not add:

```text
Create Program with Rob button
new modal
new program wizard
new builder action
new navigation
```

in this card.

The user has explicitly identified UI churn as a risk.

Build the domain foundation invisibly first.

When user-facing work begins in subsequent cards, the **Rob area is the primary home for Rob workflows**.

Do not put the main Create Program with Rob workflow into the program builder.

---

# 33. Preserve current functionality

Do not remove:

```text
Create Routine with Rob
Routine Review
Program Review
routine proposals
exercise ambiguity resolution
manual program builder
```

They may later be repositioned, but not as part of this card.

Do not throw away working routine-level infrastructure.

---

# 34. Documentation

Update:

```text
docs/01-product.md
docs/02-technical.md
docs/03-current-state.md
```

Be precise.

### Implemented

State that Fitbot now has a pure provider-neutral program proposal domain contract supporting:

```text
create_program
modify_program
```

### Product direction

Document that:

```text
Rob is the primary home for AI/coaching workflows.

Core Rob actions are intended to include:
- Ask Rob a question
- Ask Rob to review a program
- Ask Rob to build a program

Contextual shortcuts may later enter these workflows from elsewhere in Fitbot,
but should reuse the same Rob capabilities rather than creating parallel AI surfaces.
```

### Not yet implemented

Clearly state that:

```text
Rob does not yet generate whole programs
program proposal approval UI is not yet wired
program creation conversation is not yet implemented
progression analytics are not yet implemented
```

Avoid implying the feature is user-facing before it is.

---

# 35. Completion criteria

This card is complete when:

1. `programProposal.js` exists as a pure domain module.
2. Versioned `create_program` proposals validate.
3. Versioned `modify_program` proposals validate.
4. Routine modification semantics reuse existing routine proposal rules.
5. Multi-routine changes are atomic.
6. Program creation is atomic.
7. Program creation never replaces an existing program.
8. Existing programs remain unchanged during creation.
9. Program modification changes only its target.
10. Invalid sub-routine changes invalidate the whole proposal.
11. Existing workout/history/planning state is not mutated.
12. No persistence occurs.
13. No AI provider dependencies exist.
14. No exercise provider dependencies exist.
15. No UI is introduced.
16. Existing routine proposal tests continue passing.
17. New program proposal tests comprehensively cover happy and failure paths.
18. Documentation clearly distinguishes domain support from future user-facing Rob functionality.
19. Documentation establishes Rob as the canonical home for AI/coaching workflows.
20. Lint passes.
21. Full test suite passes.
22. Production build passes.

## Suggested commit

```text
feat: add safe whole-program proposal contract
```

---

# WHAT COMES NEXT — NOT PART OF THIS CARD

The next sequence should be:

```text
1. Safe whole-program proposal contract   ← THIS CARD

2. Rob Home / Program Designer conversation
   - all primary Rob activities live under Rob
   - Ask a question
   - Review my program
   - Build me a program

3. Build Program conversation
   - Rob asks only missing questions
   - goal
   - days/week
   - duration
   - priorities
   - constraints

4. Generate create_program candidate
   - whole program
   - all routines together
   - exerciseRef only from AI

5. Resolve exercises
   - automatic where safe
   - ambiguous → user chooses
   - unresolved → manual library search/replacement
   - proposal remains intact while individual exercise mappings are fixed

6. Whole-program preview + approval
   - one coherent preview
   - one approval
   - unsaved program draft
   - Save Program persists

7. Program Review → modify_program
   - Rob Home → Review my program
   - choose program
   - existing review capability
   - actionable proposal across routines

8. Progression analytics / longitudinal coaching
```

Do not implement steps 2–8 early.

---

# FUTURE ROB HOME

The intended primary experience is:

```text
ROB

What would you like help with?

┌─────────────────────────────┐
│ Ask Rob a question          │
│ Training advice & questions │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Review my program           │
│ Analyse an existing program │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Build me a program          │
│ Design a new training plan  │
└─────────────────────────────┘
```

### Ask Rob a question

Freeform coaching.

Examples:

```text
Should I change my rep range?

What's a good substitute for this exercise?

Why might my curls have stalled?
```

### Review my program

Flow:

```text
Review my program
↓
choose program
↓
Rob analyses whole program
↓
findings
↓
eventually:
Review proposed changes
↓
modify_program
```

### Build me a program

Flow:

```text
Build me a program
↓
Rob asks a few useful questions
↓
complete create_program candidate
↓
exercise resolution
↓
program preview
↓
approve
↓
editable unsaved program
↓
Save Program
```

---

# CONTEXTUAL SHORTCUT PRINCIPLE

Future Fitbot screens may provide shortcuts such as:

```text
Ask Rob about this

Review this program with Rob

Discuss this progression with Rob
```

Those shortcuts should route into the same Rob capability/state model.

Do not build:

```text
Rob-in-the-builder implementation
+
Rob-in-the-workout implementation
+
Rob-page implementation
```

as independent systems.

Conceptually:

```text
UI shortcut
↓
Rob home/workflow
↓
shared Rob services
```

Rob has a home even when Fitbot provides faster ways of getting there.

---

# PRODUCT NORTH STAR

The user should eventually think:

> “I need coaching → go to Rob.”

not:

> “Which Fitbot screen has the AI button I need?”

The first major experience is:

```text
ROB
↓
Build me a program
↓
Rob asks a few questions
↓
Rob designs complete program
↓
Fitbot safely validates it
↓
user approves it
```

The second is:

```text
ROB
↓
Review my program
↓
choose existing program
↓
Rob analyses whole program and training context
↓
later proposes coordinated changes
```

And as Fitbot matures:

```text
Fitbot detects something useful
↓
contextual shortcut:
Ask Rob about this
↓
same Rob coaching system
```

That preserves a coherent product while still leaving room for increasingly intelligent shortcuts later.