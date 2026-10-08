
# Codex Implementation Brief — Establish Rob Home and Consolidate Coaching Entry Points

**Project:** Fitbot  
**Phase:** Rob Program-Level Coaching  
**Priority:** High  
**Type:** Bridging card — before further Rob hardening

## ELI5 — What are we building?

When I select **Rob** from Fitbot's navigation, I want to arrive at one clear coaching home with three choices:

1. **Ask Rob a question** — talk to Rob about training.
2. **Review my program** — choose an existing program and get Rob's assessment.
3. **Build me a program** — begin creating an entire training program with Rob.

Reuse what we've already built. Don't create another collection of AI controls scattered throughout Fitbot.

The program builder should remain a normal manual program builder.

**This card establishes the navigation and workflows. It does not yet generate entire programs.**

## 1. Existing architecture

Inspect the current implementation before making changes.

Preserve:

- Existing Rob chat/question capability.
- Existing program review capability and its context-building logic.
- Existing routine review and proposal infrastructure.
- Exercise resolution and human approval infrastructure.
- New `create_program` and `modify_program` domain contracts from commit `0b1686f`.
- Manual program creation and editing.
- Current workout tracking, history and persistence.

Do not replace working services merely to achieve a different UI layout.

## 2. Rob becomes the canonical coaching destination

Use the existing Rob navigation entry and design a clear landing state.

Primary actions:

**Ask Rob a Question**

Description: Get help with training, exercises and progression.

**Review My Program**

Description: Have Rob analyse an existing training program.

**Build Me a Program**

Description: Work with Rob to design a complete training program.

Use the existing Fitbot design system, spacing, typography, navigation and mobile conventions.

Avoid introducing a new design language or unnecessarily redesigning surrounding application screens.

## 3. Ask Rob a Question

Connect to the existing general Rob coaching capability.

Requirements:

- Preserve the current supported context and conversation behaviour.
- Retain existing error and loading handling.
- Provide an obvious way back to Rob Home.
- Do not duplicate the underlying AI client or request pipeline.
- Avoid changing prompt logic without a demonstrated need.

## 4. Review My Program

Flow:

Rob Home → Review My Program → Select Program → Existing Program Review

Requirements:

- List the user's available programs.
- Display clear program names.
- Do not assume the active program is necessarily the desired one.
- If a program is already selected through a future contextual shortcut, it may be preselected.
- Use the existing program-level review request and rendering pipeline.
- Preserve current review findings and recommendations.
- Provide appropriate empty, loading, error and retry states.
- Allow returning to program selection without leaving Rob.

Do not implement `modify_program` proposal generation in this card.

## 5. Build Me a Program

Establish the entry point and dedicated workflow location under Rob.

The intended eventual flow is:

Rob Home → Build Me a Program → Coaching Questions → Complete Program Proposal → Preview → Approval → Editable Draft → Save Program.

**This card does not implement the AI conversation or proposal-generation steps.**

Do not display an apparently functional **Generate Program** action that cannot deliver a program.

Until the next implementation card, use a concise, honest introductory state explaining the upcoming workflow. If the application already has a suitable reusable program-design experience, only connect it if doing so stays within this card's scope and does not misrepresent routine creation as program creation.

Do not route this action to the existing single-routine generator.

## 6. Preserve routine-level work

Do not delete existing routine-level functionality.

Where current routine-level Rob actions already exist in the program builder:

- Preserve functional behaviour.
- Avoid adding new competing entry points.
- Do not undertake a broad removal/migration in this card.
- Document any legacy contextual actions that should later become shortcuts into Rob.

Routine-level coaching can remain available as a secondary capability.

## 7. Shared workflow architecture

The three Rob actions should use a shared navigation/workflow model.

Avoid building three unrelated Rob screens with duplicated state-management logic.

The implementation should support future contextual shortcuts that open Rob with relevant preselected context.

For example:

- Review a particular program with Rob.
- Ask about a specific exercise.
- Discuss a progression insight.

**Do not implement those shortcuts now.** Only avoid architecture that would prevent them.

## 8. UX requirements

Keep the interface restrained and mobile-first.

- Clear page title and three primary actions.
- Only one obvious main navigation path.
- Consistent back navigation.
- No nested modal maze.
- No floating controls obscuring content.
- No duplicated Rob action menus.
- Proper small-screen behaviour.
- Preserve the selected program while moving between review-related screens where appropriate.
- No unintended loss of an existing conversation when navigating away and back, subject to existing persistence rules.

## 9. Safety and persistence

This card changes navigation and workflow presentation, not proposal authority.

- No automatic program mutation.
- No automatic activation of programs.
- No new AI persistence paths.
- No changes to Save Program semantics.
- No bypass of proposal validation or human approval.
- Preserve existing authentication and error-handling behaviour.

## 10. Validation and tests

Add or update tests covering:

- Rob Home exposes all three primary actions.
- General question flow reaches the existing coaching functionality.
- Program review requires or obtains an explicit program selection.
- Selected program identity reaches the existing review context correctly.
- Empty program lists are handled.
- Navigation back to Rob Home works.
- Build Program does not mistakenly invoke single-routine generation.
- Existing routine proposals remain functional.
- No new program mutation/persistence path is introduced.
- Narrow and mobile viewport usability where practical.

Run existing tests, lint and production build.

## 11. Documentation

Update the product, technical and current-state docs to distinguish:

**Now implemented**
- Rob Home.
- Unified primary coaching navigation.
- Existing general questions and program review accessible from Rob.

**Still pending**
- Interactive program-design conversation.
- AI-generated `create_program` candidates.
- Whole-program exercise resolution.
- Whole-program preview and approval.
- AI-generated `modify_program` recommendations.
- Longitudinal progression coaching.

Document the canonical Rob Home principle and future contextual shortcuts.

## 12. Acceptance criteria

Complete when:

1. Rob has a clearly identifiable home.
2. Three primary actions are presented.
3. Existing question functionality remains accessible.
4. Existing program review works after explicit program selection.
5. Build Program has a dedicated, honest entry point without using single-routine creation as a substitute.
6. Existing routine-level capabilities are preserved.
7. No redundant Rob service architecture is introduced.
8. No unnecessary changes to the manual builder occur.
9. No program data changes simply from navigating or reviewing.
10. The experience remains coherent on mobile.
11. Tests, lint and build pass.
12. Documentation accurately reflects implemented versus forthcoming functionality.

**Suggested commit:** `feat: establish Rob home and coaching entry points`

## Out of scope

Do not implement whole-program AI generation, coaching questions, program proposal materialisation, exercise resolution improvements, approval flows, progression analytics or unsolicited UI redesigns.

Those require dedicated subsequent cards.
