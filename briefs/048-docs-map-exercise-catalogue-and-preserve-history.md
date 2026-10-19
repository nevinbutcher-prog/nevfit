# Nevfit — Checkpoint 048: Exercise Catalogue Mapping & History Preservation

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Type:** Catalogue mapping, investigation and history-preservation design
**Dependency:** Checkpoint 047, commit `56316b4`

## Goal

Prepare Nevfit's curated exercise catalogue using the 247-exercise master spreadsheet and the user's 28 existing routine mappings.

Build reliable mappings between Nevfit exercise names, existing WGER IDs and preferred WGER candidates.

Establish how the curated catalogue can eventually be activated **without losing or incorrectly combining existing workout history**.

Do not change production catalogue behaviour in this checkpoint.

## Source materials

Use:

- `evaluation/exercise-catalogue-audit.md`
- `evaluation/exercise-curation-prototype.json`
- `evaluation/exercise-catalogue-recommendation.md`
- Existing committed WGER catalogue snapshot
- Existing exercise lookup, search, routine, workout and history code
- The supplied Nevfit exercise master spreadsheet containing 247 proposed exercises and 28 manually matched routine entries

The spreadsheet is the proposed canonical naming and classification reference, subject to review.

**Important:** If the spreadsheet is not accessible in the Codex workspace, stop and report the missing input. Do not invent the 247 entries or reconstruct the 28 mappings from memory.

## Non-negotiable requirement: preserve workout history

Existing workout records and exercise-performance associations must remain intact.

Do not:

- Rewrite completed workout documents.
- Delete or reassign historical exercise IDs.
- Bulk-replace WGER IDs in saved routines.
- Merge similarly named exercises automatically.
- Modify active workouts.
- Change historical set weights, repetitions or dates.
- Assume a corrected WGER ID should replace every historical occurrence of an old ID.

A historical WGER ID may be imperfect or incorrect, but it is currently part of the user's workout identity.

Preserve it until a separately approved, tested compatibility solution exists.

## 1. Import and validate the master list

Read all 247 proposed exercises.

Capture:

- Nevfit exercise name
- Primary browsing muscle group
- Equipment category
- Secondary muscle involvement
- Existing WGER ID, where supplied
- Preferred WGER ID, where supplied
- Mapping notes and review status

Verify that all 28 manually mapped routine exercises are identified.

Treat the user's existing WGER IDs as protected historical references.

Do not assume the preferred WGER ID is already approved for replacement.

## 2. Match the remaining exercises

Use the committed 907-entry WGER catalogue.

For each proposed Nevfit exercise, identify:

- Best candidate WGER ID
- Candidate WGER name
- Matching confidence
- Evidence for the match
- Alternative candidates where relevant
- Equipment or movement discrepancies
- Classification discrepancies

Match by actual movement and equipment, not name similarity alone.

Do not force a match when no appropriate candidate exists.

Use these statuses:

- `strong_candidate`
- `needs_review`
- `no_suitable_match`
- `protected_existing_id`

The 28 user-supplied historical mappings must remain distinguishable from automatically proposed matches.

## 3. Preserve separate identity fields

Design the proposed catalogue representation so that it can distinguish:

- Nevfit's canonical exercise identity
- Existing historical WGER ID
- Preferred external WGER reference
- Display name
- Aliases
- Equipment
- Primary muscle classification
- Secondary muscle involvement
- Mapping confidence and provenance

Do not introduce new production exercise IDs in this checkpoint.

Evaluate how a stable Nevfit-owned identity could eventually work without disrupting existing records.

Explicitly address the case where two different exercises have historically shared one WGER ID.

## 4. Audit history dependencies

Inspect all code paths that rely on exercise identity, including:

- Saved programs and routine exercises
- Active workouts
- Completed workout snapshots
- Previous exercise performance
- Exercise history views and statistics
- In-workout exercise swaps
- Supersets
- Backup export/import
- Rob's context and program generation
- Exercise search and selection

