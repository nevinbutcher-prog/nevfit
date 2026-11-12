# NevFit — Training UI Redesign: Workouts | Programs and Workout Detail/Editor

**Status:** Approved to implement now. **User confirms the controlled independent-workout migration is done.** This is the long-awaited user-visible redesign, NOT another data migration/preflight/architecture checkpoint.

**Priority:** Deliver a coherent, genuinely usable redesigned Training experience in this one brief. Don't subdivide into speculative preparation cards. Follow `AGENTS.md`, `docs/nevdev_workflow.md`. Review current repo; use existing independent v2 data and domain operations. Run tests/lint/build, push/deploy per normal workflow, archive this brief and leave nextbrief blank. Stop for independent product review.

## Product direction already approved

- Replace old **Programs** top navigation with **Training**. Inside Training present two **real tabs: Workouts | Programs** (Workouts default). Dark slate + emerald NevFit styling, cleaner typography and hierarchy, compact and responsive for gym use, mobile-first yet good on desktop.
- A **Workout** is an independent, reusable saved template (regardless of program membership). A **Program** is an optional container/ordered collection of workouts. A workout belongs to at most one program, or no program. No account requires a program. The user explicitly rejected patronising banners explaining independence or optional programs.
- Previously approved visual direction includes a **clear Workout Summary/Detail** state before editing, and an **improved dedicated workout editor**; don't cram everything into the existing program/routine editor. Use existing general-purpose SVG assets `public/assets/training-icons/` where appropriate; no exercise-specific pictograms or invented assets. Don't add decorative icon overload.
- Previous sprawling program editor and two-column selector should no longer define the primary UX. Retain underlying exercise search, descriptions, superset editing, rest settings and workout prescriptions, but present them in the redesigned workout-focused flow.
- **The actual account is now activated on independent v2 according to user.** Do not run migration or change Firebase rules for this card. Respect current Firestore rules, v2 runtime marker/revision and existing `src/services/trainingRuntimeStore.js` + `trainingLibrary.js`. Don't silently route editing back to legacy `users/{uid}/programs`.

## Required user experience

### 1 — Training landing / Workouts tab
- Clear top header **Training** with Workouts and Programs tabs and an obvious **Create Workout** action.
- Saved workout cards/rows show name, brief useful workout metadata (exercise count, program association where applicable, optionally sets/estimated effort if truly derivable), and concise actions. Visually distinguish active vs archived without losing archive discoverability; archive management can be a small toggle/filter rather than mixing archived into the main list.
- **All** saved workouts are visible across programs as well as standalone; not just projected program days. Program affiliation is labelled without making unassigned workouts look defective. Selecting a workout opens its **Workout Summary**.
- Sensible responsive grid/list on desktop and single-column mobile, tappable targets, readable compact metadata, no unnecessary huge cards or instructional paragraphs.
- No-program / no-workout new account displays a polished practical empty state with Create Workout and Create Program actions, and Quick Workout remains accessible from its normal location.

### 2 — Workout Summary / Detail
- The summary leads with workout name, program association (or no association), total exercises and an ordered **read-only preview of its exercises** (names, sets, rep range, rest, supersets visibly grouped/presented, relevant notes when available).
- Provide clear **Start Workout** and **Edit Workout** primary actions. Starting a saved workout must correctly use the v2 saved-session identity, work without an assigned week/day and preserve active session/resume and historical snapshots. If a session is already active, use existing active-session safeguard; don't quietly replace it.
- Secondary management available but not visually dominant: duplicate, archive/restore, move/assign to a program, detach, and delete with appropriately explicit confirmation. Preserve history/schedule semantics; a deletion must never delete completed sessions. A workout may belong to exactly one program.
- Returning from editor keeps user in the same workout summary; sensible navigation back to Workouts tab. Do not force them through Program edit.

### 3 — Workout Editor
- From summary and Create Workout, open a focused mobile-friendly editor for name (optional description), exercise list and ordered rows.
- Reuse existing exercise picker/catalogue/search/aliases/details and editor affordances where practical, but **do not require creating/selecting a program** first.
- Full editing of exercise order, add/remove/swap, custom display names where supported, set count, rep range, rest seconds, notes and pairing/removing supersets from existing exercises in the workout. Maintain stable workout and routineExerciseId identities and superset grouping. Preserve exercise lookup behaviour already implemented.
- Explicit **Save** / Cancel for template edits: don't persist every keystroke. Domain-level create/save operations and existing revision protections should persist changes; display actual save confirmation/errors and never silently discard unsaved edits. Handle navigation away with unsaved changes.
- Handle duplicates with fresh workout ID and fresh row IDs, rather than cloning history identities.

