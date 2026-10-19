# Checkpoint 051: catalogue activation and migration operation

## Current deployment boundary

Nevfit search and new exercise selection use the committed 247-entry catalogue. Set `VITE_NEVFIT_CATALOGUE_ENABLED=false` at build time to restore WGER selection; Nevfit and WGER ID reads remain available in either mode. Rob's browser selection sends catalogue version 1 for Nevfit or version 2 for legacy WGER. Firebase authorises both against server-owned snapshots. `scripts/syncNevfitRobCatalogue.mjs --check` checks that the server snapshot matches the source catalogue.

The migration writer in `src/services/exerciseMigrationExecution.js` is intentionally not imported by the application or exposed as a callable. No job is scheduled or enabled. Its use requires a separate explicit approval after independent review of the real-account dry run. Neither deployment nor a dry run is migration authorisation.

## Read-only preflight

1. Sign in as the account owner and open **Settings → Data Management → Run read-only preflight**. The app reads the account's raw program, completed workout, active workout and exercise-note documents. It downloads a JSON plan and shows counts. No document is written by this action.
2. Keep the plan private. It contains historical exercise names, document IDs and exercise identity references; it omits sets and other unnecessary training details.
3. Review all 28 `mappingReview` rows and the actual `occurrences`. Every supplied historical relationship starts as `automaticConversionSafe: false`. Preferred WGER references are never source IDs. An unmatched historical WGER ID remains unmapped. Review movement variants using recorded names and routine context. Distinct movements under one old ID must remain separate or unresolved.
4. Supply a reviewed decision for each exact occurrence: historical WGER ID, Nevfit ID, kind, document ID, path and recorded name, with `confirmed: true` and a written reason. `validateMigrationDecisions` rejects unknown targets, fabricated IDs and duplicate decisions. Run preflight again with the decisions for the final affected-document list; review it separately before requesting migration approval.

## Backup and controlled execution preparation

1. Export the full account backup in Settings. Check that it parses as JSON, `validateBackup` succeeds, and it contains all expected programs, completed workouts, active workout and notes. Keep an untouched copy in secure storage. The existing backup import is a full-account replacement and should be a last-resort recovery route, not the normal identity rollback.
2. Retain the approved plan, exact decisions and untouched backup together as the rollback manifest. The plan lists every original and replacement ID and the path it will change. Record the account UID, backup export time and reviewed occurrence counts.
3. After separate authorisation, use a controlled operator invocation of `executeApprovedExerciseMigration` with the reviewed account plan, decisions, validated backup and required explicit-approval token. The module verifies the backup against current account values, reacquires current account data, checks the decisions, and writes only affected exercise arrays or notes in per-document Firestore transactions. A marker under `users/{uid}/appState/exerciseIdentityMigration` prevents a different migration from replacing the operation and records verification state. An interrupted run may resume with the same plan and backup; a completed operation rejects repeat execution. Do not expose the writer in ordinary app UI or schedule it.
4. If verification fails or an operation stops, keep the backup and manifest. Inspect the marker and account data, then either resume the same operation or invoke `rollbackApprovedExerciseMigration` under explicit rollback authorisation. Rollback checks current data against the backup and reverses only confirmed identity references. It leaves the marker and backup intact.

## Verification

Compare before and after using the retained backup and manifest. Completed workout and occurrence counts, dates, recorded exercise names, set numbers, weights, repetitions, units, ordering, superset IDs and unrelated metadata must remain identical. Open each affected saved routine and any active workout. Check personal notes and previous performance for a confirmed migrated Nevfit ID. Check that ambiguous and unmapped WGER IDs still show under their original identity. If any comparison fails, stop and use the retained backup and manifest for recovery. Do not delete rollback data automatically.

## User verification after independent review

- Search a common exercise and a rare catalogue entry; select each in a routine. Confirm the exercise name, equipment, muscle filter and distinct variant remain correct after saving and reopening.
- Open an existing WGER routine and resume an existing active workout. Check order, sets, notes and superset pairing without changing or completing them.
- Start a new workout using a Nevfit exercise, log a set and complete it. Confirm the completed history shows the recorded name and values and that the next workout shows previous performance for that Nevfit ID.
- Ask Rob to generate a program with available equipment. Confirm generated exercises can be opened and saved; no unknown IDs appear.
- Run the read-only preflight and inspect its downloaded counts and ambiguous/unmapped rows. Confirm historical workouts still exist and are unchanged. Do not execute a migration during this verification.
