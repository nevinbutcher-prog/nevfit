# Codex Brief — Add Lying Dumbbell Curl

**Project:** NevFit  
**Checkpoint:** Add one exercise to the NevFit catalogue  
**Priority:** Low complexity

## Objective

Add **Lying Dumbbell Curl** as a selectable exercise in the existing NevFit exercise library.

## Exercise definition

- **Name:** Lying Dumbbell Curl
- **Proposed ID:** `nevfit-lying-dumbbell-curl`
- **Primary muscle:** Biceps
- **Equipment:** Dumbbells and flat bench
- **Movement:** Elbow flexion

**Setup:** Lie face-up perpendicular to a flat bench, with shoulders and upper back supported, torso extending off the bench and feet planted firmly on the floor. Allow the arms to hang behind the shoulder line, then curl the dumbbells using controlled elbow flexion.

This is distinct from incline dumbbell curls and chest-supported spider curls.

## Implementation

1. Follow `AGENTS.md` and `docs/nevdev_workflow.md`.
2. Add one permanent exercise identity using the existing catalogue registry conventions.
3. Add the corresponding exercise record with appropriate taxonomy, equipment and movement metadata.
4. Follow the established catalogue maintenance and generation process, updating dependent artefacts only where necessary.
5. Ensure the exercise is searchable, selectable and usable in routines and workout logging.
6. Preserve existing exercise IDs and completed workout history. Do not automatically remap historical `wger-1530` records.

## Scope exclusions

- No bulk catalogue changes or unrelated metadata corrections.
- No historical workout migration.
- No new exercise-library UI features.
- No changes to Rob coaching behaviour beyond required catalogue compatibility.
- No unrelated refactoring.

## Validation

**Keep testing strictly proportionate to this single-record addition.**

- Run the relevant existing catalogue validation.
- Confirm the new ID is unique and required metadata is valid.
- Check that the exercise can be retrieved through the existing catalogue lookup/search path.
- Run broader checks only if justified by changes to shared code.

Do not introduce a large test suite or run exhaustive regressions for this change.

## Completion

Report the exercise ID, changed files, validation results, commit reference and any deployment requirements.

**Suggested commit:** `feat: add lying dumbbell curl to exercise catalogue`