Identify where renaming is harmless and where changing an ID affects historical comparisons.

Document whether existing snapshots preserve historical exercise names independently of the catalogue.

## 5. Define explicit history-preservation tests

Create automated, non-production fixtures and tests demonstrating the expected compatibility behaviour.

Cover at least:

**A. Rename only**

`wger-364` displays as Seated Leg Curl while retaining all historical performance associated with `wger-364`.

**B. Corrected external reference**

Historical `wger-364` performance remains accessible if the curated exercise later references `wger-2626`.

**C. Shared incorrect ID**

Two genuinely different movements previously logged under the same WGER ID must not be automatically merged.

**D. Exercise substitution**

Replacing an exercise with a genuinely different movement must not automatically inherit unrelated performance history.

**E. Historical compatibility**

Older workout snapshots remain readable and display their recorded sets, weights, repetitions and dates.

These may be specification-level or isolated prototype tests. Do not modify production history resolution in this checkpoint.

If a case cannot be solved safely using existing recorded data, document that limitation instead of manufacturing certainty.

## 6. Review muscle classifications

Retain the master spreadsheet's proposed classifications as candidate Nevfit metadata.

Evaluate:

- Primary muscle groups
- Secondary or assisting muscle groups
- Relevant subdivisions, such as deltoid heads, biceps/triceps and quads/hamstrings
- Compound exercise involvement
- Ambiguous or questionable classifications

Do not use WGER's classification as automatically authoritative.

Do not introduce arbitrary secondary-muscle set multipliers.

Mark uncertain mappings for human review.

## 7. Produce the complete mapping deliverable

Create a machine-readable proposed catalogue mapping containing all 247 master entries.

It must distinguish:

- User-supplied existing IDs
- User-supplied preferred IDs
- Automatically suggested IDs
- Unverified matches
- Missing matches
- Historical identity risks

Also produce a human-readable review report summarising:

- Total exercises
- Strong candidates
- Entries needing review
- Unmatched exercises
- Equipment and muscle-group coverage
- Protected historical mappings
- Conflicting identities
- Priority manual-review items

Do not silently discard any master-list entries.

## 8. Activation strategy

Compare the safest implementation approaches.

At minimum, consider:

**Option A: Metadata overlay**

Keep existing WGER IDs as the runtime exercise identifiers. Override names, aliases and classifications using Nevfit-owned metadata.

**Option B: Stable Nevfit-owned identity**

Introduce independent Nevfit exercise IDs and explicit mappings to existing WGER records.

Evaluate both for historical compatibility, complexity, maintainability, future users and catalogue expansion.

Recommend a phased migration strategy, but do not execute one.

Include a rollback strategy and evidence required before activating any changes.

## Deliverables

Commit:

1. A complete proposed catalogue mapping covering all 247 exercises.
2. A mapping-quality report with unresolved decisions.
3. A history-preservation architecture and compatibility assessment.
4. Automated analysis scripts and/or non-production tests where useful.
5. A proposed next implementation checkpoint with clear acceptance criteria.

Keep generated files within appropriate `evaluation/`, `scripts/` or test locations.

Do not implement production UI, Firestore, catalogue selection or workout-history changes.

## Validation

- Every master-list row accounted for.
- All supplied WGER IDs verified against the committed snapshot.
- Historical and preferred IDs kept separate.
- No automatic merging of distinct identities.
- Mapping counts reproducible.
- Existing application lint/tests/build remain unaffected.
- No production or personal Firestore data accessed.
- No paid AI calls.

## Delivery

Follow the NevDev checkpoint workflow.

Commit and push the investigation.

Report:

- Commit SHA
- Mapping coverage
- Main unresolved issues
- History-preservation findings
- Recommended activation approach
- Test results
- Any blockers requiring user decisions

**Stop after investigation and preparation. Do not implement the curated catalogue in production.**

The purpose of this checkpoint is to prepare a verified, history-safe implementation that can be independently reviewed before approval.
