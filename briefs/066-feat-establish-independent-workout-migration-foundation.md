# NevFit — Checkpoint 066: Independent Saved Workout Domain and Migration Foundation

**Status:** Approved architecture foundation only
**Suggested implementation commit:** `feat: establish independent workout migration foundation`
**Workflow:** Follow `AGENTS.md` and `docs/nevdev_workflow.md`.

## User intent and risk profile
NevFit must support reusable **Workouts** outside programs, while retaining optional Programs made up of workouts. Users can create standalone workouts, move them into a single program, create new workouts within a program, detach them back to standalone, and eventually archive/restore/duplicate/delete workouts and delete programs. These are *future user-facing behaviours*, not approved implementation in this checkpoint. Rename existing user-facing “Routines” to “Workouts” only in a later approved UI checkpoint.

The user is the only active user; test accounts contain no data that needs preserving, so migration design should be **proportionate**, not enterprise-scale. However **the user's existing saved programs/routines, active session, and completed workout history MUST NOT be lost or silently changed**. No account data is authorised for deletion by this checkpoint. Do not infer a production account UID or change another account's data.

**UX gate:** Screen mockups for Training / My Workouts / Program Builder / Workout Editor and destructive controls must be presented and approved by the user **before implementing any UX/UI overhaul**.

## This checkpoint: non-destructive, unactivated foundation
1. Inspect the actual source of truth: `src/App.jsx`, `src/services/programData.js`, `programStore.js`, `planningStore.js`, workout session/history helpers, backup payload/import service, Rob context/proposals, current tests and docs.
2. Introduce small, **pure, testable** domain/model and transformation helpers (no Firestore writes/imports, UI hooks or automatic migration) for:
   - A saved Workout template with stable ID, name, ordered exercise prescriptions, archive status and nullable single `programId`; completed workout session snapshots remain distinct.
   - A Program with stable ID, metadata and **ordered workout IDs**, not embedded workout definitions.
   - Mapping legacy program `days` / `routines` to independent workout templates and program references, including archived routines/programs, order and exercise IDs/set prescriptions, notes/supersets/rest; preserving legacy stable routine IDs when globally unique, and deterministic collision handling without silently merging distinct routines.
   - Validating invariants: exactly one owner program or standalone, resolvable references, no duplicate membership or identity collision, stable exercise identities and no mutation of inputs; empty program lists and zero-workout accounts must be valid.
   - A migration plan/report with a clear per-account transformation summary and explicit failures, suitable for a later controlled migration. Keep this entirely pure/in-memory. Prefer small helpers to a framework or general-purpose migration engine.
3. Document an exact **future** transition contract in existing `docs/02-technical.md` / `docs/03-current-state.md`: legacy-to-new mapping, stable IDs, source-of-truth cutover, treatment of weekly schedule's `routineDayId`, active workouts, historical snapshots, account isolation, Rob compatibility adapter, backups (existing v1/v2 and future version), deletion semantics and rollback/verification. Highlight the existing starter-program auto-initialisation and the empty-program normalization/fallback as blockers to enabling legitimate zero-program accounts later; do not change initialization behaviour this checkpoint.
4. Identify the lowest-risk production migration plan: **first export/verify an independent full JSON backup of the real active user's data and confirm its restoration contract** before future live writes; user will manually safeguard the backup. Preserve original legacy program documents during the initial cutover until verified. Use deterministic idempotency/conservative fail-closed checks, not elaborate per-account orchestration. A later migration may be one-time and targeted because only one user's data matters, but no live writes are approved here.
5. Record concrete integration touchpoints for future checkpoint(s), especially program persistence currently only upserts documents, needing a genuine deletion API and a coordinated save/ownership change; backup import currently replaces collections; history must remain untouched.

## Explicit exclusions
- **No production or test-account Firestore writes**, collection creation, schema/rule changes, migrations, deletion, deployment of migration code, or auto-migration on startup.
- **No UI changes**: no screens, labels, navigation, layout or onboarding. User must approve screen mockups before subsequent UX/UI implementation.
- Do not change existing production path for creating/saving/editing programs, workouts or active sessions; do not change Rob generation or backup formats yet.
- No mass test matrices, large abstractions, side migrations, or other future checkpoint implementations.

## Focused verification
Use existing fixtures plus a small number of pure tests covering (a) normal multi-workout legacy program and exact prescriptions/order, (b) archived and empty items, (c) duplicate routine IDs across programs/deterministic collision handling, (d) standalone/new-model ownership and reference validation, (e) no input mutation and predictable repeated conversion, and (f) absence of destructive or Firestore side effects. Run relevant existing tests, lint and build; do **not** perform real-account reads or automated backup/migration. Report tests actually run, limitations and any genuine architectural incompatibility without expanding scope.

## Handoff
Update only directly relevant docs. Archive brief under sequential prefix 066, clear `briefs/nextbrief.md`, commit/push; report resulting commit, focused test evidence, unchanged production behaviour and precise next-step review needs. Stop for independent code review and direction check. No subsequent migration or UX work automatically approved.
