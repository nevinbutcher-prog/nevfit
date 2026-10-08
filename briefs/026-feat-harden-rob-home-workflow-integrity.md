
# Codex Implementation Brief — Establish Rob Home and Unified Coaching Entry Points

**Project:** Fitbot  
**Phase:** Rob Home  
**Priority:** High  
**Card type:** UI consolidation and workflow integration  
**Baseline:** Commit `0b1686f` or the latest compatible main branch

## ELI5 — What are we actually building?

When I select **Rob** from Fitbot's navigation, I want to see three obvious options:

1. **Ask Rob a Question** — talk to my training coach.
2. **Review My Program** — select a program and ask Rob to analyse it.
3. **Build Me a Program** — begin the process of getting Rob to design a complete training program.

The first two should use functionality Fitbot already has.

The third should have a proper home, ready for the next implementation card, which will introduce Rob's program-design conversation.

I should not have to search the manual program builder to find Rob's main capabilities.

**Success means Rob finally feels like a coherent part of Fitbot, not a collection of AI buttons.**

---

## 1. Current implementation — important findings

Inspect the latest code before editing. At commit `0b1686f`, the relevant implementation is primarily in `src/App.jsx`.

### Existing navigation

The main navigation already includes a **Rob** button.

Its current handler sets `robPanelMode` to `"advice"` and `viewMode` to `"rob"`.

This currently bypasses any landing screen and opens the advisory experience directly.

### Existing Rob UI

Rob's current rendering is controlled by:

- `viewMode === "rob"`
- `robPanelMode === "advice"`
- `robPanelMode === "program_review"`
- `robPanelMode === "routine_review"`

The Rob UI currently combines advisory content and structured review results.

Preserve the existing rendering functionality while introducing a clear home state.

### Existing question flow

`submitRobQuestion()` already:

- builds scoped advice context;
- uses `dashboardProgram`;
- calls `requestRobAdvice()`;
- handles loading, errors and responses;
- does not mutate programs.

Reuse this function and its associated state.

### Existing review flow

`submitRobReview(requestType)` currently determines its target using:

`selectedProgramDraft ?? dashboardProgram`

For routine reviews, it also obtains the selected routine from `selectedProgramDayDraft`.

**This selection logic is insufficient for the new Rob Home program-selection workflow.**

The user must be able to select a specific program within Rob, independently of whichever program happens to be open in the manual editor.

Do not simply change the displayed program name while continuing to send the editor-selected program to Rob.

### Existing builder shortcuts

The program builder currently contains a **Review Program** action.

There are also existing routine review and Create Routine with Rob capabilities.

Preserve these functional paths.

Do not delete or broadly redesign them in this card.

### Existing proposal infrastructure

The existing routine proposal infrastructure and the pure `create_program` / `modify_program` domain contract must remain untouched unless a narrow integration change is essential.

Neither program proposal type should be executed by this card.

---

## 2. Rob navigation model

Introduce a clear, minimal workflow model under the existing Rob navigation.

Conceptual states:

- `home`
- `advice`
- `program_select`
- `program_review`
- `program_build_intro`
- existing `routine_review` context

Names may differ to suit current conventions.

Prefer extending the existing `robPanelMode` approach or extracting a small, focused workflow helper.

Do not introduce a routing framework merely for this feature.

Do not create separate copies of Rob's request or response state for each entry point.

### Navigation behaviour

Selecting the main Rob navigation tab should open **Rob Home**.

The existing question or review content should not be unnecessarily cleared simply because the user navigates to Home.

Provide an explicit **Back to Rob** action within child workflows.

The user should be able to navigate:

Rob Home → Action → Rob Home.

Where a contextual routine review originated outside Rob, preserve a sensible route back to the originating context.

Avoid relying on the generic browser Back button as the only navigation mechanism.

---

## 3. Rob Home design

Use the existing Fitbot visual language.

The home should present a short introductory heading followed by three clearly differentiated actions.

### Ask Rob a Question

Supporting description:

