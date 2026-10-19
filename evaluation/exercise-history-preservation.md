# Checkpoint 048 — history compatibility and activation assessment

## Recorded identity and dependencies

| Path | What is stored/compared | Effect of a catalogue change |
| --- | --- | --- |
| Saved programs and routine rows (`routineBuilder`, `programStore`, `programData`) | `exerciseId` (`wger-*`) and separate `routineExerciseId`; optional `displayNameOverride`; `supersetGroupId` | Renaming can change fallback display. Replacing ID changes selection, duplicate checks, and the workout seeded later. Routine row ID is not an exercise identity. |
| Active workout (`createWorkoutSessionSnapshot`, `App`, `activeWorkoutStore`) | Copies `exerciseId`, `exerciseName`, prescription, sets and superset group | Existing active sessions must not be rewritten. New display metadata does not automatically rename a session. |
| Completed workouts (`workoutSnapshots`, `workoutHistoryStore`) | Snapshot has `exerciseId`, independent `exerciseName`, completion date, sets, weights, reps, optional units and swap origin | Old snapshots remain readable with recorded names and data. Some older records may omit units, so rendering needs the existing legacy fallback. |
| Previous performance (`workoutSnapshots`, `App`) | Exact `exerciseId` equality across completed workouts | Rename at the same ID retains comparison. Changing a future exercise to `wger-2626` loses exact-ID access to `wger-364` unless an explicit compatibility bridge is added. |
| History views and weekly statistics (`App`, `robWeeklyContext`) | Recorded snapshot names/dates and ID-grouped aggregate comparisons | Display can preserve old names. ID changes split comparisons; joining IDs can merge unrelated records. |
| In-workout swaps (`activeWorkoutSwap`) | New `exerciseId`/name plus `originalExerciseId`/name when changed before logging | Origin is traceability, not evidence that the two movements should share performance. |
| Supersets (`routineBuilder`, `App`) | Row grouping by `supersetGroupId`, exercise identity remains per row | ID replacement affects row selection and possibly duplicate checks, not the group identity itself. |
| Backup export/import (`backupService`) | Serializes raw programs, active workout, completed workouts and notes; import replaces account collections | Future format/version must preserve legacy IDs and fields. A catalogue rollout must not rewrite backups during import. |
| Rob context and generation (`robContext`, `robWeeklyContext`, `robExerciseCatalogue`, server catalogue, program generation) | Reads stored IDs; generation is authorised against WGER snapshot IDs and materialises them into proposals | A new namespace requires coordinated browser/server validation and context semantics. Reinterpreting an old ID can distort review advice. |
| Search and selection (`exerciseProvider`, `App`) | Live WGER search; `getExerciseById` accepts `wger-*`; library lookup by exact ID | An overlay can rename and classify reviewed IDs while preserving lookup. Preferred external IDs cannot silently replace runtime IDs. |

## Offline compatibility contract

`evaluation/historyCompatibilityPrototype.js` and its five fixture tests are specification-level checks, not production logic. A rename of `wger-364` to Seated Leg Curl leaves exact-ID performance and the old snapshot name intact. If the curated record later uses `wger-2626`, exact-ID lookup currently returns no `wger-364` sets. A future bridge could explicitly associate an old ID with one reviewed canonical exercise; the test proves only the shape of that possibility. If two distinct movements historically share one WGER ID, the old records have insufficient identity data to split them automatically; the prototype refuses the bridge. A genuinely different substitution gets no old performance. Old snapshots retain date, name, sets, load and reps.

## Representation and options

A future record should keep a stable Nevfit-owned `canonicalIdentity` separate from `displayName`, `aliases`, `equipment`, `primaryBrowseGroup`, `secondaryMuscles`, `historicalWgerIds`, `preferredExternalReference`, and per-field source/reviewer/confidence/version. This mapping intentionally leaves `canonicalIdentity` null. If two distinct Nevfit movements share a historical WGER ID, the bridge must be marked ambiguous, with provenance and no automatic performance attribution. The historical ID remains on each workout; a reviewer may resolve particular records only with adequate evidence and a separately approved process.

| Approach | Historical safety | Cost and future use |
| --- | --- | --- |
| A. Metadata overlay keyed by existing WGER IDs | Safest first activation: exact-ID comparison continues and saved records remain untouched. Rename/display aliases and classifications can be overlaid for reviewed IDs. Cannot distinguish two movements sharing one ID; a corrected external reference cannot replace runtime ID. | Smallest change; suitable for a reviewed subset. Long-term coupling to WGER and collision limits remain. |
| B. Stable Nevfit-owned identity and explicit WGER crosswalk | Can represent distinct movements and multiple external references, including future catalogue growth. Requires a versioned, one-to-many-aware bridge for legacy IDs, a policy for ambiguous records, and coordinated changes across routines, active sessions, snapshots, Rob, backups, search and notes. | More maintainable long term but a larger migration and test surface. Unresolved legacy ambiguity cannot be repaired by schema alone. |

**Recommendation:** activate only a small, human-reviewed metadata overlay first, using existing runtime IDs and keeping full WGER lookup for legacy records. Do not enable any preferred-ID replacement or merge. Use stable Nevfit identities later only after explicit crosswalk design, ambiguity review, backup compatibility, dual-read tests, and a separately approved implementation checkpoint. Classification overlays should show unknowns and provenance rather than inherit WGER values or assign secondary-muscle set multipliers.

**Rollback:** version the overlay and retain the prior catalogue and raw snapshots. Revert selection/display metadata to the previous version without altering workouts, routines, active sessions or backups. Verify exact-ID previous-performance results and historical snapshot rendering before activation and after rollback.

**Evidence gate:** reviewer-confirm movement/equipment/variant and anatomy for each activated row; resolve shared candidate IDs; test representative search and Rob selection; test rename, corrected reference, collision, substitution, old snapshot, backup round trip, and active-workout continuity against realistic fixtures. User verification should check their actual routine names and history, including Seated Leg Curl and other corrected-ID examples. No production rollout is authorised by this assessment.
