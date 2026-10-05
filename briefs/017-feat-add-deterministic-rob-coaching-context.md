## Codex Implementation Brief — Build deterministic Rob coaching context

### Objective

Create a pure, deterministic context-building layer that converts existing Fitbot state into a compact provider-neutral payload for future Rob coaching features.

This card should make later AI calls safer, cheaper and more predictable by ensuring Rob receives only the training data required for the requested task.

The context builder must support three initial request modes:

- general training advice;
- routine review;
- program review.

It must expose stable identifiers, normalized prescriptions, relevant training profile information and bounded recent workout history where appropriate.

It must not call the AI provider, write to Firebase, mutate application state, introduce Rob persona/prompting, or implement review/chat UI.

---

# Current architecture to preserve

Fitbot already has:

```text
src/services/aiClient.js
functions/src/ai/aiService.js
functions/src/ai/providers/openRouterProvider.js
```

The deployed `aiGenerate` callable currently accepts only:

```js
{
  messages
}
```

and remains the sole browser-accessible AI transport boundary.

Do not modify that transport contract unless strictly necessary for testability. This card is about **constructing context**, not sending it.

Relevant existing domain state includes:

```text
programs
selected/current program
selected routine
completed workout history
current user profile
```

Programs/routines use stable:

```text
program.id
routine.id
routineExerciseId
exerciseId
```

Routine exercises include:

```js
{
  routineExerciseId,
  exerciseId,
  sets,
  repRange,
  restSeconds,
  displayNameOverride,
  note,
  supersetGroupId
}
```

Completed workout history is append-only and already loaded into application state from:

```text
users/{uid}/completedWorkouts/{workoutId}
```

Workout snapshots include stable exercise IDs, snapped exercise names, prescriptions and performed set values.

Do not fetch Firestore directly from the context builder.

---

# Important profile constraint

The current source-of-truth user profile document contains a manually documented training profile:

```text
Goals:
- Shoulders
- Arms
- Hypertrophy

Equipment:
- Dumbbells
- Barbell
- Bench
- High pulley

Constraints:
- L3-L5 nerve issues
- No leg press

Training style:
- 4 day rotation
- 60 minute workouts
- Home gym
```

However, that training profile is currently **documentation**, not persisted editable application state.

Do not silently scrape Markdown documentation at runtime.

Do not infer profile data from unrelated state.

For this card, introduce a small explicit training-profile data source/module suitable for context-building, using only currently documented training information.

Keep it separate from Firebase identity/profile data.

Do not include:

```text
email
photoURL
providerId
Firebase uid
```

in Rob coaching context.

Do not add a user-editable profile/settings UI yet.

---

# Proposed structure

Add a dedicated Rob context module, for example:

```text
src/
  services/
    rob/
      robContext.js
      robTrainingProfile.js
```

or equivalent:

```text
src/services/robContext.js
src/data/robTrainingProfile.js
```

Prefer separation between:

- static/current training profile data;
- context-building logic.

Do not place context construction in `App.jsx`.

Do not put it in `aiClient.js`.

Do not put it in Functions.

The context builder should be pure client/domain logic.

---

# 1. Define supported request types

Create an explicit request-type enum/constant set.

Suggested values:

```js
export const ROB_CONTEXT_TYPES = {
  ADVICE: "advice",
  ROUTINE_REVIEW: "routine_review",
  PROGRAM_REVIEW: "program_review",
};
```

Reject unsupported types.

Do not use free-form strings throughout calling code.

---

# 2. Define stable output schema

Return one provider-neutral context object with predictable top-level keys.

Suggested shape:

```js
{
  version: 1,
  requestType: "advice" | "routine_review" | "program_review",

  target: {
    programId: "...",
    routineId: "..." | null
  },

  profile: {
    goals: [...],
    equipment: [...],
    constraints: [...],
    trainingStyle: {
      rotation: "...",
      targetSessionMinutes: number | null,
      setting: "..."
    }
  },

  program: {
    id: "...",
    name: "...",
    routines: [...]
  } | null,

  history: {
    workouts: [...]
  } | null
}
```

Keep field names provider-neutral and training-domain-focused.

