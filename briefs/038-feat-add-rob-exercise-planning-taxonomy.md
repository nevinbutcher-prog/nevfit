# Codex — Rob Coaching Engine, Card 1

**Title:** Exercise Planning Taxonomy Foundation
**Project:** Fitbot / Nevfit
**Type:** Implementation
**Dependency:** Completed coaching architecture investigation

## Objective

Create a versioned, auditable exercise-planning taxonomy that enables Rob to reason about exercise stimulus, movement patterns, fatigue interactions and exercise roles.

This is foundational infrastructure for the future weekly-program planning engine.

Do not implement the planning engine itself.

## Requirements

1. Preserve existing WGER IDs, catalogue records, equipment eligibility and generation behaviour.

2. Create a reusable planning profile containing:
   - Primary muscle stimulus.
   - Secondary muscle involvement, distinguishing meaningful, supporting and unknown where evidence permits.
   - Movement pattern.
   - Exercise role: compound, isolation, trunk or conditioning.
   - Relevant fatigue and sequencing tags.
   - Setup demands.
   - Conventionality classification.
   - Metadata confidence and provenance.

3. Use versioned normalisation rules and a small, maintainable reviewed-exceptions mechanism.

4. Distinguish source-provided data, inferred classifications and manually reviewed information. Do not silently upgrade inferred metadata to verified status.

5. Represent unknown information explicitly. Missing secondary-muscle data must not imply that an exercise has no secondary muscle involvement.

6. Ensure exercises with overlapping muscle demands can be identified without introducing hardcoded exercise-pair restrictions.

7. Keep the planning taxonomy separate from immutable catalogue identity and equipment-authorisation logic.

8. Add deterministic audit tooling reporting classification coverage, low-confidence records, unknown fields and contradictory classifications.

9. Add representative regression fixtures for pressing, pulling, squatting, hinging, isolation and core movements, including:
   - Bench press.
   - Shoulder press.
   - Lateral raise.
   - Lat pulldown.
   - Seated row.
   - Squat.
   - Romanian deadlift.
   - Leg curl.
   - Biceps curl.
   - Triceps extension.

10. Preserve current app and Firebase integration behaviour. Do not switch generation to the new metadata yet.

## Validation

- Verify stable IDs and equipment filtering are unchanged.
- Confirm catalogue refreshes preserve versioned planning metadata appropriately.
- Test primary/secondary muscle representation and unknown states.
- Test movement-pattern classification.
- Test fatigue overlap and sequencing metadata.
- Audit representative records for implausible classifications.
- Run existing tests, lint and production build.

## Out of scope

- Weekly workload targets.
- AI blueprint generation.
- Exercise selection algorithm changes.
- New quality rejection gates.
- Model upgrades.
- Intake UI changes.
- Program preview changes.
- Paid AI calls.

## Debrief

Report:

- Taxonomy architecture and files.
- Coverage of all 907 source records.
- Confidence breakdown.
- Unknown and ambiguous classifications.
- Representative exercise profiles.
- Audit and test results.
- Remaining gaps before Card 2.

Do not deploy unless required for the scoped changes. Do not modify the active generation pipeline.

**Success:** Fitbot gains a trustworthy, maintainable model of what exercises train and how they interact, without disrupting the working Rob generator.
