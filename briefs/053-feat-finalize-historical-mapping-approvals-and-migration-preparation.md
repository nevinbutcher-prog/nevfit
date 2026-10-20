# Nevfit — Checkpoint 051C: Final Historical Mapping Approval & Migration Preparation

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Previous checkpoint:** 051B — `239413e`
**Priority:** High
**Scope:** Final historical mapping decisions, approval package, dry run and migration readiness

## Objective

Finalise the historical exercise identity mapping process and prepare a safe, controlled migration of existing WGER exercise references to Nevfit-owned exercise IDs.

Checkpoint 051B established 68 observed historical WGER identities:

- 1 previously confirmed mapping.
- 33 strong proposed mappings.
- 28 requiring clarification.
- 6 without a safe Nevfit equivalent.

The user has now answered all 28 clarification cases.

**Incorporate those answers, prepare the outstanding strong proposals for consolidated approval, and generate the tooling and instructions required for the final migration.**

Do not execute the production Firestore migration.

## 1. Preserve the established foundation

Use the existing:

- 247-exercise Nevfit catalogue.
- Versioned historical crosswalk.
- Migration planner and validation.
- Read-only account preflight.
- Firestore migration writer.
- Rollback mechanism.
- Emulator integration tests.
- Historical mapping review.
- Existing program, workout and previous-performance architecture.

Do not rebuild or expand the catalogue.

Do not redesign Rob or the workout interface.

## 2. Apply the user's confirmed exercise identities

The following relationships have been explicitly clarified by the user.

These approvals establish historical exercise identity. They do not constitute authorisation for production Firestore writes.

### Previously confirmed

| WGER ID | Nevfit ID |
|---|---|
| wger-364 | nevfit-seated-leg-curl |

All historical `wger-364` performances were seated leg curls.

### Group 1 — Presses and deadlifts

| WGER ID | Nevfit ID |
|---|---|
| wger-75 | nevfit-flat-dumbbell-bench-press |
| wger-129 | nevfit-incline-chest-press-machine |
| wger-184 | nevfit-conventional-barbell-deadlift |
| wger-1370 | nevfit-dumbbell-romanian-deadlift |

Both historical names under `wger-129`, including generic Chest Press, represented incline machine presses.

### Group 2 — Leg and shoulder presses

| WGER ID | Nevfit ID |
|---|---|
| wger-371 | nevfit-horizontal-leg-press |
| wger-543 | nevfit-seated-shoulder-press-machine |
| wger-567 | nevfit-seated-dumbbell-shoulder-press |
| wger-687 | nevfit-standing-barbell-overhead-press |
| wger-1893 | nevfit-standing-barbell-overhead-press |

The two barbell overhead press IDs represent the same standing movement.

### Group 3 — Cable movements

| WGER ID | Nevfit ID |
|---|---|
| wger-237 | nevfit-high-to-low-cable-fly |
| wger-354 | nevfit-underhand-lat-pulldown |
| wger-805 | nevfit-cable-triceps-pushdown-straight-bar |
| wger-1185 | nevfit-cable-triceps-pushdown-straight-bar |
| wger-1117 | nevfit-close-grip-seated-cable-row |
| wger-1378 | nevfit-dual-cable-lateral-raise |

The two cable triceps pushdown IDs represent straight-bar pushdowns.

### Group 4 — Machines

| WGER ID | Nevfit ID |
|---|---|
| wger-1109 | nevfit-seated-biceps-curl-machine |
| wger-1424 | nevfit-seated-biceps-curl-machine |
| wger-1372 | nevfit-seated-dip-machine |
| wger-1381 | nevfit-rear-delt-row-machine |
| wger-2614 | nevfit-hip-adduction-machine |

The two biceps curl machine IDs represent the same seated movement.

### Group 5 — Previously unidentified exercises

| WGER ID | Nevfit ID |
|---|---|
| wger-1444 | nevfit-incline-dumbbell-bench-press |
| wger-2503 | nevfit-cable-face-pull |
| wger-48 | nevfit-reverse-barbell-wrist-curl |

All six historical `wger-1444` workouts were incline dumbbell bench presses, including four originally recorded as Unknown exercise.

The original recorded workout names must remain unchanged.

### Group 6 — Remaining variants

| WGER ID | Nevfit ID |
|---|---|
| wger-238 | nevfit-dumbbell-chest-fly |
| wger-1486 | nevfit-cable-high-row |
| wger-1567 | nevfit-hammer-curl |
| wger-1654 | nevfit-lateral-raise-machine |
| wger-1929 | nevfit-assisted-pull-up |

The user confirmed that alternating high cable rows and alternating hammer curls should share progression with the corresponding Nevfit movements.

Assisted pull-ups may share the Nevfit assisted pull-up identity, while original assistance and performance details remain preserved.

## 3. Retain six legacy identities

The following WGER identities have no safe existing Nevfit equivalent:

- `wger-265` — Generic Glute Bridge
- `wger-1466` — Hack Squat Machine Calf Raise
- `wger-1519` — Overhead EZ-bar Triceps Extension
- `wger-1530` — Lying Dumbbell Curl
- `wger-1828` — Abdominal Draw-In
- `wger-1830` — Barbell Step-back Lunge