"Get help with exercises, training and progression."

### Review My Program

Supporting description:

"Get Rob's assessment of one of your programs."

### Build Me a Program

Supporting description:

"Design a complete training program with Rob."

These should be prominent, touch-friendly actions rather than a crowded toolbar.

Use the existing background, colour palette, borders, spacing and typography.

Avoid adding decorative components that make the screen significantly longer without improving clarity.

### UX expectations

- Mobile-first layout.
- Comfortable touch targets.
- Text must wrap appropriately.
- Clear focus and hover states.
- Keyboard-accessible controls.
- Existing Rob tab remains visibly active throughout its workflows.
- No unnecessary modal layering.
- No floating controls obscuring content.

Do not redesign the global application navigation.

---

## 4. Ask Rob a Question

Connect this action to the existing advice workflow.

Reuse:

- `submitRobQuestion()`
- `requestRobAdvice()`
- `buildRobContext()`
- existing question input;
- existing response state;
- existing error/retry handling.

Preserve the existing advisory-only boundary.

Do not introduce conversation history persistence, streaming, model selection or new AI features.

### Navigation and state

Entering advice from Rob Home should display the existing question experience.

Returning to Home should not discard the current question or last response unless the user explicitly resets it or existing application lifecycle behaviour already requires it.

Reopening advice should restore the current in-memory advisory state.

Do not initiate an AI request merely by opening the screen.

---

## 5. Review My Program — explicit selection

This is the most important functional integration change in this card.

Flow:

Rob Home → Review My Program → Choose Program → Review Result.

### Program selection

Present a selectable list of the user's existing programs.

Use the actual available program records and current application conventions.

Each choice should show:

- program name;
- useful secondary detail such as routine count;
- clear selection state.

Determine which programs are eligible by inspecting current saved/draft and archived-program conventions.

Prefer normal, non-archived available programs.

Do not silently include archived programs if the existing product treats them as unavailable.

Do not silently fall back to another program if a selected program becomes unavailable.

### Draft versus saved data

The current builder can contain unsaved program changes.

Establish and document a consistent rule for Rob Home reviews.

Recommended:

- Review a specifically selected existing program using its current in-memory representation.
- If its draft contains unsaved changes, explicitly communicate that Rob is reviewing the draft.
- Never silently substitute a different program or a saved version when the visible selection refers to the draft.

Reuse current program identity and draft conventions rather than creating another persistent program-selection system.

### Review invocation

Refactor the existing `submitRobReview()` entry point narrowly so program-level review can receive an explicit target program ID or validated program reference.

The selection must be resolved against current state at request time.

Routine review should continue using its existing routine context.

Preserve the existing request type:

`ROB_CONTEXT_TYPES.PROGRAM_REVIEW`

Preserve:

- `buildRobContext()`
- `requestRobReview()`
- existing structured review rendering;
- existing loading/error behaviour.

### Important target integrity

A user selecting Program B in Rob must never accidentally review Program A because Program A is currently open in the editor.

The review heading, context payload and retry path must all reference the same selected program.

---

## 6. Program review results

Preserve the current structured review presentation:

- overall summary;
- strengths;
- concerns;
- suggested changes;
- limitations.

Do not rewrite the review prompts or response schemas.

Do not add executable `modify_program` proposals yet.

The review remains read-only.

### Retry behaviour

If the request fails, retry must use the originally selected program identity, subject to a fresh availability check.

Do not recalculate the target using whichever program happens to be selected in the builder at retry time.

If the target no longer exists, display a useful error and offer a return to program selection.

### Leaving a review

Provide a clear route back to Rob Home and an obvious route to select another program.

Avoid unnecessary paid review regeneration when navigating between existing results and Home.

---

## 7. Preserve contextual routine reviews

Existing routine-review functionality should continue to work.

A routine review originating from the program builder may still open the Rob review screen with the appropriate routine target.

Do not force users through the new three-action Home flow when they have already selected a specific routine using an existing contextual action.

