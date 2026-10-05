## Codex Implementation Brief — Establish secure provider-neutral AI foundation

### Objective

Introduce the minimum secure infrastructure required for Fitbot’s future **Rob AI personal trainer** features.

This card establishes:

- a provider-neutral AI service boundary;
- OpenRouter as the first provider implementation;
- a server-side request boundary that protects provider credentials;
- Firebase-authenticated access;
- server-controlled model, timeout and output/spend limits;
- normalized success/error/usage responses;
- test coverage and operational diagnostics.

This card **must not implement Rob coaching behaviour yet**. Do not build training-context generation, program/routine review, chat history, routine proposals, AI-generated program changes or approval UX.

The purpose is to create a secure, boring, testable AI transport layer that later Rob cards can consume.

---

# Current architecture to preserve

Fitbot is currently a Vite/React application using Firebase Authentication and Firestore.

Relevant existing structure includes:

```text
src/
  App.jsx
  services/
    auth.js
    firebase.js
    routineProposal.js
    ...
```

Current dependencies are intentionally small:

```text
firebase
react
react-dom
```

Firebase client initialization currently lives in:

```text
src/services/firebase.js
```

Firebase Auth already controls access to the application through Google sign-in.

Firestore currently persists:

```text
users/{uid}
users/{uid}/programs/{programId}
users/{uid}/completedWorkouts/{workoutId}
users/{uid}/appState/{docId}
```

Do not broaden these paths for this card.

The existing routine proposal system is deliberately provider-neutral and pure:

```js
validateRoutineProposal(...)
applyRoutineProposal(...)
```

Do not modify or invoke that system from the AI foundation.

Fitbot is deployed through the repository’s existing Git/Vercel workflow. The repository instructions also explicitly permit Firebase Cloud Functions when an approved brief requires them.

There is currently no server-side application layer in the repository, so this card should introduce the smallest appropriate Firebase Functions boundary rather than embedding provider credentials in Vite or creating a larger backend framework.

---

# Architecture decision

Use **Firebase Cloud Functions** as the trusted server-side boundary for Rob AI requests.

Target architecture:

```text
React client
    │
    │ Firebase-authenticated request
    ▼
Firebase callable function
    │
    ▼
AI service
    │
    ├── provider-neutral request contract
    │
    └── OpenRouter provider adapter
            │
            ▼
       OpenRouter API
```

Prefer a callable Firebase Function rather than a public browser-to-OpenRouter request because Firebase callable functions provide the authenticated Firebase user context at the trusted boundary.

Do not trust a client-supplied UID.

Do not add CORS/authentication plumbing unnecessarily if callable functions already provide the required authentication semantics.

---

# Proposed structure

Keep provider and Rob concerns separate.

A suitable structure is:

```text
functions/
  package.json
  src/
    index.js

    ai/
      aiService.js
      aiErrors.js
      aiConfig.js
      providers/
        openRouterProvider.js
```

Client:

```text
src/
  services/
    aiClient.js
```

Exact naming can adapt to repository conventions, but preserve these responsibilities.

Do **not** introduce:

```text
robContext.js
robPrompts.js
robSchemas.js
```

yet. Those belong to later cards.

---

# 1. Firebase Functions foundation

Add Firebase Functions support to the repository.

Update `firebase.json` as required so Functions can be deployed alongside the existing Firestore configuration.

Create a dedicated Functions package rather than putting server-only dependencies in the browser package.

For example:

```text
functions/package.json
```

Use the currently supported Firebase Functions runtime compatible with the repository/toolchain.

Do not unnecessarily migrate the frontend build or restructure the app.

The frontend must continue to run through the existing Vite setup.

### Acceptance

- `npm run build` for the frontend still succeeds.
- Functions dependencies are isolated from the Vite browser bundle.
- Firebase can discover and deploy the new function.
- Existing Firestore behaviour is unchanged.

---

# 2. Environment secret handling

The OpenRouter API key must exist **only on the server side**.

Use Firebase’s supported secret/config mechanism for:

```text
OPENROUTER_API_KEY
```

Do not use:

```text
VITE_OPENROUTER_API_KEY
```

or any other `VITE_*` provider secret.

Do not put the key in:

- source control;
- `.env` committed to Git;
- Firestore;
- localStorage;
- React state;
- client requests;
- generated Vite assets;
- application logs.

Creating or replacing a production Firebase secret requires explicit user action under the repository deployment instructions, so implementation should stop at that boundary if the secret does not already exist.

