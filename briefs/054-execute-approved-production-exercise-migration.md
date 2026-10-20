# Nevfit — Execute Approved Production Migration

**Status:** Explicit user authorisation received

**Scope:** One-time historical exercise identity migration only

The user has explicitly authorised production execution of the independently reviewed `migration-files/nevfit-final-plan.local`.

## Approved scope

- 354 historical exercise identity conversions.
- 312 completed-workout exercise references.
- 42 saved-routine exercise references.
- 50 affected Firestore documents.
- Six legacy WGER identities retained (21 references).
- No mapping exclusions.
- No outstanding mapping approvals.

Use the existing backup, approval manifest and prepared plan in `migration-files/`.

## Execution requirements

1. Validate that the full-account backup and reviewed plan are intact and compatible with the current migration implementation.
2. Recheck production account state against the backup before making changes.
3. If any relevant account data has changed, or the plan fails validation, **STOP WITHOUT WRITING** and report the discrepancy.
4. Use the existing explicitly gated `executeApprovedExerciseMigration` implementation. Do not bypass transaction checks, approval gates or the migration marker.
5. Execute only the 354 approved identity substitutions.
6. Do not delete or modify the 21 retained legacy references.
7. Preserve all historical exercise names, set data, dates, ordering, supersets and unrelated metadata.
8. Verify the resulting Firestore records against the original backup and migration manifest.
9. Verify historical progression is accessible through the destination Nevfit IDs.
10. Retain the original backup, exact decisions, execution marker and rollback information.

## Failure handling

If any transaction fails or verification detects a discrepancy:

- Stop further execution.
- Record exactly which documents were processed.
- Do not improvise corrective writes.
- Assess the existing safe resume/rollback mechanisms.
- Report the failure before taking any additional recovery action requiring approval.

## Report back

Provide:

- Execution status: complete, blocked or partially completed.
- Number of exercise references migrated.
- Number of documents changed.
- Verification results.
- Any discrepancies.
- Rollback readiness.

**Do not begin unrelated development, modify the catalogue or start Checkpoint 052 in this task.**

The user has authorised this specific migration, not an unrestricted production maintenance operation.
