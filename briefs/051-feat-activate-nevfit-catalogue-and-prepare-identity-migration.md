# Nevfit â€” Checkpoint 051: Catalogue Activation & Historical Identity Migration

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Type:** Production feature implementation and controlled data migration preparation
**Priority:** High
**Previous checkpoint:** 050 â€” `51c12fb`

## Objective

Make Nevfit's 247-exercise catalogue the application's primary exercise source.

Replace dependence on WGER exercise identities for new workouts, while safely transitioning the existing user's training history to Nevfit IDs.

After migration, the user should have:

- One consistent exercise catalogue.
- Stable Nevfit-owned exercise IDs.
- All 247 exercises available for selection.
- Existing programs and routines preserved.
- Complete historical workout and progression data.
- Previous-performance lookup working across historical and future workouts.
- No duplicated or incorrectly merged exercise histories.

**The intended end state is a permanent transition to Nevfit exercise identities, not an ongoing WGER compatibility workaround for successfully migrated records.**

## 1. Source materials

Use:

- `src/data/nevfitExerciseCatalogue.v1.json`
- `src/data/nevfitExerciseIdentityRegistry.v1.json`
- `src/data/nevfitMuscleTaxonomy.v1.json`
- `evaluation/nevfitLegacyExerciseCrosswalk.v1.json`
- `evaluation/nevfit-catalogue-activation-proposal.md`
- `evaluation/nevfit-catalogue-foundation-report.md`
- `src/data/exerciseMetadataOverlay.v1.json`
- Existing exercise provider, routines, workouts, history, notes, backup and Rob services

Follow the established NevDev architecture and checkpoint workflow.

Do not recreate the catalogue or introduce another identity system.

## 2. Activate Nevfit as the primary catalogue

Implement a provider-neutral exercise resolver supporting:

- `nevfit-*` IDs from the committed Nevfit catalogue.
- Legacy `wger-*` IDs for compatibility.
- Existing workout snapshots with historical exercise names.

New exercise searches and selections should prioritise Nevfit's 247 exercises.

Support:

- Search by canonical name and aliases.
- Filtering by muscle group and equipment.
- Distinct movement variants.
- Existing routine-builder interactions.
- Exercise swaps.
- Supersets.
- Exercise notes.
- Stable selection and display behaviour.

Use Nevfit-owned equipment and muscle metadata.

Allow provisional classifications without preventing exercise selection.

Do not require WGER media or descriptions to select an exercise.

Legacy WGER exercises must remain resolvable for records that have not yet been migrated.

## 3. Update all identity consumers

Audit and update relevant code paths to support Nevfit IDs:

- Routine builder.
- Saved programs.
- Active workout creation and resume.
- Completed workout creation.
- Previous-performance lookup.
- Exercise notes.
- In-workout substitutions.
- Supersets.
- Duplicate detection.
- Exercise selection and search.
- History views and statistics.
- Backup export and import.
- Rob exercise context and program generation.

Preserve `routineExerciseId` and other independent row/session identifiers.

Do not mistake a routine row identity for an exercise identity.

Newly selected catalogue exercises must retain their Nevfit IDs throughout the workout lifecycle.

## 4. Maintain Rob compatibility

Rob must be able to recognise and work with Nevfit exercises.

Update browser and server-side exercise authorisation consistently.

The server must validate Nevfit exercise IDs against a trusted, versioned catalogue.

AI-provided names, IDs or metadata must not create authorised exercise identities.

Retain legacy WGER compatibility for unmigrated records.

Do not redesign Rob's coaching prompts, progression logic or programming philosophy.

Do not introduce additional AI costs unnecessarily.

## 5. Prepare a one-time historical identity migration

Build an explicit, account-scoped migration mechanism.

The objective is to replace confirmed historical exercise IDs with their canonical Nevfit IDs.

Example:

**Before**

- Exercise ID: `wger-364`
- Recorded exercise name: Leg Curl
- Historical sets: 45 kg Ã— 10 reps

**After**

- Exercise ID: `nevfit-seated-leg-curl`
- Recorded exercise name: Leg Curl (preserved as originally logged)
- Historical sets: 45 kg Ã— 10 reps

Future sessions use `nevfit-seated-leg-curl`.

Previous-performance lookup must retrieve both historical and newly logged sessions under the same Nevfit identity following a verified migration.

### Migration boundaries

The migration may update exercise identity references within existing documents **only after explicit approval**.

It must not alter:

- Workout dates.
- Set numbers.
- Weights.
- Repetitions.
- Units.
- Completion status.
- Historical exercise names.
- Exercise ordering.
- Superset groupings.
- Unrelated metadata.

Preserve the original exercise ID in migration provenance or a secure rollback manifest.

Do not duplicate completed workouts.

Do not delete historical workout documents.

## 6. Migration mapping

Use the 28 manually supplied historical WGER mappings as the starting point.

For each mapping:

- Identify its existing WGER ID.
- Identify the proposed Nevfit ID.
- Check for conflicting movement identities.
- Determine whether automatic conversion is safe.
- Identify any ambiguity requiring user confirmation.
- Record the proposed conversion decision and reason.

Do not interpret preferred WGER IDs as additional historical identities.

For example:

`wger-364` â†’ `nevfit-seated-leg-curl`

does not imply that historical `wger-2626` workouts should also be migrated.

If an old ID was genuinely used for multiple movements, do not automatically merge them.

Use available historical names, routine context and other recorded evidence to support decisions where possible.

If evidence is insufficient, flag the mapping for review.