Document the exact command/value that the user must supply, but **never ask Codex to invent or echo the key**.

Example conceptual requirement:

```text
firebase functions:secrets:set OPENROUTER_API_KEY
```

Use the actual Firebase CLI syntax supported by the installed/current Functions version.

### Optional non-secret configuration

Provider/model settings may use server environment configuration, for example:

```text
AI_PROVIDER=openrouter
AI_MODEL=<model slug>
AI_MAX_OUTPUT_TOKENS=<bounded value>
AI_TIMEOUT_MS=<bounded value>
```

These values must remain server-controlled.

Do not allow arbitrary provider or model selection through the public client request in this card.

---

# 3. Provider-neutral AI request contract

Create an internal provider-neutral request shape.

Keep it intentionally small because later cards will add Rob-specific context.

Suggested internal shape:

```js
{
  messages: [
    {
      role: "system" | "user" | "assistant",
      content: "..."
    }
  ]
}
```

The provider-neutral service may accept limited server-owned options internally, such as:

```js
{
  maxOutputTokens
}
```

but those options must not expose OpenRouter implementation details to calling code.

The result should normalize provider output to something similar to:

```js
{
  text,
  model,
  usage: {
    inputTokens,
    outputTokens,
    totalTokens
  }
}
```

Usage values may be `null` where the provider does not return them.

Do not return the raw OpenRouter response to the client.

Do not expose provider request IDs, internal routing metadata or reasoning traces unless specifically useful for development diagnostics.

---

# 4. Provider abstraction

Implement a minimal provider boundary.

Conceptually:

```js
aiProvider.generate(request)
```

or:

```js
generateAiResponse(request)
```

Provider-specific details belong entirely inside:

```text
openRouterProvider.js
```

The higher-level AI service must not know:

- OpenRouter URL structure;
- OpenRouter headers;
- OpenRouter response layout;
- OpenRouter error schema.

This is what allows a later direct OpenAI provider to replace or coexist with OpenRouter without changing Rob-facing code.

Do not build a provider-selection UI.

Do not support user-selectable providers yet.

---

# 5. OpenRouter provider implementation

Use OpenRouter's current OpenAI-compatible API.

The currently documented base is:

```text
https://openrouter.ai/api/v1
```

and chat completion requests are made to:

```text
POST /chat/completions
```

using:

```text
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json
``` :chatgpt-content-reference{index="0"}


A request should use a server-configured model rather than accepting arbitrary model strings from the browser.

The provider currently supports response/token controls including `max_tokens`, although exact model capability differs by model. :chatgpt-content-reference{index="1"}

Use native `fetch` unless there is a compelling reason for an SDK. The integration requirement is small enough that adding a large client abstraction is unnecessary.

Avoid unnecessary OpenRouter-specific SDK lock-in.

### Request behaviour

The provider should:

1. build the OpenRouter payload;
2. apply the configured model;
3. enforce maximum output tokens;
4. use an abortable timeout;
5. make one upstream request;
6. validate the returned response;
7. normalize text and usage data;
8. throw normalized internal errors.

Do not enable:

- streaming;
- automatic multi-model routing;
- tool calling;
- reasoning output;
- images;
- provider fallbacks;
- recursive retries.

Those can be introduced later if there is a demonstrated need.

---

# 6. Server-controlled model configuration

Define one explicit default model server-side.

Do **not** hard-wire model choice throughout application code.

Keep it in one configuration module:

```text
aiConfig.js
```

Conceptually:

```js
export const aiConfig = {
  provider: "openrouter",
  model: process.env.AI_MODEL || "<chosen-default>",
  maxOutputTokens: ...,
  timeoutMs: ...,
};
```

Choose a modest output ceiling appropriate for foundation testing.

A reasonable starting constraint is approximately:

```text
1000–2000 output tokens
```

rather than allowing unrestricted generation.

The exact default model should be easy to replace through server configuration without a code rewrite.

Avoid `openrouter/auto` for this first implementation because explicit model choice gives predictable behaviour and spend.

