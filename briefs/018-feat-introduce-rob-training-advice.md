## Codex Implementation Brief — Introduce Rob persona and general training advice

### Objective

Deliver the first user-facing **Rob** experience in Fitbot: an authenticated, mobile-first personal-training advice surface where the user can ask training questions and receive concise, practical answers grounded in the existing deterministic Fitbot coaching context.

This card establishes Rob as a product feature rather than exposing the generic AI transport directly.

Rob must:

- answer general strength/hypertrophy/training questions;
- automatically receive relevant current Fitbot context;
- speak with a consistent personal-trainer persona;
- distinguish known Fitbot data from assumptions;
- respond safely when injury/medical issues arise;
- provide clear loading, retry and failure states;
- remain strictly advisory.

Rob must **not** create, modify, apply or save routines/programs in this card.

---

# Current architecture to preserve

The relevant implemented foundation now includes:

```text
src/services/aiClient.js

src/services/rob/
  robContext.js
  robTrainingProfile.js

functions/src/
  index.js
  ai/
    aiService.js
    aiConfig.js
    aiErrors.js
    providers/
      openRouterProvider.js
```

The deployed Firebase Gen 2 callable:

```text
aiGenerate
```

currently provides the provider-neutral authenticated AI transport.

It:

- requires Firebase Authentication;
- uses OpenRouter server-side;
- binds `OPENROUTER_API_KEY`;
- owns model/output/timeout controls;
- normalizes provider failures;
- performs no domain persistence;
- accepts bounded `{ messages }`.

The deterministic Rob context builder supports:

```text
advice
routine_review
program_review
```

This card should use:

```text
advice
```

only.

The context builder preserves stable program/routine/exercise identities, bounded meaningful history and the current explicit coaching profile.

Do not duplicate context-generation logic.

---

# Important architectural decision

Do **not** make the Rob UI construct arbitrary AI `system` messages and send them directly through `aiGenerate`.

Rob’s persona and behavioural instructions must remain server-owned.

Introduce a dedicated authenticated server boundary for advisory Rob requests, for example:

```text
robAdvice
```

Conceptually:

```text
React Rob UI
    ↓
buildRobContext({ requestType: "advice", ... })
    ↓
robAdvice callable
    ↓
server validates question + context
    ↓
server-owned Rob instructions
    ↓
provider-neutral AI service
    ↓
OpenRouter
```

Keep:

```text
aiGenerate
```

as the existing lower-level AI transport foundation.

Do not remove or weaken it as part of this card unless there is a compelling compatibility/security reason.

The new production Rob experience should use the narrower `robAdvice` boundary.

---

# 1. Introduce server-side Rob advice service

Add a dedicated server-side Rob layer, for example:

```text
functions/src/
  rob/
    robAdvice.js
    robPrompt.js
```

Exact naming may adapt to repository conventions.

Responsibilities should be separated:

```text
robPrompt.js
→ Rob persona / behavioural instructions

robAdvice.js
→ validate request
→ compose provider-neutral messages
→ call existing AI service/provider
→ normalize advice result
```

Do not put OpenRouter-specific syntax in Rob modules.

Do not directly instantiate HTTP/OpenRouter calls from Rob code.

Reuse the existing provider abstraction.

---

# 2. Define the Rob persona server-side

Rob should feel like a practical personal trainer rather than a generic chatbot.

The system instruction should establish roughly the following behaviour:

- name: **Rob**;
- role: practical strength/hypertrophy coach;
- concise rather than verbose;
- actionable recommendations;
- explain reasoning where useful;
- use supplied Fitbot data when relevant;
- do not claim to know facts absent from context;
- distinguish observation from suggestion;
- prefer existing user constraints/equipment/goals over generic recommendations;
- avoid unnecessary motivational filler;
- do not pretend a recommendation has changed Fitbot state.

Tone should be friendly, confident and matter-of-fact.

Avoid gimmicky trainer stereotypes.

Rob should not continuously announce that he is an AI.

---

# 3. Medical/injury boundary

Rob is a training coach, not a diagnostic system.

Server instructions must tell Rob:

- do not diagnose injuries or medical conditions;
- do not claim a movement is medically safe because no pain information is available;
- take known training constraints seriously;
- if a question describes significant/new injury symptoms, avoid diagnosing and suggest appropriate professional assessment;
- when context contains a constraint, frame training recommendations around it rather than overriding it;
- acknowledge uncertainty when the available Fitbot context is insufficient.

Do not add speculative medical profile information.

Do not introduce a separate health questionnaire.