**The migration must not guess when historical records could be incorrectly attributed.**

## 7. Dry run and preflight report

Implement a read-only dry-run mode that can inspect the authenticated user's actual Firestore data.

The dry run must not modify any remote documents.

Report:

- Total completed workouts inspected.
- Historical exercise occurrences identified.
- Existing routine references.
- Active-workout references.
- Exercise-note references.
- Confirmed migration candidates.
- Ambiguous mappings.
- Unmapped WGER IDs.
- Conflicting exercise identities.
- Expected affected documents.
- Expected exercise identity changes.

Include representative before/after examples without unnecessary personal information.

Generate a machine-readable migration plan and a concise human-readable summary.

A dry run must not be treated as permission to execute the migration.

## 8. Backup and rollback

Before any live migration, require:

1. A complete export of the user's current training data.
2. Validation that the backup is readable and internally consistent.
3. A documented restoration process.
4. A stable migration manifest containing original and replacement IDs.
5. Verification that rollback restores original identity references.
6. A safeguard against applying the same migration twice.

The migration must be idempotent.

Use conflict checks or transaction-safe operations appropriate to the current Firestore architecture.

Protect against partial migrations, concurrent workout edits and interrupted execution.

Do not rely solely on a successful Firestore write response as proof of migration success.

### Post-migration verification

The verification process must compare pre- and post-migration records.

Confirm:

- Completed workout counts unchanged.
- Historical exercise occurrence counts unchanged.
- All set values unchanged.
- Workout dates unchanged.
- Original exercise names preserved.
- Saved routines remain functional.
- Active workouts remain resumable.
- Exercise notes remain accessible.
- Previous-performance comparisons resolve correctly.
- No unintended exercise identity merges.

Do not automatically delete rollback data after verification.

## 9. Activation and migration sequencing

Implement the transition in stages.

**Stage A â€” Catalogue compatibility**

Introduce dual-ID reading and Nevfit catalogue search/selection behind a reversible feature switch.

Verify that existing WGER routines, active workouts and completed records remain functional.

**Stage B â€” Migration preparation**

Implement mapping validation, backup checks, dry-run reporting, migration execution safeguards and rollback tooling.

**Stage C â€” Controlled migration**

Do not execute in this checkpoint without a separate, explicit user authorisation after review of the real-account dry run.

Only migrate mappings that have been confirmed safe.

**Stage D â€” Verification and normalisation**

After an approved migration, verify progression continuity and retire successfully migrated WGER identities from ordinary exercise selection.

Keep legacy read support for unmigrated and archived records.

The catalogue feature switch must not disable the ability to read either ID namespace.

## 10. Tests

Add meaningful automated tests for:

- All 247 Nevfit exercises searchable and selectable.
- Muscle and equipment filters.
- Stable Nevfit ID propagation through routine creation and workouts.
- Legacy WGER routine compatibility.
- Active workout resume across activation.
- Completed workout history rendering.
- Previous-performance retrieval following a confirmed migration.
- Historical name preservation.
- Exercise notes.
- Exercise swaps.
- Supersets.
- Backup round-trip.
- Migration dry-run accuracy.
- Migration idempotency.
- Ambiguous ID rejection.
- Partial-operation recovery.
- Rollback integrity.
- Feature-switch rollback.
- Rob server-side ID validation.
- Rejection of fabricated or unauthorised exercise IDs.

Use synthetic fixture data for migration testing.

Do not access or mutate the user's personal Firestore data during automated tests.

## 11. Explicit exclusions

Do not:

- Execute live Firestore migration without separate authorisation.
- Delete historical workouts.
- Automatically merge ambiguous histories.
- Remove legacy WGER read support.
- Build the muscle-workload dashboard.
- Implement recovery predictions.
- Add exercise videos, images or descriptions.
- Rebuild Rob's coaching system.
- Change unrelated workout interfaces.
- Introduce unnecessary Firestore schema changes.

## 12. Deliverables

Commit:

1. Activated Nevfit catalogue integration.
2. Dual-namespace exercise resolution.
3. Updated routine/workout/history compatibility.
4. Updated Rob authorisation.
5. Account-scoped migration tooling.
6. Read-only dry-run functionality.
7. Backup and rollback procedures.
8. Migration validation tests.
9. Operational instructions for safely performing the eventual live migration.
10. A user-verification checklist.

Follow `docs/nevdev_workflow.md`.

Report:

- Commit SHA.
- Files changed.
- Catalogue activation status.
- Compatibility results.
- Migration readiness.
- Any unresolved historical mappings.
- Automated test results.
- Deployment status.
- Whether any real Firestore data was accessed or modified.

## Critical stopping condition

**STOP before executing any live Firestore migration.**

Do not automatically deploy or enable a migration job.

Do not assume that approval of this implementation brief constitutes approval to modify personal training records.

After implementation, independent code review and a real-account read-only dry run must be completed.

Only then may the user separately authorise migration execution.

## Acceptance criteria

Checkpoint 051 is ready for final user acceptance when:

- Nevfit's 247 exercises are the primary catalogue.
- Nevfit IDs work through the complete workout lifecycle.
- Existing WGER exercises remain readable.
- Rob continues functioning correctly.
- A tested and reversible historical migration mechanism exists.
- The user's existing workout data remains intact.
- The real-account dry run is reviewed before migration.
- Confirmed historical IDs can be transitioned without losing progression.
- No ambiguous histories are silently merged.
- Migration execution requires explicit subsequent approval.

**Golden rule: One Nevfit catalogue, continuous progression history, zero lost workouts.**