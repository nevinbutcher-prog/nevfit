# Nevfit — Checkpoint 050: Nevfit-Owned Exercise Catalogue Foundation

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Type:** Catalogue foundation and compatibility preparation
**Priority:** High
**Previous checkpoint:** 049 — `d89aec9`

## Objective

Establish a complete, Nevfit-owned exercise catalogue using the 247-exercise master spreadsheet.

Nevfit must become authoritative for exercise identity, names, equipment and muscle classifications. WGER becomes an optional external reference rather than determining which exercises Nevfit supports.

This checkpoint prepares the complete catalogue and historical compatibility relationships.

**Do not activate the new catalogue in production yet. That is Checkpoint 051.**

## 1. Source materials

Use:

- `Nevfit_Exercise_Master_Research_Draft-NB Program.xlsx`
- `evaluation/exercise-catalogue-mapping.json`
- `evaluation/exercise-catalogue-mapping-review.md`
- `evaluation/exercise-history-preservation.md`
- `evaluation/exercise-metadata-review.json`
- `src/data/exerciseMetadataOverlay.v1.json`
- Existing WGER catalogue snapshot
- Existing exercise, routine, workout, history and Rob services

The spreadsheet establishes the proposed 247-exercise catalogue.

Retain all 247 entries unless an actual duplicate is demonstrated. Do not silently remove distinct exercise variants.

## 2. Create stable Nevfit exercise identities

Assign each catalogue entry a deterministic, stable Nevfit-owned ID.

Requirements:

- IDs must be independent of WGER.
- IDs must not depend on row numbers or array positions.
- IDs must remain stable if display names change.
- Distinct exercise variants receive distinct IDs.
- Avoid collisions between similar exercises.
- Store the assigned identities in a committed catalogue, not regenerate them from names on every application run.
- Future catalogue additions must not renumber existing identities.

Example:

`nevfit-seated-leg-curl`

This is illustrative, not a required naming convention.

Create a schema that can grow without changing existing exercise identities.

Do not change the IDs currently stored in user workouts or routines.

## 3. Build the complete 247-exercise catalogue

For each entry, include:

- Stable Nevfit ID
- Canonical display name
- Search aliases
- Primary browsing muscle group
- Primary muscles trained
- Secondary muscles involved
- Relevant muscle subdivisions where appropriate
- Equipment category
- Movement/variant distinctions
- Metadata confidence and provenance
- Optional external WGER references
- Future media-reference fields, without media content

Use sensible anatomical classifications based on the proposed spreadsheet and established exercise knowledge.

**Provisional classifications are acceptable.**

Do not leave common exercises unusable merely because WGER metadata is missing or contradictory.

Where uncertainty remains:

- Choose a reasonable classification if supported by the movement.
- Mark it provisional.
- Record genuinely important ambiguities.
- Avoid inventing highly specific anatomical claims.

Do not automatically inherit WGER's primary muscle classifications.

Do not introduce arbitrary fractional secondary-muscle workload factors.

## 4. Handle the remaining 219 exercises

All 219 entries outside the existing routine must be represented in the catalogue.

Use the checkpoint 048 candidate mappings as starting points, not binding decisions.

For each entry:

- Retain its Nevfit identity regardless of WGER availability.
- Associate a WGER reference where reasonably confident.
- Leave the reference null where no appropriate match exists.
- Distinguish different equipment and movement variants.
- Allow provisional muscle metadata.
- Avoid assigning one WGER source identity to multiple distinct Nevfit movements without explicitly identifying the ambiguity.

**Do not require individual user approval of all 219 entries.**

Prioritise a complete, usable catalogue over exhaustive source verification.

## 5. Protect the existing 28 historical exercises

The 28 user-supplied historical WGER IDs are protected.

Preserve:

- Existing WGER IDs
- Completed workout snapshots
- Recorded exercise names
- Previous weights and repetitions
- Workout dates
- Saved program and routine references
- Active workout state
- Exercise notes
- Superset relationships
- Backup compatibility

Create an explicit legacy-reference mapping between relevant Nevfit catalogue entries and historical WGER IDs.

Maintain separate fields for:

- Nevfit canonical ID
- Historical WGER ID
- Preferred WGER reference
- Mapping confidence
- Ambiguity status
- Mapping provenance

Never treat an automatically suggested WGER ID as proof of historical equivalence.

### Example: Seated Leg Curl

The new catalogue may contain:

- Nevfit identity: `nevfit-seated-leg-curl`
- Historical reference: `wger-364`
- Preferred external reference: `wger-2626`

However:

- Existing completed workouts retain `wger-364`.
- Existing routines retain `wger-364`.
- Future history compatibility must be explicitly implemented and tested before switching runtime identities.
- No automatic migration is authorised.