Do not include provider/model metadata here.

Do not include prompt instructions here.

Do not include Rob persona text here.

---

# 3. Deterministic serialization rules

Equivalent application state must produce equivalent context output.

Avoid:

- `Date.now()`;
- random IDs;
- current locale-dependent formatting;
- unstable object iteration;
- network lookups;
- Firestore timestamps generated during build;
- data ordering derived from asynchronous completion.

Preserve meaningful domain ordering:

- routines in stored program order;
- exercises in routine order;
- workout history newest-first or oldest-first consistently.

Document the chosen history order.

Use canonical `null` for absent optional fields rather than inconsistent mixtures of:

```text
undefined
missing property
empty string
```

where practical.

---

# 4. Training profile source

Introduce a small explicit profile object reflecting current documented Fitbot training information.

Suggested shape:

```js
export const robTrainingProfile = {
  goals: [
    "Shoulders",
    "Arms",
    "Hypertrophy"
  ],

  equipment: [
    "Dumbbells",
    "Barbell",
    "Bench",
    "High pulley"
  ],

  constraints: [
    "L3-L5 nerve issues",
    "No leg press"
  ],

  trainingStyle: {
    rotation: "4 day rotation",
    targetSessionMinutes: 60,
    setting: "Home gym"
  }
};
```

Use wording consistent with current source docs.

Do not add undocumented items.

Do not infer extra medical constraints.

Do not add age unless there is a clear coaching requirement for this card; it is not necessary for the initial context boundary.

Do not include identity/profile fields unrelated to training.

---

# 5. Program serialization

Create a pure serializer for a program.

Suggested output:

```js
{
  id,
  name,
  description: string | null,
  routines: [...]
}
```

Archived routines should generally be excluded from active coaching context unless explicitly required by current program semantics.

Preserve routine order.

If current program shape may expose either:

```text
days
```

or:

```text
routines
```

normalize via existing program helpers where appropriate rather than duplicating fragile normalization logic.

Do not mutate the input program.

---

# 6. Routine serialization

Serialize each routine to:

```js
{
  id,
  name,
  exercises: [...]
}
```

Do not include editor-only transient state.

Do not include archived/deleted state unless required to explain active program composition.

For program review, include all active routines.

For routine review, include the target routine and enough parent program identity to anchor it.

For advice, include program/routine only when supplied by the caller.

---

# 7. Exercise serialization

Preserve stable targeting identity.

Each serialized routine exercise should include:

```js
{
  routineExerciseId,
  exerciseId,
  name,
  sets,
  repRange,
  restSeconds,
  note,
  supersetGroupId
}
```

Use the effective display name where available:

```text
displayNameOverride || known exercise name
```

However, do not perform network rehydration from wger inside the context builder.

If only `displayNameOverride` and `exerciseId` are available, preserve what is known.

If a display name cannot be resolved from current application state, use:

```text
name: null
```

rather than inventing one.

Do not drop:

```text
routineExerciseId
```

because later proposal cards rely on that stable identity.

Do not serialize images, license metadata, instructions, aliases or full exercise-provider payloads. They add prompt cost without helping the current coaching tasks.

---

# 8. Superset representation

Keep superset representation compact.

Preserve:

```text
supersetGroupId
```

on each exercise.

Do not construct additional duplicated grouping trees unless genuinely necessary.

Stable group IDs are sufficient for later coaching logic to understand paired exercises.

---

# 9. Advice context behaviour

For:

```text
requestType: "advice"
```

support intentionally flexible context.

The caller may provide:

```text
program
selectedRoutineId
completedWorkouts
```

or none of them.

Advice context should include:

- training profile;
- current program if supplied;
- selected routine if supplied/valid;
- bounded relevant history if supplied.

Do not throw simply because no program exists.

This mode should support future questions such as:

```text
"Is this too much shoulder work?"
"What would you change?"
"How should I structure a 45-minute workout?"
```

without requiring program-review semantics.

---

# 10. Routine review context behaviour

For:

```text
requestType: "routine_review"
```

require:

```text
program
routineId
```

The routine ID must resolve within the supplied current program.

Return:

```text
target.programId
target.routineId
```

Include the target routine in full.

You may also include compact sibling routine summaries if clearly useful for interpreting weekly/program balance, but avoid duplicating the entire program unless necessary.

Preferred initial scope:

- full target routine;
- compact parent program identity;
- bounded recent history relevant to exercises in that routine.

Do not include unrelated routines in full by default.

---

# 11. Program review context behaviour

For:

```text
requestType: "program_review"
```

require:

```text
program
```

Include:

- program identity;
- all active routines;
- full compact exercise prescriptions;
- bounded recent history relevant to that program.

`routineId` should be:

```text
null
```

for program review.

---

# 12. History inclusion rules

History must be explicitly bounded.

Do not dump all completed workouts.

Introduce clear constants, for example:

```js
ROB_HISTORY_LIMIT = 8
ROB_HISTORY_EXERCISE_SET_LIMIT = ...
```

A reasonable initial cap is:

```text
6–10 recent meaningful completed workouts
```

Choose one fixed limit and test it.

The limit should be small enough to control AI cost while still showing recent progression patterns.

Prefer:

```text
most recent first
```

because source history is already loaded in that order.

Document this.

---

# 13. Relevant history filtering

Do not include every recent workout blindly for every context mode.

For routine review:

- prefer completed workouts matching the routine or containing exercises present in the target routine.

For program review:

- prefer workouts associated with routines in the current program where identifiers exist.

For advice:

- include recent history supplied by caller, optionally filtered by selected routine/program where applicable.

Where historical identifiers are incomplete or legacy data lacks association, fall back conservatively to recent meaningful workout snapshots rather than failing.

Keep filtering deterministic.

---

# 14. Meaningful workout filtering

Reuse existing semantics where practical.

Blank/non-meaningful workouts should not be included.

A workout is meaningful if it contains logged exercise effort consistent with existing history logic.

Do not invent new effort semantics that conflict with the app.

If an existing helper already determines meaningful effort, reuse or extract it rather than duplicating logic.

---

# 15. History serialization

Do not serialize full completed workout documents.

Create a compact shape.

Suggested:

```js
{
  id,
  completedAt,
  routineId,
  routineName,
  exercises: [
    {
      exerciseId,
      exerciseName,
      originalExerciseId,
      sets: [
        {
          weight,
          reps
        }
      ]
    }
  ]
}
```

Only include fields useful for coaching.

Exclude:

```text
syncedAt
schedule slot metadata unless relevant
Firebase timestamps unrelated to completion
UI state
timer state
completed flags already implied by history
```

Preserve original/swap identity only if it helps interpret performed exercise history.

---

# 16. Date normalization

Normalize `completedAt` into a stable serializable string where possible.

Support the actual shapes already encountered in application state, such as:

```text
ISO string
Date
Firestore Timestamp-like object
```

Output should use a consistent representation:

```text
ISO 8601 string
```

or:

```text
null
```

if unavailable.

Do not use locale-formatted dates.

Do not generate current timestamps.

---

# 17. Set value normalization

Completed workout set values may be stored as strings.

Preserve user-entered values consistently, or normalize them carefully without changing meaning.

For example:

```js
{
  weight: "22.5",
  reps: "10"
}
```

is acceptable.

Do not convert missing values to zero.

Use:

```text
null
```

for absent values where helpful.

Do not infer units if they are not explicitly stored.

---

# 18. Context-size controls

Introduce hard caps independent of AI provider limits.

At minimum bound:

```text
number of routines
number of exercises per routine
number of history workouts
number of exercises per history workout
number of sets per exercise
note length
program/routine name length
```

Normal Fitbot data should remain unaffected.

Extreme or malformed state must not create arbitrarily large context objects.

Prefer deterministic truncation with explicit constants.

For text fields such as notes, truncate to a fixed safe maximum rather than sending huge arbitrary text.

Do not silently truncate stable IDs.

If IDs exceed expected constraints, reject or omit invalid records.

---

# 19. Validation behaviour

Provide clear validation for required targets.

Suggested error codes:

```text
rob_context_invalid_request_type
rob_context_missing_program
rob_context_missing_routine
rob_context_invalid_program
```