Do not force these into approximately equivalent movements.

Keep their workout history, routines and previous-performance lookup functional.

Do not add catalogue exercises in this checkpoint.

## 4. Keep strong proposed mappings pending consolidated approval

Checkpoint 051B identified 33 strong proposed historical mappings.

These have not yet received explicit user approval.

Retain all 33 proposals and their supporting evidence.

Produce a concise approval document containing:

- Historical WGER ID.
- Observed exercise name.
- Proposed Nevfit identity.
- Historical workout occurrence count.
- Saved routine reference count.
- Any meaningful caveat.
- One clear collective approval decision with an option to exclude individual mappings.

Do not silently promote the 33 proposals to user-confirmed status.

Ensure no historical mapping is marked approved merely because an AI or script classified it as high confidence.

## 5. Update and validate the historical crosswalk

Update the versioned crosswalk with:

- The user's 29 confirmed mappings, including the original seated leg curl confirmation.
- The remaining 33 strong proposals, explicitly pending approval.
- The six retained legacy identities.
- Provenance and confirmation status.
- Previous WGER identity.
- Destination Nevfit identity.
- Affected occurrence counts from the earlier preflight, labelled as historical estimates.

Retain the unobserved `wger-1012` entry separately. Do not include it in the 68 observed identity totals or automatically approve it.

Validate all canonical target IDs against the committed Nevfit catalogue.

Preserve immutable canonical Nevfit IDs.

## 6. Prepare exact occurrence decisions

Provide a repeatable mechanism that converts approved identity relationships into the exact occurrence decisions required by the existing migration planner.

For each approved occurrence:

- Confirm the source WGER ID.
- Confirm the destination Nevfit ID.
- Match its document ID and exercise path.
- Preserve its recorded historical exercise name.
- Validate against the current Firestore preflight.
- Reject unexpected or changed identities.
- Detect collisions where multiple source exercises occur in one routine or workout.
- Preserve explicitly excluded occurrences.

Never infer approval of a pending strong mapping.

Do not create executable migration decisions from unresolved relationships.

## 7. Verify migration safety and progression

Retain and expand the existing migration tests where required.

Mandatory cases:

- Seated leg curl history joins Nevfit progression.
- Multiple WGER IDs safely converge on one approved Nevfit ID.
- Historical unknown exercise names remain unchanged.
- Original weights and repetitions are preserved.
- Exercise dates and ordering remain unchanged.
- Routine exercise IDs and superset links remain stable.
- Active workouts remain resumable.
- Notes and historical snapshots remain accessible.
- Six retained WGER identities remain readable.
- An unapproved strong proposal is excluded from writes.
- Migration can safely recover from interrupted execution.
- Rollback restores original identities.
- Unexpected account changes cause a safe failure.

Test with the local Firestore emulator.

Do not run integration tests against production Firestore.

## 8. Fresh preflight and full backup

Ensure the user can perform the following sequence:

1. Obtain a current full-account backup.
2. Validate that the backup is complete and readable.
3. Run a fresh read-only preflight.
4. Apply only reviewed mapping decisions to the preflight.
5. Produce the final affected-document and occurrence counts.
6. Review the plan independently.
7. Request a separate authorisation for migration execution.

The earlier preflight is a historical baseline, not a guaranteed current account state.

Avoid editing programs or logging new workouts between the final backup/preflight and execution. If training data changes, regenerate and revalidate the plan.

The migration executor must remain disabled and inaccessible from the ordinary app UI.

## 9. Deliverables

Produce:

1. Updated historical crosswalk.
2. Recorded user confirmations and provenance.
3. Consolidated approval document for the 33 strong mappings.
4. Final read-only migration-plan generation support.
5. Updated mapping validation tests.
6. Passing Firestore emulator migration, rollback and concurrency tests.
7. Updated operational instructions.
8. Clear verification and recovery checklist.

Commit only generic, non-sensitive source files and reports.

Never commit the user's private preflight, account UID, workout document IDs or full-account backup.

## 10. Explicit stopping conditions

**Do not execute a live Firestore migration.**

Do not treat the current implementation request as approval to modify production records.

Do not silently approve the 33 pending strong mappings.

Do not create new catalogue exercises.

Do not implement the muscle-workload dashboard.

Stop after completing the implementation, automated validation and approval package.

Report the commit SHA, tests, final mapping categories, pending approvals and any remaining technical blockers.

## Acceptance criteria

- All 68 observed historical identities have an explicit disposition.
- The user's 29 confirmed mapping decisions are accurately recorded.
- The 33 strong proposals remain pending consolidated approval.
- Six unmatched identities retain WGER compatibility.
- Any ID absent from the account preflight remains separately classified.
- Final dry-run tooling generates correct per-occurrence decisions.
- Historical set values and workout metadata remain protected.
- Migration execution and rollback tests pass.
- Production Firestore remains unchanged.
- A final user approval package is ready for independent review.

**Golden rule: Complete the identity reconciliation without changing a single production workout until separately authorised.**