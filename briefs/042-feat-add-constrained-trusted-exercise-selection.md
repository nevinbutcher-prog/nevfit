
# Fitbot — Rob Coaching Engine: Card 5

**Title:** Constrained Trusted Exercise Selection
**Type:** Implementation — isolated, non-production
**Dependencies:** Cards 1–4, including commit `af1c3c5`
**Priority:** High

## 1. Objective

Build a deterministic exercise-fulfilment engine that transforms a validated weekly blueprint into a complete, executable workout-program candidate.

Every selected exercise must:

- Exist in the trusted WGER catalogue.
- Be compatible with confirmed equipment and exclusions.
- Fulfil the intended blueprint slot.
- Contribute appropriately to the whole training week.
- Be sequenced intelligently.
- Have an explainable selection rationale.

Preserve the existing production generator until the new pipeline is evaluated end to end.

## 2. Exercise selection principles

Select exercises based on training purpose, not arbitrary catalogue ranking or name similarity alone.

Consider:

- Primary muscle stimulus.
- Meaningful secondary involvement.
- Movement pattern.
- Exercise role.
- Equipment requirements.
- Conventionality and classification confidence.
- Exercise difficulty and setup demands.
- Existing selections elsewhere in the week.
- Fatigue overlap and intended sequencing.

Prefer well-understood conventional exercises when they fulfil the blueprint effectively.

Allow specialist movements when justified.

Do not build a small fixed exercise whitelist or hardcode specific routines.

## 3. Exercise variety and complementary selection

Support purposeful variation across the training week.

For example:

- Incline chest pressing in one session and flat pressing in another.
- Lat pulldowns and pull-ups distributed across separate sessions.
- Leg curls and Romanian deadlifts providing different hamstring training demands.
- Different lateral-raise variations where appropriate.

Distinguish useful variation from novelty.

Repeated exercises may be appropriate for technical progression, limited equipment or specific goals.

**Do not enforce a universal one-exercise-per-week rule.**

Avoid repeatedly selecting nearly identical exercises when suitable complementary options exist.

## 4. Blueprint-slot fulfilment

For each validated slot:

1. Identify eligible catalogue candidates.
2. Resolve trusted planning taxonomy profiles.
3. Match primary stimulus, movement pattern and role.
4. Consider the intended weekly programming context.
5. Rank compatible candidates deterministically.
6. Select an appropriate exercise.
7. Record the reason for selection.

A slot must not be fulfilled by an incompatible exercise merely because its name appears similar.

Do not silently substitute a different muscle group or movement pattern.

## 5. Taxonomy uncertainty

The Card 1 audit identified substantial metadata gaps.

Handle these explicitly.

- Prefer reviewed and high-confidence profiles where otherwise suitable.
- Allow inferred classifications where justified.
- Do not assume unknown metadata means no muscle involvement.
- Do not fabricate muscle recruitment or fatigue characteristics.
- Return a clear unresolved-slot diagnostic when no trustworthy match exists.
- Preserve the full catalogue for existing workouts and search.

Do not require all 907 records to be manually classified before this card can succeed.

## 6. Whole-program selection

Selection must consider the complete weekly blueprint.

Avoid independently selecting exercises for each day without checking the other sessions.

Evaluate:

- Weekly exercise diversity.
- Repeated movement patterns.
- Redundant roles.
- Equipment practicality.
- Complementary selections.
- Fatigue distribution.
- Appropriate progression opportunities.

A deterministic ranking approach with limited backtracking is acceptable if needed.

Do not introduce an expensive optimisation framework without evidence.

## 7. Exercise sequencing

Respect the blueprint's intended training priorities.

Consider:

- Priority movements.
- Compound exercise demands.
- Adjacent fatigue interactions.
- Accumulated pressing or pulling fatigue.
- Complementary pairings.
- Equipment transitions.
- Isolation movements used for targeted additional stimulus.

Do not automatically prohibit overlapping exercises.

A challenging 21-set chest-emphasis session containing pressing, flies, shoulder work and leg exercises must remain feasible.