### 4 — Programs tab
- Present saved program list/cards with name and ordered workout count, active and archived states, clear Create Program.
- Selecting program opens a compact detail with **ordered associated workouts**, and actions to view/edit a workout, add an *existing* unassigned workout, create a new workout in this program, reorder, detach/move a workout, rename/edit program, archive/restore, duplicate if existing semantics support it, and delete with confirmation. Deleting a program should detach workouts rather than delete them.
- Keep program membership **single-owner** and deterministic. Moving a workout should remove it from prior program and update order. A workout in another program should offer explicit Move, not an accidental double assignment.
- Program editor should be an organiser, not duplicate the full workout form. Existing user-defined archived programs/workouts remain accessible.
- Maintain dashboard current program/selected program and weekly schedule integration. Standalone saved workouts remain schedulable as supported by v2 runtime.

### 5 — Integrate safely with current app
- Existing top-level Dashboard / Training / Rob / settings and active workout session flows remain intact. Rename visible routine-centric labels to **Workout** within redesigned areas (avoid large unrelated renaming of persistence fields).
- All v2 operations go via `trainingStore.operate(...)` / `trainingLibrary.applyTrainingOperation` or narrowly extended domain helpers; use current account scope, marker and optimistic revision protections. Refresh local state AND program projection after successful commits so dashboard, planner and tabs display the same result; handle stale baseline conflict with a clear reload/retry message, not a local-only false success.
- Inspect `src/App.jsx` current program UI (`viewMode === "routines"`, around line 5732), `setProgramsAndPersist`, v2 `trainingRuntime`, `trainingStore`, `routineBuilder`, workout snapshots, and existing set/exercise picker. Extract components where useful so this doesn't become a second enormous nested panel. Avoid duplicating all legacy editor code if reusable logic can be shared.
- Preserve saved workout identity, exercise prescriptions, historical completed workouts (currently around 73 in an older export), notes, supersets, active workout resume, Quick Workout, check-ins, archived program handling, zero-program onboarding and relevant Rob navigation. No rewrites to completed history and no migrations. Avoid breaking existing legacy-mode accounts; where new Training editing requires v2, fail clearly without silently writing legacy.
- Archive/restore, duplicate, delete and program membership changes require coherent persistence and confirmation; handle stale references in schedule (detach not delete; deleted workout should clean its future schedule entries via existing domain store).
- Ensure no enabled UI action is decorative/inert; avoid presenting unsupported features as if working. If an implementation subfeature presents a genuine obstacle, prioritise **Workouts list → summary → create/edit/save → Programs organiser** and report the exact limitation instead of another 40-minute general refactor.

## Visual acceptance
- The first Training view should feel **visibly redesigned**, not the old Programs editor merely renamed.
- Strong hierarchy: header/tabs/actions, clearly delineated saved-workout cards, focused summary with workout exercise preview, clean editor. No big banners explaining concepts, no default Starter Program, no gratuitous illustrations/icons. Use existing SVG assets modestly, preserve dark/emerald aesthetic and accessible contrast.
- Usable at ~375px phone width without horizontal overflow, and attractive at desktop widths. Keyboard accessible tabs and labelled actions, focus behaviour on modals, no cluttered menus.
- Show working states for empty, loading, error, save pending, archived and active. User should see the product benefit immediately.

## Tests and handoff
- Targeted tests for library operations and UI flow where practical: zero programs + first workout; standalone creation; create workout inside program; editing existing workout without changing IDs; duplicate new IDs; move/detach single membership; reordering; archived/restore; delete preserving history & schedule integrity; refresh/reload persistence; active-session safeguards; stale revision/error path; program creation/rename/archive; no unintended legacy writes. Run lint and build.
- Emulator tests only if relevant to changed persistence; don't re-run a migration review or touch Firebase rules. No real-account destructive tests by Codex.
- Provide concise debrief: screenshots or exact local UI test route if available, files changed, test results, deployment and remaining issues. Archive brief, clear queue, push and stop for user review. **Do not preemptively queue another card.**
