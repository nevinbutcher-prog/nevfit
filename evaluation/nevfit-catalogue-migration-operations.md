# Checkpoints 051 and 051B: catalogue activation and migration operation

## Current deployment boundary

Nevfit search and new exercise selection use the committed 247-entry catalogue. Set `VITE_NEVFIT_CATALOGUE_ENABLED=false` at build time to restore WGER selection; Nevfit and WGER ID reads remain available in either mode. Rob's browser selection sends catalogue version 1 for Nevfit or version 2 for legacy WGER. Firebase authorises both against server-owned snapshots. `scripts/syncNevfitRobCatalogue.mjs --check` checks that the server snapshot matches the source catalogue.

The migration writer in `src/services/exerciseMigrationExecution.js` is intentionally not imported by the application or exposed as a callable. No job is scheduled or enabled. Its use requires a separate explicit approval after independent review of the real-account dry run. Neither deployment nor a dry run is migration authorisation.

## Read-only preflight

1. Sign in as the account owner and open **Settings → Data Management → Run read-only preflight**. The app reads the account's raw program, completed workout, active workout and exercise-note documents. It downloads a JSON plan and shows counts. No document is written by this action.
2. Keep the plan private. It contains historical exercise names, document IDs and exercise identity references; it omits sets and other unnecessary training details.
3. Review `evaluation/nevfit-historical-mapping-review.md` first. The version 2 crosswalk has 68 identities observed in the 2026-10-20 preflight and one older candidate not observed there. Class A is the user's confirmed `wger-364` seated leg curl relationship, scoped to completed workouts and saved routines. Class B remains proposed, C needs clarification and D retains its WGER identity. Preferred WGER references are never source IDs. If one ID covered distinct movements, retain or exclude individual occurrences until resolved.
4. Record approval for a class B or resolved C mapping by supplying exact reviewed decisions: historical WGER ID, Nevfit ID, kind, document ID, path and recorded name, `confirmed: true`, and a reason. An exact `confirmed: false` decision excludes an A relationship exception. `validateMigrationDecisions` rejects unknown targets, fabricated IDs and duplicate decisions. Run a fresh read-only preflight with decisions and review affected documents and collisions before requesting separate execution approval. The 2026-10-20 preflight is a historical baseline, not a current-data guarantee.

## Backup and controlled execution preparation

1. Export the full account backup in Settings. Check that it parses as JSON, `validateBackup` succeeds, and it contains all expected programs, completed workouts, active workout and notes. Keep an untouched copy in secure storage. The existing backup import is a full-account replacement and should be a last-resort recovery route, not the normal identity rollback.
2. Retain the approved plan, exact decisions and untouched backup together as the rollback manifest. The plan lists every original and replacement ID and the path it will change. Record the account UID, backup export time and reviewed occurrence counts.
3. After separate authorisation, use a controlled operator invocation of `executeApprovedExerciseMigration` with the reviewed account plan, decisions, validated backup and required explicit-approval token. The module verifies the backup against current account values, reacquires current account data, checks the decisions, and writes only affected exercise arrays or notes in per-document Firestore transactions. Each transaction checks the current document's backed-up training fields before writing; concurrent set/name/routine changes stop it. A marker under `users/{uid}/appState/exerciseIdentityMigration` prevents a different migration from replacing the operation and records verification state. An interrupted run may resume with the same plan and backup; a completed operation rejects repeat execution. Do not expose the writer in ordinary app UI or schedule it.
4. If verification fails or an operation stops, keep the backup and manifest. Inspect the marker and account data, then either resume the same operation or invoke `rollbackApprovedExerciseMigration` under explicit rollback authorisation. Rollback checks current data against the backup and reverses only confirmed identity references. It leaves the marker and backup intact.

## Verification

Compare before and after using the retained backup and manifest. Completed workout and occurrence counts, dates, recorded exercise names, set numbers, weights, repetitions, units, ordering, superset IDs and unrelated metadata must remain identical. Open each affected saved routine and any active workout. Check personal notes and previous performance for a confirmed migrated Nevfit ID. Check that ambiguous and unmapped WGER IDs still show under their original identity. If any comparison fails, stop and use the retained backup and manifest for recovery. Do not delete rollback data automatically.

Local verification for checkpoint 051B: `npm test` covers pure planning and patch guards; `firebase emulators:exec --only firestore --project demo-nevfit --config test/fixtures/firebase-emulator.json "node scripts/firestoreMigration.emulator.mjs"` covers actual Firestore transactions against synthetic data, interrupted resume, idempotency, concurrent edits, progression continuity and rollback. The `demo-nevfit` project prevents accidental production access. This does not replace a fresh real-account read-only preflight, independent code review or user mapping approval.

## User verification after independent review

- Search a common exercise and a rare catalogue entry; select each in a routine. Confirm the exercise name, equipment, muscle filter and distinct variant remain correct after saving and reopening.
- Open an existing WGER routine and resume an existing active workout. Check order, sets, notes and superset pairing without changing or completing them.
- Start a new workout using a Nevfit exercise, log a set and complete it. Confirm the completed history shows the recorded name and values and that the next workout shows previous performance for that Nevfit ID.
- Ask Rob to generate a program with available equipment. Confirm generated exercises can be opened and saved; no unknown IDs appear.
- Run the read-only preflight and inspect its downloaded counts and ambiguous/unmapped rows. Confirm historical workouts still exist and are unchanged. Do not execute a migration during this verification.