Preserve the intended blueprint sequence unless a justified, explicitly reported adjustment is necessary.

## 8. Prescription preservation

Carry the blueprint's sets, repetitions, rests and session structure into the executable candidate.

Do not arbitrarily reduce workload.

For example, seven three-set slots should normally produce seven exercise prescriptions totalling 21 working sets.

Do not silently merge slots, omit exercises or substitute lower-volume prescriptions to simplify selection.

Any infeasible slot must be reported explicitly.

## 9. Trust and validation

Preserve existing server-authoritative catalogue and equipment eligibility rules.

No client-supplied exercise identity or planning metadata may override trusted server data.

Selection results must be validated against:

- The original confirmed requirements.
- The source blueprint.
- The authorised exercise catalogue.
- Current equipment capabilities.
- Explicit exclusions.
- Existing program-candidate validation requirements.

The completed program must be compatible with existing transient proposal materialisation.

No automatic saving, scheduling or activation.

## 10. Quality assessment

Evaluate completed selections using Card 3's quality scorecard.

The final selected exercises, not the AI's declared stimulus intentions, must determine actual muscle coverage and interaction assessments.

Return explainable selection rationales and advisory quality concerns.

Distinguish:

- Structural fulfilment failures.
- Equipment or exclusion conflicts.
- Missing trustworthy catalogue matches.
- Programming-quality warnings.
- Metadata uncertainty.

Do not introduce automatic paid retries or quality-based rejection.

## 11. Required deterministic fixtures

Include:

1. Four-day, 75-minute balanced hypertrophy with shoulder emphasis.
2. The original shoulder-dominated failure scenarios.
3. The seven-exercise, 21-set chest-emphasis session.
4. A complementary back/pull session.
5. Purposeful exercise variation across four sessions.
6. Legitimate exercise repetition across sessions.
7. Bench press and overhead press fatigue interactions.
8. Pull-up versus pulldown selection.
9. Leg curl versus hip-hinge selection.
10. Missing or conflicting equipment.
11. Explicit exercise exclusions.
12. Low-confidence and unknown taxonomy records.
13. No suitable exercise for a required slot.
14. Infeasible combinations of blueprint slots.
15. Preservation of working-set totals.
16. Deterministic, repeatable selection results.

Tests must verify actual selected identities, compatibility, rationale and final-program quality.

No paid AI calls.

## 12. Integration boundaries

Implement an isolated orchestration function that accepts:

- Validated blueprint.
- Confirmed requirements.
- Trusted catalogue.
- Verified planning taxonomy.

Return:

- Completed program candidate when fully feasible.
- Exercise-selection provenance and rationale.
- Advisory scorecard.
- Explicit unresolved-slot diagnostics where applicable.

Do not expose the new pipeline through the production Firebase callable yet.

Do not modify the existing workout tracker, routine builder, intake wizard or preview.

## 13. Validation

Run full app and Functions tests, lint and production build.

Report:

- Selection architecture.
- Candidate-ranking strategy.
- How whole-week variety is considered.
- How confidence and unknown metadata affect decisions.
- Representative selected programs.
- Feasibility/failure handling.
- Regression results.
- Any taxonomy improvements required.
- Limitations before end-to-end integration.

Commit and push the changes.

Do not deploy, activate production generation or make paid AI calls.

Stop for independent review before the next card.

## 14. Acceptance criteria

Card 5 is complete when:

1. Validated blueprints can be fulfilled with real trusted exercises.
2. Equipment eligibility and exclusions remain authoritative.
3. Exercise selection considers the full training week.
4. Purposeful variety and repetition are both supported.
5. Working sets and prescriptions are preserved.
6. Exercise sequencing considers priorities and fatigue.
7. Incompatible or unfulfillable slots are reported rather than silently substituted.
8. Selection rationales are explainable.
9. The final program can be assessed using trusted exercise metadata.
10. Existing production behaviour remains unchanged.
11. Automated tests pass.
12. Changes are committed and pushed without deployment.

**Product principle:** Rob should choose exercises because they fulfil a well-designed training prescription—not simply because they're available in the catalogue.
