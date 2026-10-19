# Checkpoint 049 — verified metadata overlay and expansion

## Initial batch

The 28 user-supplied historical IDs were checked against the committed 907-entry WGER snapshot and reviewed in `exercise-metadata-review.json`. Each review record keeps the master row, historical WGER name/equipment/muscles, proposed Nevfit fields, preferred-ID text, activated fields, provenance, confidence and unresolved reason. The activation source is `scripts/buildReviewedExerciseOverlay.mjs`; it generates the versioned production file `src/data/exerciseMetadataOverlay.v1.json`. **Twelve IDs have only the listed, medium-confidence fields activated; sixteen remain review-only.** This is field-level review, not a claim that any entire exercise or its anatomy is fully verified.

| ID | Master row | Activation | Held back |
| --- | ---: | --- | --- |
| `wger-1929` | 12 | Review only | Resistance-band assistance versus bodyweight classification. |
| `wger-354` | 21 | Review only | Generic pulldown versus underhand grip; preferred ID unapproved. |
| `wger-222` | 41 | Name, equipment | Back/rear-delt and rotator-cuff emphasis. |
| `wger-572` | 46 | Name, equipment | Shoulders versus upper-back primary classification. |
| `wger-1117` | 50 | Review only | Cable row versus unspecified machine row. |
| `wger-1012` | 62 | Name, equipment, biceps, brachialis | Proposed brachioradialis involvement. |
| `wger-1109` | 74 | Review only | Cable concentration curl versus seated curl machine. |
| `wger-1466` | 84 | Review only | Hack squat machine versus unspecified calf machine. |
| `wger-237` | 93 | Review only | High-to-low angle and anterior-delt secondary. |
| `wger-129` | 105 | Review only | Generic chest press versus incline machine. |
| `wger-926` | 106 | Review only | Generic machine fly versus pec deck. |
| `wger-2627` | 108 | Review only | Seated setup and secondaries unverified. |
| `wger-172` | 126 | Name, equipment, abs | Secondary muscles unspecified. |
| `wger-1748` | 164 | Name, equipment, glutes | Specific glute subdivisions unverified. |
| `wger-1652` | 175 | Name, equipment, hamstrings | Glute/erector secondaries unverified. |
| `wger-364` | 179 | User name, hamstrings | Seated machine setup and calf secondary unverified; `wger-2626` remains only a preferred reference. |
| `wger-1651` | 189 | Name, equipment | WGER glutes versus master quadriceps primary. |
| `wger-371` | 196 | Review only | Generic leg press versus horizontal; primary muscle conflict. |
| `wger-369` | 197 | Name, equipment, quadriceps | Exact device remains uninspected. |
| `wger-20` | 209 | Name, equipment, shoulders, triceps | Deltoid subdivisions unverified. |
| `wger-543` | 213 | Review only | Seated setup and deltoid subdivision. |
| `wger-1381` | 221 | Review only | Generic Upper Back versus rear-delt row machine. |
| `wger-1378` | 224 | Review only | Dual-cable variant and upper-trap secondary. |
| `wger-348` | 226 | Name, equipment, shoulders | Lateral-delt subdivision and upper-trap secondary. |
| `wger-1654` | 230 | Review only | WGER equipment says Gym mat despite machine name. |
| `wger-805` | 237 | Review only | Straight-bar attachment unverified. |
| `wger-1513` | 239 | Name, equipment, triceps | No proposed secondary claim. |
| `wger-1372` | 247 | Review only | Generic dips versus seated dip machine; preferred ID text has `?`. |

The broad anatomical and equipment terms used here agree with the committed WGER snapshot where explicitly noted. The [ACE exercise library](https://www.acefitness.org/resources/everyone/exercise-library/) supplies a useful independent taxonomy; its [seated leg-extension entry](https://www.acefitness.org/resources/everyone/exercise-library/183/seated-leg-extension/) supports machine equipment and legs/thighs for that movement. Those pages do **not** establish that a particular WGER ID is the same variant. No proposed secondary-muscle set multiplier is used.

## Expansion path

The other 219 master rows remain unactivated: 21 `strong_candidate`, 71 `needs_review`, and 127 `no_suitable_match` under checkpoint 048's conservative heuristic. The same versioned ID-keyed schema accepts later reviewed rows, aliases, multiple primary muscles, secondaries, subdivisions, field provenance and confidence. A later batch needs no new runtime exercise identity system. For each candidate: confirm source ID and actual movement/equipment/variant, review each muscle claim against specific evidence, record conflicts and any shared-ID ambiguity, enable only supported fields, regenerate both JSON files, then run overlay, history, provider, Rob-boundary and backup tests. The current source uses explicit decisions rather than treating the spreadsheet's `Proposed` label as verification.

## Compatibility and rollback

The overlay is applied only when WGER metadata is normalised for lookup/search or an already normalised WGER record enters the library. It never changes an `exerciseId`, saved routine, active session, completed snapshot, exercise note or backup payload. Existing active and completed workout names remain their recorded names; a new session can receive a reviewed name. Previous performance continues matching exact `exerciseId`. Unreviewed IDs keep WGER metadata. Rob's server catalogue, generation eligibility and ranking continue reading the unchanged snapshot. Reverting the overlay file or disabling the pure apply function restores WGER display metadata without a data migration.

The main architectural limit is that an ID-keyed overlay cannot safely give two genuinely different movements different metadata when they share one historical WGER ID. Their past performance cannot be divided without additional evidence. The initial overlay also depends on the existing WGER API for lookup/search; it does not create an offline full catalogue.