A small `RobContextError` class is appropriate if useful.

Do not reuse `AiClientError` because this layer is not an AI transport error.

Do not show these errors in UI yet.

Later cards can translate them into user-facing messages.

---

# 20. Missing optional data

Missing optional data must not make output unstable.

Examples:

Missing program description:

```js
description: null
```

Missing exercise name:

```js
name: null
```

Missing note:

```js
note: null
```

Missing history:

```js
history: {
  workouts: []
}
```

or consistently:

```js
history: null
```

Choose one schema and use it everywhere.

Preferred:

```js
history: {
  workouts: []
}
```

because callers can consume it without extra branching.

---

# 21. No network activity

The context builder must not import or invoke:

```text
aiClient
exerciseProvider network calls
Firebase
Firestore
Firebase Auth
OpenRouter
fetch
```

All required data must be supplied as function arguments or imported from static local training-profile data.

This should make the builder easy to test with plain objects.

---

# 22. No persistence

The context builder performs no writes.

It must not import:

```text
programStore
workoutHistoryStore
planningStore
healthStore
activeWorkoutStore
backupService
```

Do not add context caching to:

```text
localStorage
Firestore
IndexedDB
```

Context should be generated on demand from current application state.

---

# 23. No AI invocation

Do not call:

```js
requestAiResponse()
```

in this card.

Do not modify `aiGenerate`.

Do not add Rob prompt templates.

Do not build message arrays yet.

The output of this card is domain context, not an LLM request.

---

# 24. Suggested public API

A suitable public entry point is:

```js
buildRobContext({
  requestType,
  program,
  routineId,
  completedWorkouts
})
```

Return:

```js
{
  version,
  requestType,
  target,
  profile,
  program,
  history
}
```

If useful, expose smaller pure helpers only for testing/internal composition.

Avoid exposing a large fragmented API without need.

---

# 25. Example routine-review result

Conceptually:

```js
{
  version: 1,
  requestType: "routine_review",

  target: {
    programId: "program-1",
    routineId: "day-a"
  },

  profile: {
    goals: ["Shoulders", "Arms", "Hypertrophy"],
    equipment: ["Dumbbells", "Barbell", "Bench", "High pulley"],
    constraints: ["L3-L5 nerve issues", "No leg press"],
    trainingStyle: {
      rotation: "4 day rotation",
      targetSessionMinutes: 60,
      setting: "Home gym"
    }
  },

  program: {
    id: "program-1",
    name: "Current Program",
    routines: [
      {
        id: "day-a",
        name: "Day A",
        exercises: [
          {
            routineExerciseId: "ri-day-a-0",
            exerciseId: "wger-123",
            name: "Incline Dumbbell Press",
            sets: 3,
            repRange: "8-12",
            restSeconds: 120,
            note: null,
            supersetGroupId: null
          }
        ]
      }
    ]
  },

  history: {
    workouts: [...]
  }
}
```

This is illustrative only; align exact field names with current code conventions.

---

# 26. Tests

Add comprehensive pure unit tests using `node --test`.

No Firebase emulator should be necessary.

## Schema tests

Verify:

```text
advice
routine_review
program_review
```

produce the expected top-level structure.

---

# 27. Determinism tests

Given identical input objects:

```js
buildRobContext(input)
```

called multiple times should deep-equal exactly.

Also verify source inputs are not mutated.

Use:

```text
structuredClone / deep freeze
```

or equivalent test technique.

---

# 28. Program serialization tests

Cover:

- normal program;
- empty program;
- archived routine exclusion where applicable;
- routine ordering;
- stable IDs;
- optional description;
- malformed optional fields;
- excessive routine/exercise counts bounded deterministically.

---

# 29. Routine serialization tests

Verify:

- `routineExerciseId` preserved;
- `exerciseId` preserved;
- sets preserved;
- rep range preserved;
- rest preserved;
- note normalized;
- superset group preserved;
- display override preferred when available;
- missing name becomes `null`;
- input object unchanged.

---

# 30. Advice context tests

Cover:

```text
profile only
profile + program
profile + selected routine
profile + history
```

