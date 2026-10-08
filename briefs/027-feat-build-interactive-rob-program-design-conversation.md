
# Codex Implementation Brief — Build Interactive Rob Program-Design Conversation

**Project:** Fitbot  
**Phase:** Program Design  
**Priority:** High  
**Card:** ROB-PROGRAM-02  
**Dependency:** Establish Rob Home and unified coaching entry points  
**Baseline:** Commit `513daba` or latest compatible main

## ELI5 — What are we building?

I select **Rob → Build Me a Program**.

Rob welcomes me and starts gathering the information he needs to design a useful training program.

He might ask:

**Rob:** What's your main goal?

**Me:** Build muscle, particularly shoulders and arms.

**Rob:** How many days per week can you train?

**Me:** Four.

**Rob:** And how much time do you usually have?

**Me:** About an hour.

Rob should already know about preferences that genuinely exist in my Fitbot profile, but he should let me correct them.

At the end, I see something like:

**Your program brief**

- Goal: Hypertrophy
- Frequency: 4 days per week
- Session length: 60 minutes
- Priorities: Shoulders and arms
- Equipment: Confirmed by user
- Considerations: Confirmed limitations and preferences

I can edit anything, then select **Confirm program brief**.

**That is where this card finishes.**

Rob does not generate the actual program yet. That happens in the next card.

---

## 1. Architectural findings and important warning

Before implementation, inspect the latest repository state.

Existing infrastructure includes:

- Rob Home and its three primary actions.
- `ROB_WORKFLOW_STEPS.PROGRAM_BUILD`.
- Existing advice and review request pipelines.
- Existing program drafts and saved program definitions.
- Existing `create_program` and `modify_program` domain contracts.
- Existing Rob review lifecycle hardening.

### Important: current training profile is hardcoded

At the reviewed baseline, `src/services/rob/robTrainingProfile.js` contains static values, including goals, equipment, constraints and training style.

**Do not treat these hardcoded values as an authenticated user's verified personal profile.**

This is especially important if Fitbot will eventually support multiple users.

For this card:

- Inspect whether real user-specific training preferences are already persisted elsewhere.
- Only automatically populate answers from a genuinely user-specific, supported data source.
- If no trustworthy personal profile field exists, leave the answer unanswered and ask the user.
- Do not expose another user's assumptions, medical constraints or training preferences as established facts.
- Do not build a new persistent training-profile system as part of this card.
- Do not rewrite the existing Rob advice/review profile implementation unless narrowly necessary for safe separation.

This card must not compound static-profile assumptions into new program-design functionality.

---

## 2. Product experience

Rob's program designer should feel conversational but use deterministic structured state.

Avoid both extremes:

**Do not build a traditional long questionnaire** containing every possible option on one screen.

**Do not build an unrestricted AI chat** where the model has to infer requirements from arbitrary conversation history.

Preferred approach:

- Rob introduces each relevant question.
- The user responds through appropriate compact controls or free text.
- Fitbot captures the answer in structured state.
- The next unanswered requirement is presented.
- Previously answered requirements can be reviewed and edited.
- Rob displays a final summary.

The conversation should feel like coaching rather than administration.

Use natural, concise wording.

Do not over-engineer a chatbot framework.

---

## 3. Dedicated program intake model

Introduce a focused pure domain module, for example:

`src/services/rob/robProgramIntake.js`

Suggested responsibilities:

- Define requirements.
- Define supported options.
- Normalize answers.
- Validate answers.
- Determine the next missing question.
- Build the confirmation summary.
- Produce a final confirmed requirements snapshot.

Suggested structure:

```js
{
  version: 1,
  goal: null,
  daysPerWeek: null,
  sessionMinutes: null,
  priorities: [],
  equipment: [],
  constraints: "",
  equipmentConfirmed: false,
  constraintsConfirmed: false
}
```

Adapt names to existing conventions.

Avoid coupling the domain module to React, Firebase or AI transport.

The intake object must be serializable and suitable for the next card's program-generation request.

### State distinctions

Distinguish between:

- Not answered.
- Suggested from a trustworthy existing preference.
- Explicitly confirmed by the user.
- Explicitly overridden by the user.

Do not interpret empty data as implicit confirmation.

Use a simple representation rather than unnecessary metadata for every field.

---

## 4. Main training goal

Ask what the user primarily wants from the program.

Suggested choices:

- Muscle growth / hypertrophy.
- Strength.
- General fitness.
- Muscle growth and strength.
- Other / describe my goal.

Use accessible labels.

Allow an optional short explanation.

For example:

"Primarily hypertrophy, with some strength work."

Do not require the user to understand training terminology.

Normalize the choice into an explicit supported value and optional description.

---

## 5. Training frequency

Ask how many days per week the user wants to train.

Support realistic programs of at least:

- 3 days.
- 4 days.
- 5 days.

The overall domain contract currently supports up to six routines, so the intake model may support 1–6 days if compatible.

However, ensure three-, four- and five-day programs are first-class supported cases.

Do not confuse:

- Days per week.
- Number of routines.
- Rotation length.

For this feature, capture an explicit weekly training frequency.

Do not infer weekly scheduling from the current active program's number of routines.

---

## 6. Session duration

Ask approximately how long each training session should take.

Suggested choices:

- 30 minutes.
- 45 minutes.
- 60 minutes.
- 75 minutes.
- 90 minutes.
- Other reasonable duration.

Store a normalized number of minutes.

Apply sensible validation boundaries.

Allow a concise explanation when appropriate, such as:

"Usually about an hour, sometimes a little longer."

The next generation card should ultimately use this information to constrain program size, but this card does not calculate workout duration.

---

## 7. Training priorities

Ask whether the user wants to emphasise any body areas or training outcomes.

Examples:

- Shoulders.
- Arms.
- Chest.
- Back.
- Legs.
- Glutes.
- Core.
- Balanced development.

Support selecting multiple priorities.

Also allow short free-text considerations where a fixed list is insufficient.

For example:

"Shoulders and arms are the priority, but I still want adequate leg work."

Avoid automatically assuming that a user's current program reveals their personal priorities.

Capture actual preferences.

Keep priority counts and text lengths bounded.

---

## 8. Equipment and training environment

The program must eventually be appropriate for the equipment available.

Ask about the training environment:

- Commercial gym.
- Home gym.
- Both.
- Bodyweight / minimal equipment.
- Other.

Then capture relevant equipment and access restrictions.

Examples:

- Machines.
- Dumbbells.
- Barbell.
- Cables.
- Bench.
- Pull-up equipment.

Support user-entered specifics.

### Important distinction

"Commercial gym" does not guarantee every machine is available.

"Home gym" does not establish exactly what equipment the user owns.

Do not invent equipment availability.

Allow confirmation, removal and additions to suggested equipment.

If profile-backed equipment is genuinely available, present it as an editable suggestion.

If not, ask the user.

---

## 9. Constraints and exercise preferences

Ask whether anything should influence exercise selection.

Examples:

- Exercises the user dislikes.
- Movements they prefer.
- Equipment they want to avoid.
- Practical limitations.
- Training experience.
- Relevant comfort or movement restrictions.

Keep this optional where appropriate, but explicitly provide a **No additional constraints** choice.

Do not automatically infer injuries, diagnoses or contraindications from training history.

Do not offer medical diagnoses.

If a user provides a health-related limitation, preserve their wording without making further medical claims.

Keep the intake concise.

A short optional free-text field is preferable to building a complicated injury-management system.

---

## 10. Reuse genuinely available profile information

Inspect current user profile and preference persistence.

For each potential reused field:

1. Confirm that it comes from actual user-specific state.
2. Confirm that it is appropriate for program design.
3. Present it visibly to the user.
4. Allow correction or replacement.
5. Record whether it has been confirmed.

Never silently derive goal, equipment or constraints solely from hardcoded Rob persona data.

If no reliable source exists, ask the user normally.

### No new profile persistence

Do not add Firestore profile fields or migrate existing user documents during this card.

The next step is to build a working program intake experience, not redesign Fitbot's account data model.

---

## 11. Conversational progression

Use deterministic rules to decide which question comes next.

Suggested sequence:

1. Main goal.
2. Days per week.
3. Session duration.
4. Training priorities.
5. Equipment and environment.
6. Constraints and preferences.
7. Confirmation summary.

Skip a question only when the associated requirement is already explicitly confirmed within the current intake session.

Prepopulated but unconfirmed information should still receive confirmation.

Allow earlier answers to be edited without requiring the user to restart.

### Question display

Show one main question at a time.

Optionally display previous answers as a concise conversation history or progress summary.

Avoid excessively long chat bubbles or repeating every answer in full.

Use appropriate controls:

- Single choice for main goal.
- Single choice for days and duration.
- Multi-select for priorities.
- Compact choices and free text for equipment.
- Optional short text for constraints.

Do not force every answer through a generic text box.

---

## 12. Conversational tone

Rob should sound like a useful personal trainer.

Desired characteristics:

- Friendly.
- Concise.
- Practical.
- Interested in the user's actual objectives.
- Not overly enthusiastic or theatrical.
- No lengthy motivational speeches.

Sample:

**Rob:** Let's put together a program that fits your week. What's the main thing you want to achieve?

After frequency selection:

**Rob:** Four days gives us plenty to work with. How long can you usually spend training?

These are UI examples, not requirements to make AI calls for every message.

### AI usage

Prefer deterministic question wording and progression.

There is no need to call the AI provider for routine intake questions.