Preserve the existing routine proposal preview, approval and exercise-resolution behaviour.

Do not turn routine review into another top-level Rob Home action in this card.

The three primary actions should remain the focus.

---

## 8. Build Me a Program — dedicated introduction

Create a dedicated view under Rob Home.

It should communicate the intended upcoming workflow:

- Rob will ask about goals and training preferences.
- Rob will design multiple routines as one program.
- The user will review the proposed program before anything is saved.

However, this card does not implement that conversation or generation.

### Important restrictions

Do not:

- invoke existing `create_routine` generation;
- generate a sample program and present it as functional;
- create empty program drafts;
- activate a program;
- send an AI request;
- add placeholder questions with fake conversational responses;
- implement the next card early.

A simple introductory screen explaining that the program designer is not yet available is sufficient.

Provide navigation back to Rob Home.

Do not create an enabled button suggesting that program generation is operational.

### Future integration

The subsequent **Build Interactive Rob Program-Design Conversation** card should replace or extend this introduction without rebuilding Rob Home.

---

## 9. Contextual shortcuts — architecture principle

Rob should have one canonical home and reusable workflows.

Current and future shortcuts elsewhere in Fitbot may open a specific Rob workflow directly.

Examples:

- Review this program with Rob.
- Ask Rob about this exercise.
- Review this routine with Rob.

These should use shared Rob workflow state and existing services.

Do not create separate Rob implementations inside each feature.

### Scope restriction

Do not add new contextual shortcuts in this card.

Keep the existing builder shortcuts working.

Their eventual consolidation can be considered after the complete program-level experience has been delivered.

---

## 10. State management and race conditions

Navigation must remain independent of request completion.

Account for:

- leaving Rob during an in-flight advice request;
- leaving a review during an in-flight review request;
- choosing a different program while a review is pending;
- returning to Home and reopening an existing result;
- submitting another review after a previous one has completed.

Ensure a delayed response for Program A cannot be displayed as though it belongs to newly selected Program B.

Use an appropriate request identity, stable target identity or equivalent current-state guard where necessary.

Avoid duplicate requests caused by rerenders or navigation.

Do not reset the entire Rob state whenever `viewMode` changes.

---

## 11. Empty and error states

Handle at minimum:

**No available programs**

Explain that a program is needed before Rob can review one.

Offer a sensible route to the existing manual program-management area.

Do not automatically create a program.

**Unavailable selected program**

If the selected program is deleted, archived or otherwise unavailable before a request, show an explicit message and allow reselection.

**Provider failure**

Retain the existing actionable retry behaviour.

**Invalid or missing review data**

Use the existing structured response validation and safe failure handling.

**Loading**

Clearly indicate that Rob is working.

Prevent duplicate submissions.

Do not disable unrelated navigation unnecessarily.

---

## 12. Persistence and safety

Navigation changes must not introduce new persistence paths.

Explicitly preserve:

- saved program definitions;
- unsaved program drafts;
- current active program;
- schedule;
- active workout;
- completed workout history;
- existing Save Program behaviour.

Rob Home, program selection and read-only review must not write to Firestore or localStorage simply because the user visits those screens.

Existing persistence triggered by unrelated legitimate app behaviour remains unchanged.

Do not call `applyRoutineProposal()` or `applyProgramProposal()` through these three primary navigation actions.

No AI response may mutate programs.

---

## 13. Avoid UI regression

The existing application already includes several complex views within `src/App.jsx`.

Keep the implementation focused.

Prefer a small number of named rendering helpers or components where this improves clarity.

Avoid extending a large conditional rendering expression into an unmaintainable collection of nested ternaries.

Do not undertake a broad App.jsx refactor.

Do not redesign:

- dashboard;
- workout tracker;
- manual routine builder;
- program editor;
- application header;
- unrelated settings.

The objective is to establish the Rob navigation model, not polish the entire app.

---

## 14. Testing requirements

Add or update automated tests using existing project conventions.

### Rob Home