Advice must not require a program.

Unsupported request types must fail deterministically.

---

# 31. Routine review validation tests

Cover:

- valid routine;
- missing program;
- missing routine ID;
- unknown routine ID;
- archived/missing routine where applicable.

Unknown targets should fail rather than silently selecting a different routine.

---

# 32. Program review validation tests

Cover:

- valid current program;
- missing program;
- empty routine list;
- large program bounded appropriately.

---

# 33. History tests

Cover:

- newest-first stable ordering;
- bounded count;
- blank workouts excluded;
- relevant routine filtering;
- relevant program filtering;
- fallback for legacy records;
- malformed/partial workout data;
- swapped exercise identity preservation where present;
- set count bounds;
- null/missing completion dates.

---

# 34. Profile privacy test

Explicitly verify generated context does **not** contain:

```text
email
photoURL
providerId
uid
apiKey
OPENROUTER_API_KEY
Firebase auth tokens
```

A recursive key/value inspection test is reasonable.

---

# 35. Side-effect boundary tests

Verify module dependency boundaries where practical.

The context builder should not import:

```text
firebase
aiClient
programStore
workoutHistoryStore
exerciseProvider
```

At minimum, pure unit tests should execute without DOM, Firebase or network mocks.

No test should require credentials.

---

# 36. UX impact

There should be **no visible UI change** from this card.

Do not add:

- Rob button;
- Ask Rob panel;
- review action;
- loading state;
- error banner;
- debug context inspector in production.

If a local development diagnostic is useful, keep it out of normal production UI.

---

# 37. Documentation updates

Update:

```text
docs/02-technical.md
docs/03-current-state.md
```

Document:

- existence of the deterministic Rob context builder;
- supported context types;
- bounded history behaviour;
- stable routine/exercise identity preservation;
- explicit training-profile source;
- no network/persistence side effects;
- no user-facing Rob feature yet.

Update:

```text
docs/04-user-profile.md
```

only if necessary to clarify that the current training profile is now represented as application-side coaching configuration rather than merely documentation.

Do not claim user-editable training profile support exists.

---

# 38. Explicit non-goals

Do not implement:

- Rob persona;
- system prompts;
- LLM messages;
- `requestAiResponse()` integration;
- authenticated AI smoke test;
- Rob chat UI;
- routine review UI;
- program review UI;
- AI-generated recommendations;
- proposal generation;
- `validateRoutineProposal()` integration;
- approval flow;
- whole-program generation;
- user profile editor;
- new health data;
- exercise metadata rehydration;
- new Firestore collections;
- new persistence;
- server-side context building;
- token estimation;
- conversation history.

Those belong to later cards.

---

# 39. Validation commands

Run:

```bash
npm run lint
npm test
npm run build
```

No Functions deployment should be required unless this card unexpectedly changes server code, which it should not.

If no Functions code changes, do not redeploy `aiGenerate`.

---

# Completion criteria

This card is complete when:

1. A dedicated deterministic Rob context builder exists.
2. Advice, routine review and program review request types are explicit and validated.
3. Current documented training goals, equipment, constraints and training style are represented in a dedicated application-side coaching profile source.
4. Firebase identity/profile fields are excluded.
5. Current programs serialize into a compact provider-neutral shape.
6. Routine exercises preserve `routineExerciseId` and `exerciseId`.
7. Prescriptions preserve sets, rep range, rest, note and superset identity.
8. Missing optional values normalize consistently.
9. Recent workout history is compact and hard-bounded.
10. History selection is deterministic and relevant to the request target where possible.
11. Blank/non-meaningful history is excluded.
12. Context generation performs no network calls.
13. Context generation performs no Firebase/localStorage writes.
14. Context generation does not invoke the AI transport.
15. Source application objects are not mutated.
16. Equivalent input yields deep-equal output.
17. Extreme input sizes are bounded.
18. Tests cover advice, routine review, program review, privacy, determinism and history limits.
19. Existing lint, test and build commands pass.
20. Source-of-truth docs reflect the new context boundary without claiming later Rob functionality.

### Suggested commit message

```text
feat: add deterministic Rob coaching context
```