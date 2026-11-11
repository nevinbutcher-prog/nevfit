# NevFit — Checkpoint 069: Owner-Scoped Firestore Staging Adapter and Rules

**Status:** Approved for implementation; live-account staging is NOT yet authorised.
**Suggested commit:** `feat: implement guarded independent workout Firestore staging adapter`
**Workflow:** Follow `AGENTS.md` and `docs/nevdev_workflow.md`. Complete exactly this checkpoint, archive as 069, clear `briefs/nextbrief.md`, commit/push, then stop for independent review.

## Product context and acceptance of 068
User has personally passed all five checkpoint 068 acceptance checks: fresh account stays empty after sign-in/refresh, Quick Workout works, no premature weekly check-in, existing account retains programs/schedule, and history/previous performance remains available. Preserve zero-program onboarding. User is the only active user. Previous private readiness export (2026-11-11) contained 6 programs / 10 workout templates / 73 completed sessions and passed preflight with no collisions. These are historical reference counts, **never hardcoded expectations**. Never include user's exported JSON, UID, email, training content or hashes in repo/tests/logs.

Approved future UX: Training > Workouts/Programs, independent saved workouts with optional program ownership; improved workout summary/editor as in visual mockups, emerald SVG UI icons in `public/assets/training-icons/`, no explanatory banners. **No UI redesign in 069**.

## Goal
Unblock the **staging phase only** by implementing the actual, authenticated Firestore adapter for the existing `stageIndependentWorkouts` engine in `src/services/independentWorkoutStage.js` and adding narrowly scoped owner-only Firestore rules for isolated target collections:
- `users/{uid}/workouts/{workoutId}` (saved template definitions)
- `users/{uid}/programsV2/{programId}` (program metadata and ordered workout IDs)
- one explicit account-scoped staging marker document in `users/{uid}/appState/*` (existing owner-only rule).

**Keep legacy `users/{uid}/programs/*` the source of truth.** No switch to v2 readers/writers, no UI Training overhaul, no migration of `completedWorkouts` or Rob, no deleting/rewriting legacy documents. The acceptance checkpoint is working adapter+rules and synthetic/emulator validation, not actually staging the live account.

## Implementation constraints
1. Inspect existing `firestore.rules`, Firebase config, `trainingReadinessStore.js`, `trainingReadinessBackup.js`, `independentWorkoutStage.js`, 066 planner, 068 synthetic adapter tests and application auth. Implement a small, concrete `independentWorkoutStageFirestore.js` adapter matching the existing contract:
   - `readSourceFromServer` obtains fresh server-only, signed-in, UID-scoped source through existing 067 capture, with explicit `pendingWrites: false` only if verified.
   - `readTargetsFromServer` reads **every** document in both target collections, plus marker via server-only reads; rejects unavailable/cache/pending-write snapshots; returns typed values and exact paths.
   - `claimStage(expected, lock)` performs an atomic marker compare-and-set transaction; never overwrite a different attempt/fingerprint, including after races.
   - `createOrVerifyDocuments(entries)` creates missing targets **without replacing existing ones** and only accepts byte/semantic-equivalent existing records. Use transactions or another genuinely race-safe Firestore create-if-absent/verify approach, not blind `setDoc`/merge that could overwrite changed data. Any batch work must stay within Firestore transaction limits.
   - `completeStage(expected, verified)` atomically verifies marker identity/status before writing verified marker. Verified status is not permission for cutover.
   - Handle server errors, retries, partial batches and stale marker explicitly. No broad migration framework.
2. Guard account identity at entry and after awaits (`auth.currentUser.uid` and mounted UID). Re-check fresh source fingerprint / pending session via 068 engine before writes, and ensure the marker/target transactions don't create a false verified state if source drift occurs during write window. Note that client-side external devices are not globally locked: require manual pause on other devices and perform final fresh-source check before publishing verification; fail closed on drift.
3. Add only the owner-scoped rules required for the **two new target collections**; do not expand privileges or rewrite existing rules. Prefer explicit user-only read + narrowly validated create/update permissions for staging paths if achievable without fragile rule complexity; at minimum owner-only like existing rules and enforce conflict protection in transactional adapter. Document actual security boundary: Firestore rules cannot make a single owner immune to another authorised owner's app code or prevent accidental modification without constraints. Test that unrelated users cannot access another user's new collections, if emulator available.
4. Provide a deliberate activation **gate**: a developer-only, explicit confirmation/manual action may be prepared/wired only if its safety can be verified. There must be no automatic staging on startup, deploy, sign-in, export, page refresh, or CI. No production user staging attempt during this implementation. If any live stage button is included, keep it disabled by default behind an explicit developer feature flag (default off), display UID/counts, require fresh private backup selection and typed confirmation, and do not expose it in production builds by default. Existing developer-only dry run must remain available.
5. Keep staging idempotent and reversible in the practical sense that legacy originals stay authoritative; never promise that the private JSON is a tested complete restore. Ensure target reads verify exact path inventory after staging, that the marker does not activate runtime v2, and that accidental writes to `completedWorkouts` or `programs` are structurally impossible through this adapter.
6. Rules file changes may be committed to GitHub, but **do not deploy Firestore rules or execute live staging** from Codex in this checkpoint. Vercel deployment of frontend changes is permitted per existing workflow. Any Firebase deploy (rules/functions) is a separate deliberate user-approved release action after independent review. Clearly report that the deployed rules remain unchanged until that action.
7. Keep zero-program accounts valid: zero source programs may stage to an empty v2 target representation without inventing a Starter Program, or be a deliberate no-op. No changes to empty-account creation, active session persistence, planner, check-in or Quick Workout in this card. Explicitly avoid altering backup/import formats.

## Tests / evidence
- Focused synthetic adapter or Firestore emulator tests for owner permissions, server-only reads, exact inventory, missing collections, existing identical targets, existing conflicting targets, two attempts claiming concurrently, partial interruption/retry, active session/source drift, marker compare-and-set, verified-marker idempotency, zero-program account and account change midway.
- Test rules with emulator where feasible; if emulator unavailable, be explicit about unverified deployed-rule behaviour rather than claiming production permission tests passed. Keep tests reasonably small.
- Run targeted tests, lint, build. No use of user production data or credentials; do not request user's private backup in Codex.
- Handoff must state code paths, rule paths, test evidence, deployment status, precise manual release/activation checklist and remaining blocker before live staging. **Do not proceed to runtime schema cutover, workout CRUD or Training UI automatically.**