- Main Rob navigation opens Home.
- All three primary actions exist.
- Each action enters the expected workflow.
- Child screens can return to Home.
- Rob navigation remains identifiable on child screens.

### Advice

- Existing advice functionality remains reachable.
- Advice is not automatically submitted on navigation.
- Existing in-memory question/response state is preserved appropriately.
- No program mutation occurs.

### Program selection

- Available programs are displayed.
- Program selection is explicit.
- Selecting Program B while Program A is open in the editor reviews B.
- Selected program identity is passed correctly to context generation.
- Empty lists and unavailable programs are handled.
- Unsaved draft representation is handled consistently.

### Program review

- Review results identify the correct program.
- Loading and failure states work.
- Retry retains the correct program target.
- Stale or out-of-order responses cannot overwrite the currently displayed review.
- Returning to Home does not cause another AI call.

### Legacy functionality

- Existing routine-review shortcut works.
- Existing single-routine proposal workflow works.
- Existing Create Routine with Rob remains available.
- Existing approval and Save Program boundaries remain unchanged.
- No new automatic program saving or activation occurs.

### Mobile and accessibility

Verify narrow viewport rendering, long program names, keyboard operation, touch targets and visible navigation.

Where the current repository has no browser-based UI test infrastructure, use the lightest appropriate testing approach rather than adding a heavyweight new framework solely for this card.

---

## 15. Documentation

Update the relevant product, technical and current-state documents.

Record:

**Implemented**

- Canonical Rob Home.
- Three primary coaching actions.
- Existing advice workflow accessed through Rob.
- Explicit program selection and read-only program review.
- Dedicated future program-design entry state.

**Not yet implemented**

- Interactive program-design conversation.
- AI-generated whole-program candidates.
- Whole-program exercise matching and recovery.
- Whole-program approval and draft creation via Rob.
- Actionable program-level modification proposals.
- Longitudinal progression analytics.

Preserve the distinction between the existing program proposal **domain contract** and the future **user-facing program designer**.

---

## 16. Acceptance criteria

This card is complete only when:

1. Selecting Rob opens a clear three-action home screen.
2. Ask Rob a Question uses existing advisory functionality.
3. Review My Program requires or presents explicit program selection.
4. The selected program, not an unrelated editor selection, drives review context.
5. Review retries retain the correct target identity.
6. Existing structured program review works without unnecessary regeneration.
7. Build Me a Program has an honest dedicated introductory state.
8. It does not trigger single-routine generation.
9. Routine reviews and proposals remain operational.
10. Existing manual program editing remains unchanged.
11. Unsaved drafts and saved program definitions are not modified through navigation or review.
12. Existing AI approval and saving boundaries remain intact.
13. Rob workflows have consistent back navigation.
14. Empty, loading, error and unavailable-target states are usable.
15. Narrow/mobile layouts are verified.
16. No new AI endpoint or unrelated persistence logic is introduced.
17. Tests pass.
18. Lint passes.
19. Production build passes.
20. Documentation reflects delivered capabilities accurately.

## Deliverables

Provide a completion debrief covering:

- Files changed.
- How the Rob workflow state is implemented.
- How explicit program selection is resolved.
- How legacy routine review entry points are preserved.
- Tests added or updated.
- Test/lint/build results.
- Any known limitations or deferred work.

**Suggested commit:** `feat: establish Rob home and unified coaching entry points`

## Explicitly out of scope

Do not implement:

- Program-design questions.
- Whole-program AI generation.
- `create_program` approval UI.
- `modify_program` generation.
- New exercise-resolution behaviour.
- Longitudinal analytics.
- Autonomous Rob monitoring.
- New billing or subscription functionality.
- Broad UI redesign.

Those belong to subsequent sequence cards.

## Product direction to preserve

Rob is the place users go for coaching.

The core experience is:

**Rob → Ask / Review / Build**

As Fitbot matures, contextual shortcuts can open those same capabilities from elsewhere in the application.

One Rob system. Multiple useful entry points. No duplicated coaching architecture.