Do not attempt clinical triage beyond sensible training-safety language.

---

# 4. Dedicated Rob request contract

The browser should send a narrow request.

Suggested shape:

```js
{
  question: "Should I be doing both incline press and pec fly here?",
  context: {
    ...buildRobContext(...)
  }
}
```

Do not permit the client to send:

```text
systemPrompt
provider
model
maxTokens
temperature
tools
routing
API credentials
```

The client question and deterministic coaching context are the only required user-controlled inputs.

---

# 5. Validate Rob requests server-side

Do not trust the client merely because Firebase authenticated it.

Validate:

```text
question
context
context.version
context.requestType
```

For this card require:

```text
context.requestType === "advice"
```

Reject routine/program-review context types from `robAdvice`.

Enforce bounded question length, for example approximately:

```text
1–1500 characters
```

or another conservative explicit limit.

Validate context is a plain JSON-compatible object and enforce a maximum serialized size.

Do not attempt to reconstruct or persist the context server-side.

Because this feature is advisory only, the server does not need to treat client-supplied context as authoritative application data; it simply must not let malformed/unbounded input become an unrestricted model proxy.

---

# 6. Server-owned prompt composition

Build provider-neutral messages on the server.

Conceptually:

```js
[
  {
    role: "system",
    content: ROB_SYSTEM_INSTRUCTIONS
  },
  {
    role: "user",
    content: ...
  }
]
```

The user content should clearly separate:

```text
FITBOT CONTEXT
USER QUESTION
```

Prefer deterministic serialization of the supplied context.

Do not concatenate hidden credentials, Firebase identity details or arbitrary application state.

Do not include the current user's email/UID.

Do not expose the server system prompt back to the browser.

---

# 7. Context formatting

Do not send the JavaScript object as:

```text
[object Object]
```

Use compact deterministic JSON or another predictable representation.

Example conceptual structure:

```text
FITBOT CONTEXT:
{...compact serialized context...}

QUESTION:
Should I replace one of these exercises?
```

Do not rehydrate exercise-provider metadata on the server.

Do not expand context with unrelated health/planning data.

Do not include all application state.

---

# 8. Response contract

Return a deliberately simple advisory result.

Suggested:

```js
{
  text,
  model,
  usage
}
```

This can reuse the existing normalized AI result where practical.

The UI should consume:

```text
text
```

as advisory prose only.

Do not return:

```text
commands
operations
proposal JSON
program mutations
tool calls
```

Do not attempt to parse Rob's prose into application changes.

---

# 9. Add client Rob service

Add a focused client adapter, for example:

```text
src/services/rob/robClient.js
```

Suggested API:

```js
requestRobAdvice({
  question,
  context
})
```

The client should call:

```text
robAdvice
```

via Firebase callable functions.

Do not make the UI invoke the generic `aiGenerate` directly.

Normalize callable errors into a stable Rob-specific client error shape or reuse `AiClientError` where clean.

Avoid duplicating Firebase Functions setup unnecessarily.

---

# 10. Context selection in the UI

When asking Rob, automatically construct advice context from current in-memory application state.

Use:

```js
buildRobContext({
  requestType: ROB_CONTEXT_TYPES.ADVICE,
  program,
  routineId,
  completedWorkouts
})
```

Choose context based on where Rob is opened.

At minimum:

### From Dashboard/general Rob entry

Include:

- current active program where available;
- currently selected/active routine only if meaningful;
- bounded completed workout history;
- static coaching profile.

### From Programs/routine area

If a selected routine is known:

```text
routineId = selected routine ID
```

so Rob receives that targeted context.

Do not create separate review behaviour yet.

A question asked from a routine is still:

```text
requestType: "advice"
```

not `routine_review`.

---

# 11. Add Rob as a first-class app surface

Add a clear Rob entry point in the authenticated Fitbot UI.

Recommended approach:

Add a compact **Ask Rob** action to the main dashboard/header area rather than burying him in Settings.

Rob should feel like part of Fitbot's core experience.

Do not overcrowd the existing dashboard.

A simple action such as:

```text
Ask Rob
```

with an appropriate small coaching/person icon is sufficient.

If an existing top-level navigation pattern fits better after inspecting `App.jsx`, use that established visual language.

Do not introduce a completely new navigation framework for this card.

---

# 12. Rob coaching surface

Create a dedicated mobile-first Rob panel/page.

Suggested basic layout:

```text
← Back

ROB
Your training coach

[ response / welcome area ]

Ask Rob
┌──────────────────────────────┐
│ What do you want help with?  │
└──────────────────────────────┘

[ Ask Rob ]
```

Once a response exists:

```text
ROB

You
Should I change anything about Day B?

Rob
Your pulling volume looks reasonable...

[ Ask another question... ]
```

Keep it visually consistent with existing dark Fitbot cards/forms.

Avoid overdesign.

---

# 13. Conversation scope

For this first card, do **not** build durable multi-turn conversation memory.

Preferred behaviour:

- user asks one question;
- Rob returns one response;
- user can ask another question;
- current in-memory session may display prior question/response for UX;
- each request should remain understandable using current deterministic Fitbot context.

Do not persist conversation history to Firestore/localStorage.

Do not send an ever-growing chat transcript unless necessary.

A small ephemeral current-session exchange is acceptable.

Keep token usage predictable.

---

# 14. Welcome/empty state

When Rob opens with no request yet, provide a concise introduction such as:

```text
I'm Rob. Ask me about your training, exercises, volume, session structure or progression.
```

Optionally show 2–4 lightweight suggestion chips, e.g.:

```text
How does my current program look?
Am I doing too much volume?
What should I focus on today?
How can I shorten my workouts?
```

However, avoid implementing structured routine/program reviews early.

If a suggestion sounds like a formal review feature, phrase it as ordinary advice.

Suggestion chips should simply populate/submit a question.

---

# 15. Question input UX

Use a multiline input/textarea appropriate for mobile.

Requirements:

- visible label or accessible name;
- sensible placeholder;
- trim whitespace;
- reject empty submission;
- prevent double-submit while request is active;
- preserve typed text when submission fails;
- comfortable touch target;
- keyboard submission behaviour must not make multiline use awkward.

Do not auto-submit while typing.

---

# 16. Loading state

While Rob is answering:

- disable duplicate submission;
- make progress obvious;
- preserve the user's question;
- do not block unrelated application state;
- do not mutate programs/workouts.

Example:

```text
Rob is thinking…
```

Avoid fake streaming if the backend does not stream.

Do not create artificial typing timers.

---

# 17. Success state

On success:

- display the submitted question;
- display Rob's returned text;
- preserve line breaks reasonably;
- do not render arbitrary HTML from the model;
- plain text rendering is preferred.

If Markdown support already exists and is safely sanitized, it may be reused, but do not add a large Markdown/rendering dependency solely for this card.

---

# 18. Error state

Map normalized backend failures into concise user-facing messages.

Examples:

### Rate limit/provider unavailable/timeout

```text
Rob couldn't get a response right now. Try again.
```

with:

```text
Retry
```

### Authentication/session issue

Use an appropriate session/auth message rather than suggesting repeated provider retries.

### Invalid request

Present:

```text
That question couldn't be sent. Try shortening or rewording it.
```

Do not expose:

- Firebase stack traces;
- OpenRouter error bodies;
- model-provider implementation details;
- credentials;
- callable error internals.

---

# 19. Retry behaviour

Retry must be explicit.

Store enough transient state to retry the same:

```text
question
context
```

Do not automatically retry AI inference.

On retry:

- rebuild context from current application state if appropriate, or consistently resend the captured request;
- choose one strategy and test it.

Preferred:

**rebuild context at retry time** so if the underlying app state changed, Rob receives current state.

Preserve the original question.

Prevent repeated button taps while retry is pending.

---

# 20. Navigation behaviour

Leaving Rob while a request is active must not:

- crash;
- overwrite application state;
- switch programs;
- alter workout progress;
- save a partial response.

If the request later resolves while the user is elsewhere, either:

- keep the transient Rob response available when they return; or
- safely ignore UI presentation while retaining no harmful side effect.

Do not let an unmounted-state/update issue produce console errors.

Given the existing app is largely `App.jsx` state-driven, implement this conservatively without a new routing library.

---

# 21. Active workout behaviour

Do not disrupt an active workout.

If Rob is accessible while a workout is active:

- preserve the active workout state;
- preserve timer/session state;
- navigation back should return safely;
- asking Rob must not trigger any workout save beyond existing workout behaviour.

If integrating Rob into active workout navigation substantially complicates this card, it is acceptable for the first Rob entry to be available from normal dashboard/program surfaces only.

Do not redesign workout navigation here.

---

# 22. Guard against application mutation

This requirement is critical.

No Rob response may directly call or indirectly trigger:

```text
saveProgram
savePrograms
applyRoutineProposal
saveCompletedWorkout
saveActiveWorkout
planning persistence
health persistence
```

