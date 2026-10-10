# Codex Implementation Brief — Card 04C

**Project:** Fitbot (Nevfit)
**Card:** ROB-PROGRAM-04C
**Title:** Balanced Weekly Programming and Realistic Session Volume
**Priority:** High
**Dependency:** Card 04B — Catalogue-Grounded Generation

## 1. Objective

Improve Rob's ability to design coherent, balanced, effective multi-day training programs.

The current implementation produces structurally valid programs but does not adequately account for weekly muscle-group distribution, exercise selection, training frequency or requested session duration.

**Target outcome:** Rob produces a coordinated training week with appropriate exercise variety, reasonable workload and additional emphasis on selected muscles without neglecting the rest of the body.

Preserve the successful catalogue-grounded generation architecture.

## 2. Confirmed Real-World Failure

The user requested:

- Goal: Hypertrophy.
- Frequency: Four days per week.
- Duration: 75 minutes per session.
- Priorities: **Shoulders AND Balanced Development**, selected as separate checkboxes.
- Environment: Commercial gym.

Rob generated:

| Routine | Exercises | Working sets |
|---|---:|---:|
| Shoulder Power Day | 4 | 13 |
| Shoulder Isolation Day | 4 | 14 |
| Compound Shoulder and Back Day | 4 | 13 |
| Dynamic Shoulder Day | 5 | 16 |

The program included excessive shoulder isolation and pressing volume, repeated front raises and very limited chest, back, quadriceps, hamstring and arm coverage.

It also included unusual exercise selections such as bear crawl pull-through and punches, despite having access to a much larger conventional exercise catalogue.

This is a programming-quality failure, not an exercise-identity failure.

Use this scenario as a deterministic regression case.

## 3. Distinguish Balanced Development From Muscle Priorities

The wizard currently presents Balanced Development alongside muscle-group priorities.

Rob must interpret these selections according to their meaning.

**Balanced Development** establishes a whole-program coverage requirement.

**Shoulders, Arms, Chest, Back, Legs, Glutes and Core** specify areas receiving additional attention within that program.

For example:

`Balanced Development + Shoulders`

Means:

Design a balanced weekly hypertrophy program covering the major muscle groups, with additional appropriate shoulder volume and exercise selection.

It does not mean:

Design four shoulder-focused sessions with occasional unrelated exercises.

### Requirements

- Support multiple simultaneous priorities.
- Do not allow one muscle priority to eliminate other major muscle groups.
- Distribute emphasised-muscle workload sensibly across the week.
- Consider overlapping muscle recruitment from compound movements.
- Respect recovery between demanding sessions.
- Avoid repeatedly prescribing substantially similar exercises without clear purpose.
- Apply the same principles regardless of which muscle group is prioritised.

Preserve the existing intake model where practical.

Do not redesign the wizard in this card.

## 4. Establish a Weekly Program Structure

Rob must plan the training week as a coordinated whole before selecting individual exercises.

For four training days, legitimate structures could include:

- Upper/lower repeated.
- Push/pull/legs plus a balanced accessory day.
- Full-body variations.
- Another coherent split suited to the user's priorities.

Do not hardcode a particular split.

The program should demonstrate:

- Logical exercise distribution across routines.
- Appropriate frequency for major muscle groups.
- Balanced compound and isolation work.
- Sufficient movement-pattern diversity.
- Attention to weekly workload and recovery.
- Additional emphasis for selected muscles without disproportionate neglect elsewhere.

Workout names and descriptions must accurately represent the exercises prescribed.

Avoid four near-identical routines with different titles.

## 5. Session Duration and Workload

Rob must make realistic use of the user's requested session duration.

The existing 75-minute programs containing 4–5 exercises and 13–16 working sets appear underfilled relative to the user's stated preferences and intended hypertrophy workload.

For typical 60–75-minute hypertrophy sessions, use approximately **5–8 exercises** as planning guidance.

For a 75-minute session, around 6–8 exercises is a useful starting expectation, but not a hard requirement.

Do not add arbitrary exercises merely to reach a count.

### Duration assessment

Estimate session duration conservatively using:

- Working sets.
- Repetition ranges.
- Exercise execution time.
- Rest periods.
- Equipment transitions.
- Warm-up allowance.

Supersets should affect the estimate appropriately.

Do not claim precise workout duration where it cannot be established.

Differentiate between an intentionally concise session and a session that substantially underutilises the requested time.

Preserve user flexibility around longer rest periods and fewer exercises.

## 6. Weekly Workload and Recovery

Add conservative programming guidance for weekly muscle-group workload.

Rob should assess:

- Direct and indirect stimulus.
- Frequency across the week.
- Repetition of demanding movement patterns.
- Recovery opportunities.
- Excessive concentration of isolation work.
- Major muscle groups receiving little or no meaningful work.

Avoid treating all compound exercises as providing equal training stimulus to every involved muscle.

Do not introduce rigid universal weekly-set prescriptions.

Where experience level, recovery ability or training history is unknown, use conservative programming assumptions.

Do not invent user limitations or medical information.

## 7. Improve Exercise Selection

Continue selecting exclusively from the verified, authorised WGER catalogue.

Prioritise conventional, well-understood exercises when they fulfil the programming requirements.

Unusual movements are permitted when they have a legitimate purpose, but should not displace more appropriate foundational exercises merely because they are available in WGER.

Improve candidate ranking and selection where necessary so the AI receives a useful balance of:

- Major compound exercises.
- Horizontal and vertical pushing.
- Horizontal and vertical pulling.
- Knee-dominant and hip-hinge movements.
- Relevant isolation exercises.
- Core exercises where appropriate.

Do not introduce another provider, arbitrary blacklist or small hardcoded whitelist.

Retain equipment compatibility, explicit exclusions and future My Gym integration boundaries.

## 8. Generation Prompt and Output Contract

Review the existing `programGenerationMessages()` implementation.

The current example contains only four exercises and may be biasing generated programs toward short sessions.

Replace or simplify examples where appropriate.

Provide clear instructions for:

- Planning the weekly structure.
- Distinguishing balanced development from muscle emphasis.
- Selecting appropriate exercises.
- Distributing weekly workload.
- Avoiding redundant exercise variations.
- Matching practical workload to session duration.

Keep prompts concise and efficient.

Preserve the existing strict output schema, exercise-ID enum, server validation, superset handling and transient proposal generation.

Do not increase token budgets without evidence.

Do not automatically regenerate programs.

## 9. Deterministic Program-Quality Assessment

Extend the existing `assessProgramQuality()` functionality.

Introduce an explainable, conservative quality assessment of the **whole program**, not merely individual exercise counts.

Assess:

1. Major muscle-group coverage.
2. Selected muscle emphasis relative to overall development.
3. Movement-pattern distribution.
4. Excessive repetition of near-identical exercises.
5. Session workload relative to requested duration.
6. Weekly workload concentration.
7. Recovery and distribution of demanding exercises.

Use the trusted exercise catalogue metadata.

Recognise that WGER muscle and movement labels are imperfect; avoid false precision.

### Quality concerns

Return structured concern codes with relevant routine indices and explanatory metadata where appropriate.

For example:

- `major_muscle_group_underrepresented`
- `priority_overconcentration`
- `limited_movement_pattern_coverage`
- `redundant_exercise_selection`
- `underfilled_duration`

Distinguish serious structural failures from programming-quality concerns.

Do not automatically reject every program that triggers a heuristic.

However, identify whether obviously unacceptable programs should be prevented from reaching the normal success state, using a conservative policy that does not create repeated paid failures.

**Provide a recommendation on that policy before implementing any new hard rejection rules.**

## 10. Tests

Use deterministic catalogue-backed fixtures and mocked model responses.

Required coverage:

- Four-day hypertrophy with Balanced Development + Shoulders.
- Balanced Development + Arms.
- Balanced Development + Back.
- Multiple muscle priorities.
- Balanced Development without additional priorities.
- Three-, four- and five-day structures.
- 45-, 60- and 75-minute sessions.
- Reasonable weekly distribution of compound and isolation work.
- Missing major muscle groups.
- Excessive single-muscle concentration.
- Redundant exercise variations.
- Valid intentionally concise sessions.
- Superset-aware workload estimates.
- Equipment eligibility and exclusions.
- Trusted exercise identities.
- Valid transient proposal materialisation.
- No matching interface or automatic persistence.

The previously generated four-day shoulder-dominant program should be captured as a sanitised negative-quality fixture and flagged for appropriate reasons.

Include positive fixtures demonstrating that balanced programs with shoulder emphasis do not trigger the same concerns.

Tests must assert meaningful program-quality outcomes, not simply the presence of new prompt wording.

Do not make paid AI calls during automated testing.

Run full app tests, Functions tests, lint and production build.

## 11. Scope Boundaries

Do not implement:

- My Gym.
- New user preference settings.
- A redesigned intake wizard.
- Card 05 editing or approval.
- Another exercise provider.
- A catalogue architecture rewrite.
- Automatic paid retries.
- Conversational program refinement.
- New workout-history analysis features.
- Automatic save, activation or scheduling.

Preserve existing security and proposal-validation boundaries.

## 12. Implementation Approach

First inspect the existing generation prompt, catalogue metadata, candidate-selection logic and quality-assessment functions.

Identify which problems are best addressed through:

- Better generation instructions.
- Improved catalogue candidate selection.
- Deterministic program-quality analysis.

Prefer small, evidence-backed changes over introducing a complex planning engine.

Before implementing any hard quality rejection policy or additional AI generation pass, report the proposed approach and obtain approval.

Otherwise proceed with the scoped implementation and tests.

## 13. Completion Criteria

Card 04C is complete when:

1. Balanced Development reliably establishes whole-program coverage.
2. Muscle-group priorities provide emphasis without dominating every routine.
3. Weekly exercise distribution is coherent.
4. Session workloads reasonably reflect requested training time.
5. Repeated or unusual exercises have a defensible programming purpose.
6. Quality checks detect the known shoulder-heavy regression case.
7. Balanced positive fixtures pass without inappropriate warnings.
8. Existing trusted-ID generation and proposal materialisation remain intact.
9. No automatic paid retries or new persistence behaviour are introduced.
10. Tests, lint and build pass.
11. A live generated program demonstrates meaningful improvement over the previous four-day shoulder-dominant result.

## 14. Debrief

Report:

- Root causes of the shoulder-heavy generation.
- Changes to priority interpretation.
- Changes to weekly planning instructions.
- Session-duration and workload approach.
- Changes to exercise selection.
- Quality-assessment rules and their limitations.
- Negative and positive fixture results.
- Any recommended hard-rejection policy, separately for approval.
- Test results.
- Deployment status.
- Remaining limitations.

**Final product principle:** Rob should produce a coherent training program that develops the whole body according to the user's goals, with sensible emphasis, realistic workloads and appropriate recovery—not simply repeat the selected priority muscle across every session.