Where multiple movements might historically share one WGER ID, mark the relationship ambiguous rather than combining their performance records.

## 6. Design compatibility for Checkpoint 051

Document how the future active catalogue will support:

- New Nevfit exercise IDs
- Existing routines using WGER IDs
- Current active workouts
- Previous-performance lookup
- Completed workout history
- Exercise notes
- In-workout swaps
- Supersets
- Backup export/import
- Rob's exercise generation and validation
- Legacy WGER exercises absent from the 247-entry catalogue

The compatibility design must support existing records without rewriting historical workout documents.

Prefer a read-only compatibility layer and explicit identity relationships.

Do not assume that equivalent names imply equivalent exercise histories.

For ambiguous historical mappings, preserve access to the original records without automatically attributing them to a new exercise.

Include a rollback plan for Checkpoint 051.

## 7. Establish the muscle taxonomy

Create a consistent anatomical classification system suitable for a future muscle-workload dashboard.

At minimum, account for:

- Chest
- Lats
- Upper/mid back
- Front, side and rear deltoids
- Biceps
- Triceps
- Forearms
- Quadriceps
- Hamstrings
- Glutes
- Calves
- Abdominals
- Obliques
- Spinal erectors
- Hip adductors and abductors

Keep browsing categories separate from actual muscle involvement.

For example, a chest press may belong under Chest for browsing while also recording triceps and anterior-deltoid involvement.

Define a stable muscle-group vocabulary and document its meaning.

Do not calculate workout volume or estimated recovery in this checkpoint.

## 8. Prepare the future exercise details structure

The catalogue should support optional future fields for:

- Exercise description
- Instructions
- Image references
- Video references
- External source and attribution
- Verification status

Do not download media, scrape exercise websites, generate illustrations, create videos or write hundreds of exercise descriptions.

Exercise media enrichment is explicitly deferred until a later development cycle.

## 9. Tests and validation

Add automated tests for:

1. Exactly 247 canonical Nevfit catalogue entries.
2. Unique, stable Nevfit IDs.
3. No unintended duplicate exercises.
4. Valid equipment and muscle-group classifications.
5. Consistent primary/secondary muscle references.
6. All 28 historical mappings represented.
7. Historical and preferred WGER references kept separate.
8. Ambiguous identity relationships flagged.
9. Missing WGER references permitted.
10. Existing WGER runtime IDs unaffected.
11. Existing workout history behaviour unchanged.
12. Existing Rob generation behaviour unchanged.
13. Catalogue changes do not require Firestore migrations.
14. Future media fields may be absent without affecting catalogue validity.

Use representative compatibility fixtures, including the historical Seated Leg Curl case.

Run lint, build and the relevant test suite.

## 10. Explicit exclusions

Do not:

- Activate Nevfit IDs for workout logging.
- Replace live exercise search.
- Rewrite existing routine exercise IDs.
- Migrate completed workout documents.
- Modify Firestore exercise history.
- Change Rob's production catalogue or generation logic.
- Build the muscle-workload dashboard.
- Create exercise detail screens.
- Implement media enrichment.
- Change unrelated workout UX.
- Introduce new Firebase collections or security rules without a demonstrated requirement.

## Deliverables

Commit:

1. Complete 247-exercise Nevfit catalogue.
2. Stable catalogue identity registry.
3. Consistent muscle taxonomy.
4. Historical WGER compatibility mapping.
5. Catalogue validation tests.
6. Documentation explaining catalogue maintenance and future additions.
7. Checkpoint 051 activation and rollback proposal.

Provide a brief summary of:

- Total exercises included.
- Primary/secondary muscle classification coverage.
- Verified versus provisional metadata.
- WGER reference coverage.
- Historical mappings preserved.
- Ambiguous identities requiring special treatment.
- Automated test results.
- Any genuine blockers.

## Delivery requirements

Follow `docs/nevdev_workflow.md`.

Commit and push the completed checkpoint.

No Firebase deployment is required unless a previously unidentified dependency makes it necessary; stop and report that dependency rather than proceeding.

No production catalogue activation.

Stop for independent review.

## Acceptance criteria

Checkpoint 050 is complete when:

- All 247 master exercises have stable Nevfit identities.
- Every exercise has usable names, equipment and muscle metadata, with uncertainty clearly identified.
- The 28 historically used WGER IDs remain explicitly protected.
- Existing workout data and application behaviour remain unchanged.
- WGER references are optional rather than mandatory.
- The catalogue can support future search, routine building, Rob integration and muscle-workload analysis.
- A concrete, reversible activation strategy exists for Checkpoint 051.

**Golden rule: We are replacing catalogue dependency, not rewriting workout history.**
