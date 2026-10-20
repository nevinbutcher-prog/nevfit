# Nevfit — Checkpoint 051B: Complete Historical Exercise Mapping & Migration Readiness

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Previous checkpoint:** 051 — `2fef7f6`
**Priority:** High
**Type:** Historical identity reconciliation and migration hardening

## Objective

Complete the reconciliation of the user's historical WGER exercise identities against Nevfit's existing 247-exercise catalogue.

Prepare a comprehensive, validated and reversible migration that preserves all completed workout records, saved routines and progression history.

This is a follow-up to Checkpoint 051, not a new catalogue initiative.

**Do not execute any live Firestore migration in this checkpoint.**

## 1. Source materials

Use:

- `src/data/nevfitExerciseCatalogue.v1.json`
- `evaluation/nevfitLegacyExerciseCrosswalk.v1.json`
- `src/services/exerciseIdentityMigration.js`
- `src/services/exerciseMigrationPreflight.js`
- `src/services/exerciseMigrationExecution.js`
- `evaluation/nevfit-catalogue-migration-operations.md`
- Existing WGER and Nevfit catalogue data
- Existing migration tests

The user has also supplied a real-account preflight:

`nevfit-exercise-migration-dry-run-2026-10-20(1).json`

The preflight is available through the user, not assumed to exist in the repository.

**Do not request credentials or commit the preflight, account identifiers, document IDs or personal workout records to GitHub.**

If a local copy is supplied, use it only for local reconciliation and keep it gitignored.

## 2. Baseline from the existing preflight

The initial read-only scan reports:

- 60 completed workouts.
- 330 historical workout exercise occurrences.
- 45 saved routine references.
- No active-workout references.
- No exercise-note references.
- 28 historical identities in the existing crosswalk.
- 41 additional unmapped WGER exercise IDs.
- No approved migrations.
- No migration conflicts reported in the initial unapproved plan.

The original 28-entry crosswalk is incomplete relative to the user's actual history.

Treat these figures as the baseline of the supplied preflight, not as permanent counts. Verify against a fresh read-only preflight immediately before any eventual migration.

## 3. Expand historical identity coverage

Analyse all historical exercise IDs appearing in the preflight.

For each distinct WGER identity:

- Determine the original recorded exercise name or names.
- Find the closest appropriate existing Nevfit exercise.
- Compare movement, equipment, grip, angle and relevant variant distinctions.
- Identify whether different historical IDs describe the same actual exercise.
- Identify whether one historical ID may have represented several different movements.
- Propose a canonical Nevfit ID where appropriate.
- Record the evidence and remaining uncertainty.

Use the existing 247 Nevfit exercises.

Do not create new catalogue exercises merely to force a match.

Do not rely exclusively on string similarity.

Do not automatically equate a WGER preferred reference with historical equivalence.

Where no suitable Nevfit exercise exists, retain the historical identity and flag the gap.

### Required cases

Explicitly investigate:

- `wger-364` — Leg Curl → Seated Leg Curl
- `wger-129` — Chest Press / Incline Chest Press Machine
- `wger-354` and `wger-684` — Lat Pulldown variants
- `wger-1109` and `wger-1424` — Biceps curl machine references
- `wger-222` and `wger-2503` — Face Pull variants
- `wger-1444` — Incline Dumbbell Press / unknown labels
- `wger-371` — Leg Press, including machine variant
- `wger-1117` — Seated Cable Row versus Seated Row Machine
- `wger-1372` — Triceps Dips versus Seated Dip Machine
- `wger-1381` — Upper Back versus Rear Delt Row Machine

Also assess all other unmapped IDs discovered in the preflight.

## 4. Record confirmed user decisions

One historical exercise identity has already been explicitly confirmed by the user:

**`wger-364` → `nevfit-seated-leg-curl`**

The user confirmed that all historical workouts recorded under `wger-364` were performed using the seated leg curl machine.

Record this as a user-confirmed identity relationship, with appropriate provenance.

It is approved as a proposed identity mapping, **not as authorisation to modify Firestore**.

Ensure the migration can apply this mapping to each qualifying historical occurrence and corresponding saved routine reference.

Preserve the original exercise name within completed workout snapshots.

Do not change weights, repetitions, dates, set ordering or other historical training information.

Do not infer that `wger-2626` is an additional historical source without actual records supporting that conclusion.

## 5. Produce a compact user-review document

The user does not want to review hundreds of individual exercise occurrences.

Group the proposed mappings by historical exercise identity and observed movement.

Classify each mapping as:

**A — User confirmed**

Already explicitly confirmed by the user.

**B — Strong proposed match**

Recorded name, movement and equipment support the proposed Nevfit exercise, with no meaningful conflicting evidence.

Requires approval before live migration, but should not generate unnecessary review questions.

**C — User clarification required**

A material distinction exists, such as:

- Incline versus flat press.
- Seated versus lying leg curl.
- Cable row versus machine row.
- Straight-bar versus rope pushdown.
- Different grip or cable movement.
- Different assistance equipment.
- Generic historical naming that could cover multiple exercises.