OpenRouter currently supports hundreds of models behind the same API, making this configuration boundary useful for later experimentation. [OpenRouter](https://openrouter.ai/developers?utm_source=chatgpt.com)

---

# 7. Authentication boundary

Expose one authenticated callable function.

Suggested conceptual name:

```text
aiGenerate
```

or:

```text
robAiRequest
```

Prefer the more generic AI name for this card because Rob-specific behaviours do not exist yet.

Every invocation must verify that Firebase Authentication context exists.

Reject:

```text
request.auth == null
```

with a normalized unauthenticated error.

Use:

```text
request.auth.uid
```

only from verified Firebase callable context.

Do not accept:

```js
{
  uid: "..."
}
```

as authentication evidence.

Do not perform Firestore reads for authentication.

Firebase Auth already provides the identity boundary.

---

# 8. Restrict client request shape

Do not expose a generic unrestricted LLM proxy.

That would allow an authenticated user to use Fitbot as an arbitrary OpenRouter relay and consume unlimited credits.

For this foundation card, expose only a deliberately constrained request contract sufficient to verify the transport.

For example:

```js
{
  messages: [...]
}
```

with strict limits such as:

- maximum message count;
- permitted roles;
- maximum content length per message;
- maximum total input characters;
- no model parameter;
- no temperature parameter;
- no token-limit override;
- no tools;
- no provider-routing options;
- no arbitrary headers.

An even narrower foundation-only test request is acceptable if that is cleaner, provided later cards can build on the service without redesigning the provider layer.

Validation must occur server-side.

Client validation may exist for UX but is not the security boundary.

---

# 9. Input limits

Introduce conservative constants.

For example:

```text
MAX_MESSAGES
MAX_MESSAGE_CHARS
MAX_TOTAL_CHARS
MAX_OUTPUT_TOKENS
```

Do not rely only on upstream model context limits.

Reject oversized input before invoking OpenRouter.

Return a stable validation error.

Do not silently truncate user text server-side unless there is a strong technical reason.

Later Rob context generation will be responsible for deliberately bounded context.

---

# 10. Timeout behaviour

Use `AbortController` or equivalent.

Do not allow Functions to wait indefinitely for the provider.

Choose one clear upstream timeout, e.g. approximately:

```text
20–30 seconds
```

and keep it configurable.

Translate timeout into an internal error such as:

```js
{
  code: "ai_timeout",
  retryable: true
}
```

The client should receive a safe message such as:

```text
Rob couldn't get a response right now. Try again.
```

Do not surface implementation details or provider stack traces.

---

# 11. Retry policy and spend protection

Do not implement automatic retries for ordinary generation requests in this card.

A single user action should normally produce:

```text
one client invocation
→ one OpenRouter request
```

This avoids duplicate inference charges and makes spend deterministic.

The client can offer a manual Retry action in later Rob UI.

If a very narrow transport retry is added for a clearly non-billed network failure, it must be explicitly bounded to one attempt and must not retry ambiguous completion failures.

Default preference for this card:

```text
no automatic upstream retry
```

OpenRouter itself may route/fallback internally depending on provider/model configuration, so Fitbot should not add another opaque retry loop. OpenRouter documents provider fallback capability. [OpenRouter](https://openrouter.ai/support/?utm_source=chatgpt.com)

---

# 12. Normalized errors

Create a stable internal error model.

Suggested codes:

```text
ai_unauthenticated
ai_invalid_request
ai_not_configured
ai_rate_limited
ai_timeout
ai_provider_auth
ai_provider_unavailable
ai_invalid_response
ai_unknown
```

Suggested normalized shape:

```js
{
  code,
  message,
  retryable
}
```

Do not pass provider response bodies directly to React.

Map typical upstream cases:

```text
401 / 403
→ ai_provider_auth
→ non-retryable for user

429
→ ai_rate_limited
→ retryable

5xx
→ ai_provider_unavailable
→ retryable

timeout / abort
→ ai_timeout
→ retryable

200 with malformed/missing completion
→ ai_invalid_response
→ retryable

missing API secret
→ ai_not_configured
→ non-retryable
```

The server may log technical diagnostics, but the browser gets safe text.

---

# 13. Provider response validation

Do not assume an HTTP `200` means usable data.

Verify that:

- response parses as JSON;
- a completion choice exists;
- usable assistant text exists;
- the response matches the expected basic structure.

Reject:

```text
empty choices
missing message
non-string text where unsupported
unexpected provider body
```

with:

```text
ai_invalid_response
```

Do not return `undefined`, provider JSON or HTML error pages to the client.

---

# 14. Usage diagnostics

Capture only lightweight operational metadata.

Where OpenRouter returns usage fields, normalize:

```js
{
  inputTokens,
  outputTokens,
  totalTokens
}
```

Return this data from the server internally/client-side only where useful for development.

In development logging, it is acceptable to record:

```text
provider
configured model
success/failure
normalized error code
duration
input token count
output token count
total token count
authenticated uid present: true/false
```

Do **not** log:

- OpenRouter API key;
- Firebase ID token;
- prompt text;
- assistant output text;
- user email;
- full Firebase user object;
- program contents;
- workout contents;
- arbitrary health/training data.

Do not create a Firestore usage collection in this card.

Persistent analytics/spend tracking is out of scope.

OpenRouter provides its own activity/usage visibility, so local durable billing infrastructure is unnecessary at this stage. [OpenRouter](https://openrouter.ai/support/?utm_source=chatgpt.com)

---

# 15. Client AI service

Add a small browser-side adapter:

```text
src/services/aiClient.js
```

Its responsibility is only to call the Firebase callable function and normalize returned errors for UI callers.

Do not call OpenRouter from this file.

Do not put prompts/persona logic here.

Suggested API:

```js
requestAiResponse({ messages })
```

returning:

```js
{
  text,
  usage,
  model
}
```

or throwing a normalized client error.

Keep it independent from `App.jsx` wherever possible.

---

# 16. Minimal validation UX

This card does not need a permanent Ask Rob interface.

However, Codex must provide a practical way to verify the production integration.

Prefer one of:

- a development-only smoke test helper;
- a narrowly exposed diagnostic action available only in development;
- automated function integration tests/mocked provider tests.

Do not add a half-finished Rob chat panel just to test the endpoint.

If any temporary UI is introduced for validation, remove it before completion unless it has clear ongoing diagnostic value.

The production application should not gain a user-facing Rob experience from this card.

---

# 17. Persistence boundaries

This card performs **no domain persistence**.

It must not write to:

```text
users/{uid}
users/{uid}/programs/*
users/{uid}/completedWorkouts/*
users/{uid}/appState/*
```

Do not add:

```text
AI conversations
Rob messages
usage documents
provider configuration documents
prompt history
```

to Firestore.

Do not modify:

```text
programStore.js
planningStore.js
healthStore.js
activeWorkoutStore.js
workoutHistoryStore.js
routineProposal.js
```

unless a genuinely mechanical import/configuration change is required.

AI responses are transient.

---

# 18. Firestore rules

No Firestore rule broadening is required.

The existing narrow rule model should remain unchanged.

If implementation does not require a Firestore rule change, do not touch `firestore.rules`.

The Cloud Function uses authenticated function context, not a new client-accessible Firestore collection.

---

# 19. Security checks

Before completion verify all of the following.

### Secret isolation

Search the repository/build output for the actual provider secret if available and confirm it appears nowhere in client assets.

Also inspect for:

```text
OPENROUTER_API_KEY
VITE_OPENROUTER
Bearer
```

where relevant.

The environment variable name may appear in server code; the secret value must not.

### Browser bundle

Confirm server files are not included in `dist/`.

### Authentication

Direct unauthenticated invocation must fail before contacting OpenRouter.

### Request restriction

Confirm the browser cannot supply:

```text
model
provider
API key
provider headers
max_tokens override
tools
routing settings
```

through the public function contract.

### Mutation protection

Confirm the AI service imports no:

```text
program persistence
workout persistence
planning persistence
health persistence
routine proposal application
```

modules.

---

# 20. Tests

Add focused automated coverage.

The repository currently uses:

```text
node --test
```

Keep tests compatible with the existing test strategy unless Functions require their own package-local test script.

## Provider tests

Mock network requests and verify:

### Successful completion

Given valid OpenRouter JSON:

```text
→ normalized text
→ normalized model
→ normalized usage
```

### Authentication upstream error

```text
401/403
→ ai_provider_auth
```

### Rate limit

```text
429
→ ai_rate_limited
→ retryable
```

### Provider unavailable

```text
500/502/503
→ ai_provider_unavailable
```

### Timeout

```text
aborted fetch
→ ai_timeout
```

### Malformed success

Examples:

```text
200 + invalid JSON
200 + empty choices
200 + missing message content
```

must return:

```text
ai_invalid_response
```

### Missing secret

```text
→ ai_not_configured
```

without making a network request.

---

# 21. Request-validation tests

Cover:

- missing messages;
- messages not array;
- unsupported roles;
- empty content;
- excessive message count;
- excessive message length;
- excessive total length;
- client attempts to pass unsupported provider configuration.

Validation failures must occur before calling the provider.

---

# 22. Authentication tests

Verify:

```text
authenticated request
→ may reach AI service
```

and:

```text
unauthenticated request
→ rejected
→ provider mock never called
```

Never derive the authenticated user from client payload data.

---

# 23. No-mutation regression

Add at least one architectural/regression assertion where practical showing that the AI path does not mutate current program/routine/workout state.

At minimum, ensure tests do not mock or invoke any persistence service during an AI request.

This is primarily a boundary test rather than a React state test.

---

# 24. Existing regression checks

Run:

```bash
npm run lint
npm test
npm run build
```

Also run the equivalent Functions package checks/tests.

Do not finish with known lint warnings introduced by this work.

---

# 25. Local/manual validation

After automated tests, perform a controlled provider smoke test if the required secret is available.

Use an intentionally tiny request such as:

```text
Reply with exactly: OK
```

Verify:

```text
authenticated client
→ Firebase Function
→ OpenRouter
→ normalized response
```

Do not use real program/workout data for this foundation smoke test.

Verify token usage is small and diagnostics contain no prompt content.

If the API secret is not configured, complete all code/test work and report the exact remaining secret setup action rather than fabricating a successful live test.

---

# 26. Deployment

Because this changes deployable production behaviour:

1. verify implementation locally;
2. update relevant `docs/` source-of-truth files;
3. configure Firebase Functions in `firebase.json`;
4. deploy the required Firebase Function through Firebase CLI;
5. do not create or replace the OpenRouter secret without explicit user action;
6. commit using the suggested commit message;
7. push through the repository’s normal Git integration;
8. verify the Git-triggered frontend deployment;
9. verify the Firebase Function deployment independently.

Do not claim the AI integration is production-ready if:

- the Function has not been deployed;
- the production secret is absent;
- authentication fails;
- the live provider smoke test has not succeeded where configuration is available.

---

# 27. Documentation updates

Update:

```text
docs/02-technical.md
docs/03-current-state.md
```

Document:

- Firebase Functions AI boundary;
- provider-neutral AI architecture;
- OpenRouter as current provider;
- server-side-only credential handling;
- server-configured model;
- normalized error handling;
- transient usage diagnostics;
- explicit fact that no AI feature currently mutates application data.

Do not describe Rob coaching/review/program generation as implemented.

If useful, `docs/01-product.md` may mention the AI foundation as implemented infrastructure, but do not imply a user-facing Rob feature exists yet.

---

# Explicit non-goals

Do **not** implement any of the following:

- Rob persona;
- Rob chat interface;
- coaching prompts;
- training context construction;
- reading program/routine data for AI;
- workout-history summarization;
- program review;
- routine review;
- routine generation;
- routine modification;
- AI proposal generation;
- `validateRoutineProposal()` integration;
- `applyRoutineProposal()` integration;
- approval/rejection UI;
- AI conversation persistence;
- user-selectable models;
- user-selectable provider;
- direct OpenAI provider implementation;
- streaming;
- tool/function calling;
- autonomous actions;
- Firestore AI usage tracking;
- subscriptions/billing UI;
- credit balance monitoring;
- background jobs;
- retries that can generate uncontrolled duplicate spend.

Those belong to later cards.

---

# Completion criteria

This card is complete when:

1. Fitbot contains a clean provider-neutral AI boundary.
2. OpenRouter is implemented only behind that boundary.
3. Provider credentials exist only in trusted server-side secret storage.
4. A Firebase-authenticated callable function is the sole browser-accessible AI route.
5. Unauthenticated requests are rejected before provider invocation.
6. Client callers cannot choose arbitrary providers/models/token budgets.
7. Input and output size limits exist.
8. Provider requests have a finite timeout.
9. Automatic retries do not create uncontrolled spend.
10. OpenRouter errors are converted into stable internal error codes.
11. Malformed provider responses fail safely.
12. Basic model/token/duration diagnostics exist without logging sensitive prompts or credentials.
13. No program, routine, active workout, history, planning or health state is read or mutated as part of AI behaviour.
14. Existing routine proposal architecture is untouched.
15. Firestore rules remain narrow.
16. Tests cover success, validation, authentication, rate limit, timeout, upstream failure, malformed responses and missing configuration.
17. Frontend lint/tests/build and Functions checks pass.
18. Relevant source-of-truth documentation is refreshed.
19. Production deployment is verified where credentials/configuration permit.

### Suggested commit message

```text
feat: add secure provider-neutral AI foundation
```
