# Nevfit — Checkpoint 049: Verified Exercise Metadata & History-Safe Overlay

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Type:** Focused implementation
**Priority:** High

**Dependencies:**
- Checkpoint 047 — `56316b4`
- Checkpoint 048 — `d555e39`

## Goal

Introduce Nevfit-owned exercise names, equipment and muscle classifications for the 28 exercises in the user's existing routine.

Preserve all existing exercise IDs, workout history and previous-performance tracking.

Establish a reusable metadata-overlay architecture that can subsequently accommodate the remaining 219 exercises without redesign.

**The 28 exercises are the first activation batch, not the permanent catalogue.**

## 1. Source of truth

Use:

- `Nevfit_Exercise_Master_Research_Draft-NB Program.xlsx`
- `evaluation/exercise-catalogue-mapping.json`
- `evaluation/exercise-catalogue-mapping-review.md`
- `evaluation/exercise-history-preservation.md`
- `evaluation/exercise-catalogue-next-checkpoint-proposal.md`
- `functions/src/rob/robExerciseCatalogue.v2.json`

The spreadsheet supplies proposed Nevfit display names, equipment categories and muscle classifications.

The 28 user-supplied historical WGER IDs are authoritative for existing routine identity.

Preferred WGER IDs are reference candidates only.

Do not silently replace historical IDs with preferred IDs.

## 2. Review the 28 exercises

For each historical mapping:

- Confirm that the WGER ID exists.
- Preserve that ID as the runtime identity.
- Record the proposed Nevfit display name.
- Review equipment classification.
- Review primary muscle involvement.
- Review secondary muscle involvement.
- Identify anatomical or movement ambiguities.
- Record classification provenance and confidence.
- Identify potential conflicts where the same ID has multiple interpretations.

Use existing catalogue evidence and reputable exercise references where available.

Do not represent name-based assumptions as independently verified anatomy.

If a mapping cannot be adequately verified, retain it in the review output but exclude uncertain metadata from production activation.

**No exercise should disappear from the user's routine because its metadata is uncertain.**

## 3. Implement a versioned metadata overlay

Create a reusable Nevfit-owned metadata layer keyed by existing `wger-*` IDs.

It should support:

- Nevfit display name
- Aliases
- Equipment classification
- Primary muscle or muscles
- Secondary muscle involvement
- Optional muscle subdivisions
- Review status
- Confidence and provenance
- Metadata version

Keep the schema independent of the initial 28-exercise batch.

Do not introduce new runtime exercise IDs.

Do not replace the entire WGER catalogue.

Unreviewed exercises must continue resolving through existing catalogue mechanisms.

## 4. Integrate reviewed metadata safely

For confidently reviewed entries, use the overlay for appropriate exercise display and lookup surfaces.

Important requirements:

- Existing saved routine IDs remain unchanged.
- Existing active-workout IDs remain unchanged.
- Completed workout records remain unchanged.
- Existing exercise notes remain associated with their original IDs.
- Historical workout names must not be rewritten.
- Previous-performance lookup continues using exact historical IDs.
- Exercise swaps and supersets remain functional.
- Unknown exercises continue using their existing WGER data.

Avoid changing Rob's exercise-generation eligibility or candidate ranking in this checkpoint.

Do not globally replace historical IDs with preferred WGER references.

## 5. Preserve history and progression

Implement regression tests covering:

**A. Rename without identity change**

Existing `wger-364` history remains available if the display name becomes Seated Leg Curl.

**B. Preferred external reference**

The presence of preferred `wger-2626` must not change the runtime identity of historical `wger-364`.

**C. Different exercises sharing an ID**

Do not automatically combine or redistribute historical performances.

**D. Existing active workout**

An active workout remains resumable without exercise or set corruption.

**E. Completed workout history**

Previous weights, reps, dates and recorded exercise names remain preserved.

**F. Backup compatibility**

Existing backup export/import retains exercise identities, logged sets and historical performance.

**G. Legacy catalogue fallback**

Unreviewed exercises continue resolving normally.

Do not rewrite production Firestore documents to satisfy these tests.

## 6. Prepare for future catalogue expansion

Ensure the overlay can accommodate all 247 master-list exercises.

Produce a compact expansion report identifying:

- The 28 historical mappings and their activation status.
- Which entries were activated.
- Which entries remain uncertain and why.
- Remaining catalogue entries by matching status.
- Reusable validation steps for future batches.
- Any architectural limitations preventing future expansion.

Do not manually classify or activate all remaining 219 exercises in this checkpoint.

Do not require a new exercise identity system merely to expand the overlay.

## 7. Explicit exclusions

Do not implement:

- Historical WGER ID migration.
- Firestore history rewriting.
- New canonical runtime IDs.
- Automatic exercise-history merging.
- Full catalogue replacement.
- New program-generation logic.
- Muscle workload calculations or dashboard charts.
- Recovery estimates.
- Exercise preference ratings.
- Weekly check-in changes.
- Extensive UI redesign.

## 8. Validation

Run relevant lint, build and automated tests.

Verify:

- All 28 historical IDs remain unchanged.
- All original workout snapshots remain intact.
- Previous-performance retrieval is unaffected.
- Existing routines and active workouts remain compatible.
- Metadata overlays apply only to reviewed IDs.
- Unreviewed IDs retain existing behaviour.
- No unintended changes to Rob's generation pathways.
- The overlay can be disabled or reverted without a data migration.

Include tests demonstrating these behaviours, not merely documentation describing them.

## 9. Delivery

Follow `docs/nevdev_workflow.md`.

Provide:

- Commit SHA.
- Changed files.
- Number of reviewed and activated exercises.
- Excluded or uncertain mappings and reasons.
- Test results.
- Deployment status.
- Known limitations.
- Manual user-verification checklist.

Commit and push the implementation.

Do not modify production Firestore workout records.

Do not begin muscle workload tracking or another checkpoint automatically.

**Stop for independent code review before declaring user acceptance.**

## Acceptance criteria

Checkpoint 049 is ready for acceptance when:

1. Reviewed Nevfit metadata is available for the initial routine exercises.
2. Display names and classifications can be improved without changing existing exercise IDs.
3. Previously logged performances remain accessible.
4. No historical workouts, active workouts, saved routines or backup identities are corrupted.
5. Unreviewed WGER exercises remain available.
6. The same overlay architecture can accommodate the other 219 exercises without substantial redesign.

**Guiding principle: Nevfit owns exercise quality; existing workout history remains authoritative.**
