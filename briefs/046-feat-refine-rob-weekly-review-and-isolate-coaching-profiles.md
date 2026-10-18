# Nevfit — Rob Weekly Review Refinement and Profile Isolation

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Checkpoint:** Correct the existing weekly-review experience before user acceptance.

## User intent

Rob should provide concise, competent and personalised weekly coaching without requiring unnecessary interaction.

He must understand the individual athlete's training methodology and preferences without applying one user's personal circumstances to another account.

## 1. Simplify weekly review

Remove the manual date picker.

The primary action should simply be **Review my week**.

- Automatically use the current local Monday–Sunday week.
- Compare against the immediately preceding Monday–Sunday week.
- Clearly identify when the current week is incomplete.
- Continue using completed strength workouts, logged runs and recorded steps.
- Preserve existing missing-data safeguards.
- Avoid treating unrecorded activity as inactivity.
- No automatic AI calls when opening Rob.

Retain the date-range information in the result, presented in a readable format.

## 2. Improve coaching quality and brevity

Target approximately 100–150 words for a normal weekly assessment.

Rob should:

- Lead with an overall coaching judgement.
- Identify two or three meaningful observations.
- Give one or two specific next actions.
- Consider combined resistance training, running and walking workload.
- Interpret changes in weight and repetitions intelligently.
- Avoid treating increased training volume as automatically beneficial.
- Avoid generic praise, excessive statistics and corporate-report language.
- Never fabricate recovery, pain, effort or progression evidence.

A concise response must still acknowledge material limitations or missing evidence.

Do not implement rigid text truncation that cuts off meaningful sentences.

## 3. Support individual progression preferences

Rob must understand double progression as a training method.

For a user who follows double progression:

- Progress repetitions within a prescribed rep range.
- Once the upper target has been achieved according to that user's progression rule, increase the working weight.
- Repetitions may then return towards the lower end of the range.
- A deliberate load increase with lower repetitions must not automatically be described as regression.

Distinguish an explicitly recorded progression preference from an inferred progression pattern.

Do not assume every user follows double progression.

The current user's preference is double progression, but it must not be embedded as a universal coaching instruction.

## 4. Remove hardcoded personal coaching assumptions

Inspect all relevant Rob pathways that consume `robTrainingProfile.js` or equivalent static profile information.

Separate:

**Shared coaching knowledge**
- General training principles.
- Exercise programming guidance.
- Safety and uncertainty handling.
- Knowledge of different progression methods.

**Per-user coaching context**
- Training goals and priorities.
- Training setting and available equipment.
- Exercise likes and dislikes.
- Training constraints.
- Preferred progression method.
- Preferred session duration and frequency.

Implement the smallest appropriate account-scoped profile foundation using existing authentication and Firestore architecture.

Requirements:

- Each authenticated user has independent coaching preferences.
- A new user must not inherit another user's personal profile.
- Missing preferences remain unknown rather than being populated with the original developer's values.
- Preserve current user data and existing workouts.
- Provide a minimal, usable way to establish or update essential personal preferences without creating a large onboarding workflow.
- Do not silently assign a user's progression method from workout history.
- Existing program-generation intake requirements must continue to take precedence for the particular program being requested.

Do not implement an extensive profile-management system, conversational memory or automated preference learning.

If existing static-profile consumers require broader architectural changes, identify those dependencies and implement only the smallest safe compatibility changes within this checkpoint.

## 5. Switch weekly review to GPT-4.1

Configure the `robWeeklyReview` Firebase route to use:

`openai/gpt-4.1`

Use the existing route-specific model configuration.

- Do not change other Rob model routes.
- Keep the API key server-side.
- Confirm the deployed function actually uses GPT-4.1.
- Report any deployment or configuration requirements.
- Do not make additional paid evaluation calls without approval.

The user has approved this production model change for the weekly-review route only.

## 6. Preserve data integrity and security

- Keep weekly reviews read-only.
- Ensure profile reads are scoped to the authenticated user.
- Do not accept a client-supplied UID as authorisation.
- Reuse existing Firestore access controls where appropriate.
- Preserve workout, health and program records.
- Prevent personal profile information leaking between accounts.
- Clearly handle unavailable or incomplete profile data.

## 7. Tests and validation

Cover:

- Automatic current-week selection, including Monday and Sunday boundaries.
- Partial current weeks and missing data.
- Correct strength, run and step comparisons.
- Double-progression interpretation when the preference is explicitly recorded.
- Behaviour when progression preference is absent or different.
- Isolation of two users with distinct goals, equipment and preferences.
- No inherited developer-specific profile for new users.
- Existing Rob advice, routine review and program generation remain operational.
- No workout or health data modification.
- Weekly model configuration does not affect other AI routes.

Run relevant lint, build and automated tests.

## Scope exclusions

Do not implement:

- Dashboard coaching tips or review persistence.
- Conversational memory.
- Automated training-plan changes.
- Program-generation redesign.
- Equipment catalogue.
- New activity tracking.
- Broad Rob UI redesign.

## Delivery

Follow the agreed NevDev workflow.

Report changed files, commit, tests, Firebase deployment status, configuration changes and remaining manual verification.

Submit for independent code review before user acceptance.

**Success criterion:** A signed-in user can select Review my week and receive a brief, useful, account-personalised assessment of their actual training, without another user's preferences influencing the result.