**D — No safe match**

Leave unmigrated until a suitable identity is available or the ambiguity is resolved.

Provide:

1. Summary counts by group.
2. Proposed old-to-new mappings.
3. Recorded names supporting each proposal.
4. Number of workout occurrences affected.
5. Number of routine references affected.
6. Important conflicts or uncertainty.
7. A short, consolidated list of questions for the user.

Do not ask the user to verify every workout individually.

Prioritise genuine movement differences over insignificant discrepancies in WGER anatomical classifications.

## 6. Extend the migration mapping architecture

The existing migration planner supports the 28 original relationships.

Extend it to support newly reviewed historical identities without weakening its safeguards.

Requirements:

- Explicit WGER source ID.
- Explicit Nevfit destination ID.
- Mapping confidence and provenance.
- Historical recorded-name evidence.
- User confirmation where required.
- Ability to approve or reject exact occurrences.
- Ability to distinguish several legacy IDs mapping to one canonical exercise.
- Ability to exclude individual occurrences when one legacy ID covered multiple movements.
- Detection of target collisions and duplicate references.
- Strict validation of catalogue identities.

Do not globally merge records based on similar names.

Separate identity mapping approval from execution authorisation.

Do not modify completed workouts while building this system.

## 7. Strengthen migration execution safety

The existing Firestore writer has not been independently validated against a realistic transaction environment.

Improve and test:

- Transaction-level conflict detection.
- Backup validation.
- Full-document preservation.
- Retry behaviour after interrupted migrations.
- Idempotency.
- Recovery from partial completion.
- Concurrent account changes.
- Rollback.
- Original exercise identity provenance.
- Preservation of routine exercise IDs.
- Preservation of superset relationships.
- Preservation of original workout exercise names.
- Correct migration of program `days` and `routines` representations.
- Safe handling of exercise-note key collisions.

Pay particular attention to the possibility that a transaction updates exercise arrays while another device or session edits the same training data.

Use the Firebase emulator or an equivalent realistic Firestore integration-test environment where practical.

If emulator testing is unavailable, document the limitation rather than claiming full transactional verification.

Do not execute tests against production Firestore.

## 8. Verify continuous progression

After simulated migration, test that an exercise's previous-performance lookup recognises its migrated historical records.

Mandatory fixture:

Historical `wger-364` workout:

- Recorded exercise name remains Leg Curl.
- Original set data remains intact.
- Exercise identity becomes `nevfit-seated-leg-curl`.
- Previous performance is returned when querying `nevfit-seated-leg-curl`.
- Future Nevfit workouts join the same progression timeline.

Also test:

- Multiple old WGER IDs confirmed to one Nevfit identity.
- Different exercise variants remaining separate.
- Unmapped legacy workouts remaining visible.
- Full rollback restoring original identities.
- No loss or duplication of completed workout records.

## 9. Generate a reviewable migration package

Produce:

- Expanded historical crosswalk.
- Mapping confidence report.
- User clarification questions.
- Updated read-only preflight support.
- Migration decision validation.
- Tested migration writer and rollback.
- Final migration procedure.
- Updated synthetic test fixtures.
- Post-migration verification checklist.

Keep reports committed to GitHub free of private account-specific details.

Any real-account migration plan must remain private and local.

The eventual migration should be performed once, after all feasible identity decisions have been resolved.

## 10. Explicit exclusions

Do not:

- Run live Firestore migrations.
- Delete historical workout records.
- Change unrelated workout UX.
- Rebuild the 247-exercise catalogue.
- Add exercise videos, images or descriptions.
- Build the muscle-workload dashboard.
- Redesign Rob.
- Introduce new training-volume algorithms.
- Force ambiguous exercises into incorrect Nevfit identities.
- Commit private workout records or account identifiers.
- Require manual approval of hundreds of individual occurrences.

## 11. Validation and delivery

Run:

- Catalogue validation.
- Frontend lint.
- Frontend build.
- Relevant unit tests.
- Firestore migration integration tests where possible.
- Existing Cloud Function tests if affected.

Follow `docs/nevdev_workflow.md`.

Commit and push the completed follow-up.

Report:

- Commit SHA.
- Historical WGER IDs accounted for.
- Proposed Nevfit mappings.
- Strong matches.
- Unresolved mappings.
- Required user clarifications.
- Number of historical occurrences potentially convertible.
- Transaction and rollback test results.
- Any genuine blockers.

No live migration is authorised.

Stop for independent review and user mapping approval.

## Acceptance criteria

Checkpoint 051B is ready for acceptance when:

- All historical WGER identities from the supplied preflight are accounted for.
- Appropriate Nevfit mapping candidates are proposed.
- The confirmed Seated Leg Curl mapping is recorded.
- Meaningful ambiguities are clearly identified.
- The user can review a compact number of actual exercise decisions.
- Migration tooling supports the expanded mapping.
- Transaction and rollback safeguards are tested.
- Previous-performance continuity works in simulated migrated history.
- All live training data remains untouched.

**Golden rule: Reconcile the user's actual training history, migrate only confirmed identities, and preserve every workout.**