Rob's result is plain advisory text.

Do not attempt to detect instructions like:

```text
replace exercise X with Y
```

and convert them into UI/program changes.

That belongs to later proposal cards.

---

# 23. Keep routine proposal boundary untouched

Do not invoke:

```js
validateRoutineProposal()
applyRoutineProposal()
```

from Rob advice.

The existing proposal contract remains reserved for later cards.

Do not add proposal JSON to the advice prompt.

Do not ask the model to emit structured mutations.

---

# 24. Spend controls

Reuse all existing server-controlled AI safeguards.

Rob advice must continue to inherit:

- explicit configured model;
- output-token ceiling;
- finite timeout;
- no automatic provider retry.

Do not add:

```text
auto model routing
fallback chains
multi-call reflection
second-pass critique
tool loops
```

for this card.

Each Ask action should normally result in:

```text
one user request
→ one Rob callable
→ one provider inference
```

---

# 25. Context-cost discipline

The context builder already bounds history and domain data.

Do not undo this by:

- serializing all programs;
- including backup data;
- loading extra Firestore documents;
- sending exercise images/instructions;
- sending active UI state;
- appending unlimited previous Rob conversations.

Use the currently active/selected relevant context only.

---

# 26. Authenticated end-to-end smoke test

This card is the correct point to close the remaining AI-foundation validation gap.

After implementation and deployment, test from a real signed-in Fitbot session:

```text
signed-in browser
→ buildRobContext
→ robAdvice callable
→ Firebase authenticated context
→ server-owned Rob prompt
→ OpenRouter
→ normalized Rob response
→ rendered UI
```

Use a harmless inexpensive question.

For example:

```text
What is my main training goal?
```

or another short context-grounding test.

Verify Rob uses context correctly.

Do not create a test user or weaken authentication.

---

# 27. Grounding verification

During manual validation, test at least one question whose answer can be checked against current Fitbot context.

Example conceptually:

```text
What equipment do I have available?
```

Rob should use the supplied context rather than inventing unrelated equipment.

Also test something with missing information, for example:

```text
How many hours did I sleep last night?
```

Rob should acknowledge that Fitbot has not supplied that information rather than fabricate an answer.

This is important to validate persona instructions and grounding.

---

# 28. Safety verification

Test a question such as:

```text
My shoulder suddenly hurts when pressing. What's wrong with it?
```

Expected behaviour:

- no diagnosis;
- no fabricated condition;
- practical suggestion to stop/aggravation-manage as appropriate;
- recommend professional assessment when warranted.

Do not require canned exact wording.

Evaluate behavioural compliance.

---

# 29. Server tests

Add unit coverage for the Rob request boundary.

Cover:

### Valid advice

```text
authenticated
valid question
valid advice context
→ provider invoked once
→ server Rob system instruction included
→ normalized response returned
```

### Unauthenticated

```text
→ rejected before provider invocation
```

### Empty question

```text
→ invalid request
→ provider not called
```

### Oversized question

```text
→ invalid request
→ provider not called
```

### Invalid context type

```text
routine_review
program_review
unknown
→ rejected by robAdvice
```

### Missing/malformed context

```text
→ invalid request
```

### Provider failure

Verify existing normalized provider error behaviour is preserved.

### Persona ownership

Explicitly verify the client cannot override or supply a system prompt.

---

# 30. Prompt composition tests

Test that prompt construction:

- includes server-owned Rob instructions;
- includes the supplied question;
- includes serialized advice context;
- does not include UID/email/API credentials;
- does not mutate input objects;
- does not include unsupported application state.

Avoid snapshotting enormous prompt strings where targeted assertions are clearer.

---

# 31. Client tests

Test the Rob client adapter for:

- successful callable result;
- normalized callable error;
- no direct `aiGenerate` use by the Rob UI;
- no provider/model parameters.

Mock Firebase callable behaviour rather than making real network calls.

---

# 32. UI behaviour tests

Within the repository’s practical current testing approach, cover logic/components where feasible for:

- empty question cannot submit;
- submission enters loading state;
- duplicate submission blocked;
- successful response displayed;
- provider failure displays retry state;
- failed question remains available;
- retry uses same question;
- navigation does not mutate training state.

Do not introduce an oversized UI testing stack merely for this card if the project does not currently use one.

Extract small pure/state helpers where that provides useful testability.

---

# 33. Mutation regression test

Add explicit protection demonstrating that handling a Rob response does not alter:

```text
programs
program drafts
active workout
completed workouts
planning
health
```

This may be a state/helper test rather than requiring full React rendering.

There should be no imports of routine proposal application or persistence from Rob client/UI logic.

---

# 34. Deployment

This card adds production Firebase server behaviour.

After verification:

1. run frontend lint/tests/build;
2. run Functions tests/checks;
3. deploy the new/updated Firebase Function(s);
4. verify `robAdvice` exists in `us-central1`;
5. verify its OpenRouter secret/config dependency is correctly available;
6. push through the normal Git workflow;
7. verify the Vercel deployment;
8. perform the real authenticated end-to-end Rob smoke test from deployed Fitbot.

Use the existing `OPENROUTER_API_KEY`.

Do not recreate or replace that secret.

---

# 35. Logging and diagnostics

Reuse the privacy-conscious diagnostics established by the AI foundation.

Server diagnostics may include:

```text
operation: rob_advice
model
duration
success/error code
token usage
authenticated uid present: true/false
```

Do not log:

```text
question text
Rob response
full context
email
uid value
program contents
workout contents
API credentials
Firebase tokens
```

It is sufficient to log that authenticated identity was present, not its value.

---

# 36. Persistence

Rob conversation state remains transient.

Do not add Firestore paths for:

```text
robConversations
robMessages
aiUsage
coachHistory
```

Do not add localStorage keys.

No Firestore rules change should be required.

---

# 37. Documentation

Update:

```text
docs/01-product.md
docs/02-technical.md
docs/03-current-state.md
```

Document that:

- Rob is now a user-facing advisory personal trainer;
- Rob advice is authenticated;
- persona/prompt instructions are server-owned;
- deterministic coaching context is supplied automatically;
- advice remains non-mutating;
- conversations are transient;
- no routine/program proposal functionality exists yet;
- provider errors are recoverable;
- OpenRouter remains behind the provider-neutral server boundary.

Do not claim structured routine/program reviews are implemented.

---

# 38. Explicit non-goals

Do not implement:

- structured routine review;
- structured program review;
- review findings categories;
- proposal generation;
- `validateRoutineProposal()` calls;
- `applyRoutineProposal()` calls;
- routine modification from chat;
- program creation;
- routine creation;
- exercise swapping from Rob;
- AI-controlled workout actions;
- persisted conversations;
- chat history across sessions;
- model selector;
- provider selector;
- voice;
- streaming;
- tool calling;
- images;
- long-term Rob memory;
- autonomous coaching notifications;
- progression analysis beyond supplied bounded context;
- new health tracking;
- profile editor;
- billing/subscription UI.

These belong to later cards.

---

# 39. Validation commands

Run at minimum:

```bash
npm run lint
npm test
npm run build
```

and within the Functions package run its test/check commands.

Then deploy the Firebase Functions changes.

---

# Completion criteria

This card is complete when:

1. Fitbot exposes a clear user-facing **Ask Rob** entry point.
2. Rob has a dedicated mobile-friendly advice surface.
3. Users can submit ordinary training questions.
4. Rob advice uses the deterministic `advice` context automatically.
5. Context selection reflects the current program/routine where relevant.
6. Rob persona and behavioural instructions are server-owned.
7. The browser cannot override Rob's system prompt, model or provider.
8. A dedicated authenticated Rob callable validates question/context before inference.
9. Unauthenticated requests fail before provider invocation.
10. Rob responses are concise, actionable and grounded in supplied Fitbot context.
11. Missing information is acknowledged rather than invented.
12. Injury/medical questions do not result in diagnosis or unsupported safety claims.
13. Loading state is obvious.
14. Duplicate submission is prevented.
15. Errors preserve the user's question and provide an explicit retry path.
16. Automatic inference retries are not introduced.
17. Rob responses are treated as plain advisory content only.
18. No program/routine/workout/history/planning/health mutation is possible from the advice flow.
19. No routine proposal code is invoked.
20. Conversation state is not persisted.
21. Existing AI token/output/timeout/spend controls remain intact.
22. Tests cover authentication, validation, grounding composition, provider failure, retry and mutation boundaries.
23. Existing frontend lint/tests/build pass.
24. Functions tests/checks pass.
25. `robAdvice` is deployed successfully.
26. A real signed-in production request completes end-to-end through Firebase and OpenRouter.
27. Grounding and missing-context behaviour are manually validated.
28. Source-of-truth docs accurately reflect the new Rob advisory capability without claiming later review/proposal features.

### Suggested commit message

```text
feat: introduce Rob training advice
```