This card should not introduce a new paid AI request path.

Rob's persona can be expressed through authored UI text.

The model becomes necessary when the next card generates a coherent program.

---

## 13. Confirmation summary

After collecting sufficient requirements, present a clear summary:

**Your program brief**

Show:

- Goal.
- Training days per week.
- Session duration.
- Priorities.
- Equipment/environment.
- Constraints/preferences.

Use plain language rather than raw internal values.

Provide individual Edit actions or another efficient method of changing answers.

Changes must update the underlying structured requirements.

Do not maintain a separate summary object that can become inconsistent with current answers.

### Final confirmation

Provide an explicit action:

**Confirm program brief**

Validation must run again at this boundary.

On success:

- Produce an immutable or independently copied confirmed requirements snapshot.
- Mark the intake as confirmed.
- Retain it in transient state for the next card.
- Display a clear confirmation acknowledgement.

Do not call Rob program generation.

Do not create a program proposal.

Do not create a program draft.

If implementation of the next generation card is not yet available, state clearly that the requirements have been confirmed and program generation is the next planned capability.

Do not show a working Generate Program button until generation exists.

---

## 14. Navigation and session recovery

The experience must remain under the canonical Rob Home.

Required flow:

Rob Home → Build Me a Program → Intake → Confirmation.

Users should be able to:

- Return to Rob Home.
- Re-enter the intake.
- Resume the current answers.
- Edit earlier answers.
- Cancel and intentionally start again.

### Persistence policy

The intake is transient.

Preserve it while the relevant React application session remains mounted.

Do not save it to Firestore or the existing program definitions.

Do not introduce localStorage persistence just for this feature.

A full browser reload may reset the intake; document this honestly.

Do not imply durable draft recovery if it has not been implemented.

### Reset behaviour

Provide an explicit Start Over action.

Consider a confirmation when starting over would discard several completed answers.

Opening Rob Home must not silently delete an intake already in progress.

---

## 15. Validation rules

All answers must be validated in pure domain logic.

At minimum:

- Known schema version.
- Supported goal or valid other-goal description.
- Valid weekly frequency.
- Valid session duration.
- Bounded priority selection.
- Bounded equipment selections.
- Bounded free-text lengths.
- Explicit equipment confirmation.
- Explicit handling of constraints, including none.
- No malformed or unsupported values in the confirmed snapshot.

Do not silently truncate meaningful user-entered text.

Prefer clear, recoverable field errors.

Do not proceed to confirmation until required values are valid.

Avoid accepting malformed numeric values such as NaN, negative durations or fractional training days.

---

## 16. Relationship to the next generation card

The next card will consume the confirmed intake snapshot.

Design an explicit output contract now.

For example:

```js
{
  version: 1,
  goal: "hypertrophy",
  daysPerWeek: 4,
  sessionMinutes: 60,
  priorities: ["shoulders", "arms"],
  environment: "commercial_gym",
  equipment: ["machines", "cables", "dumbbells"],
  constraints: "Avoid movements that aggravate my elbow."
}
```

The precise schema may differ.

The important rule is that this object represents confirmed requirements, not conversational transcript text.

Do not embed transient navigation state or UI-specific presentation strings in the generation contract.

Later cards must be able to use it without parsing Rob's visible conversation.

---

## 17. Existing workflow protection

Preserve:

- Ask Rob a Question.
- Review My Program.
- Explicit program selection.
- Read-only reviews.
- Existing routine review shortcuts.
- Existing single-routine creation.
- Routine proposal approval.
- Exercise resolution.
- Existing Rob request lifecycle.
- Manual program builder.
- Program drafts and Save Program.
- Workout logging/history.

Avoid changing the Rob review lifecycle for this intake feature.

Do not repurpose general advice chat state as program-intake state.

They serve different purposes and should remain separate.

---

## 18. UI implementation constraints

The existing `src/App.jsx` contains substantial rendering and state-management logic.

Prefer extracting the program intake into a focused component and pure service module where practical.

Suggested structure:

`src/components/rob/RobProgramIntake.jsx`

`src/services/rob/robProgramIntake.js`

Names may be adapted.

Keep presentation and validation separate.

Rob Home should host this workflow, not contain every intake field and rule directly in its main render conditional.

### Visual expectations

- Mobile-first.
- One primary question at a time.
- Visible progress without an oversized stepper.
- Clear Next, Back and Edit controls.
- Comfortable touch targets.
- Long answers wrap.
- Keyboard-accessible fields.
- Loading states only where actual asynchronous work exists.
- No unnecessary spinners for synchronous validation.

Follow existing Fitbot styling.

Do not redesign the rest of the application.

---

## 19. Error handling

Handle:

- Incomplete required information.
- Invalid goal description.
- Invalid days or duration.
- Excessively long free text.
- Missing equipment confirmation.
- Attempting confirmation after an answer was edited.
- Starting over with existing answers.
- Returning to Home and resuming.
- Unsupported or corrupt transient state.

For invalid session state, safely reset to the earliest required unanswered step.

Do not crash the Rob area.

Do not generate fallback preferences that the user did not supply.

---

## 20. Tests

Add focused automated coverage.

### Pure intake model

- Default requirements are initially unanswered.
- Supported goals validate.
- Other goal requires valid descriptive text.
- Three-, four- and five-day programs validate.
- Invalid days and duration fail.
- Multiple priorities are supported.
- Free-text bounds are enforced.
- Equipment confirmation is required.
- No constraints is a valid explicit answer.
- Missing information is identified correctly.
- Question progression is deterministic.
- Editing an answer updates the derived summary.
- Confirmation produces a stable, independent snapshot.
- Unsupported data cannot enter the confirmed snapshot.

### Profile reuse

- Verified user-specific preferences may be suggested.
- Suggestions remain editable.
- Unconfirmed suggestions cannot silently satisfy required questions.
- No profile values means normal questioning.
- Static `robTrainingProfile` data is not implicitly treated as verified personal data.

### Navigation

- Rob Home opens the program intake.
- Returning to Home preserves the in-memory session.
- Reopening resumes existing answers.
- Start Over resets intentionally.
- Editing confirmed answers invalidates the previous confirmation.
- No generation request fires during intake.

### Nonmutation

Confirm that intake does not alter:

- `programDrafts`
- `programDefinitions`
- `schedule`
- `activeWorkout`
- `completedWorkouts`

Confirm there is no new Firestore, localStorage or AI provider dependency in the intake domain module.

### UI

Cover basic keyboard navigation, form validation, long text and narrow/mobile presentation using existing test infrastructure where possible.

Do not add a large browser-testing framework solely for this card.

If interactive mobile verification cannot run, explicitly report the limitation.

---

## 21. Documentation

Update the relevant product, technical and current-state documents.

Document:

### Implemented

- Rob program-design intake.
- Structured requirements.
- Deterministic conversational progression.
- User confirmation.
- Transient session recovery.
- Existing profile reuse only when trustworthy.

### Not implemented

- AI whole-program generation.
- Exercise matching for complete generated programs.
- Program preview and approval.
- Program draft creation from Rob.
- Actionable whole-program changes.
- Longitudinal progression analytics.

Describe the confirmed requirements object and its intended handoff to the next card.

Do not claim Rob can build a complete program until actual generation and approval are implemented.

---

## 22. Acceptance criteria

This card is complete when:

1. Build Me a Program opens an actual intake experience.
2. Rob asks for meaningful program requirements.
3. Goal, frequency, duration, priorities, equipment and constraints are captured.
4. Three-, four- and five-day programs are supported.
5. Question progression is deterministic.
6. Known trustworthy preferences may be suggested but remain editable.
7. Hardcoded Rob profile data is not silently used as authenticated personal preference data.
8. Missing details are asked rather than invented.
9. The user can navigate backwards and correct earlier answers.
10. The user can return to Rob Home and resume within the same session.
11. Start Over works safely.
12. A clear plain-language requirements summary is shown.
13. Explicit confirmation produces a validated snapshot.
14. Editing answers after confirmation invalidates that confirmation.
15. No AI generation request occurs.
16. No program proposal or draft is created.
17. No workout, program, schedule or history state is mutated.
18. Existing Rob advice, reviews and routine-level workflows remain functional.
19. Mobile and accessibility behaviour are verified where tooling permits.
20. Tests, lint and production build pass.
21. Documentation accurately describes the new intake capability and outstanding work.

## Implementation debrief required

Report:

- Files changed.
- Intake schema.
- Validation rules.
- Profile-source decisions.
- Navigation/session behaviour.
- Confirmed requirements snapshot shape.
- Tests added or updated.
- Test, lint and build results.
- Any remaining limitations.

**Suggested commit:** `feat: add conversational Rob program intake`

## Out of scope

Do not implement:

- Actual whole-program AI generation.
- `create_program` materialisation or application.
- Exercise matching/recovery for generated programs.
- Whole-program proposal preview.
- Human approval of a generated program.
- Firestore training-profile persistence.
- Automatic program activation or scheduling.
- Longitudinal progression analytics.
- New subscription or billing functionality.
- Broad program builder redesign.

## Product north star

This card establishes:

**Rob → Build Me a Program → Guided Questions → Confirm Requirements**

The next card will extend that experience to:

**Confirmed Requirements → Rob Generates Complete Program Candidate**

Later cards will add:

**Exercise Resolution → Program Preview → Approval → Editable Draft → Save Program**

Keep those boundaries intact so we can deliver the actual program-building experience without repeatedly rebuilding Rob's UI.