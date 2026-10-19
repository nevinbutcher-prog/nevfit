# Checkpoint 050 — Nevfit-owned catalogue foundation

This checkpoint creates a complete **offline** Nevfit catalogue from the 247-row master workbook. It is not imported by live search, routine building, workout logging, or Rob generation. No historical workout or Firestore document is changed.

## Coverage

| Measure | Result |
| --- | ---: |
| Canonical Nevfit entries and committed IDs | 247 |
| Primary-muscle classifications | 247 |
| Entries with proposed secondary involvement | 184 |
| Entries with a more specific subdivision | 46 |
| Partially reviewed metadata from checkpoint 049 | 12 |
| Provisional metadata | 235 |
| Fully verified entries | 0 |
| Selected optional WGER references | 42 |
| Entries without a selected WGER reference | 205 |
| Unselected WGER review candidates | 66 |
| Protected historical WGER relationships | 28 |

Every master row remains represented, including distinct named variants. The only display-name correction is the apparent source typo “Preacher Dumbbell Curl Curl” → “Preacher Dumbbell Curl”; the source wording is kept as an alias and in the identity registry. No ID is derived from a row position or recalculated during application use. The committed registry fixes IDs independently of subsequent display names. Three bodyweight-labelled master rows have a more specific equipment category in the catalogue: Lateral Band Walk (`band`), Stability Ball Leg Curl (`stability_ball`), and Ab Wheel Rollout (`ab_wheel`). The master label and the correction reason remain traceable.

The catalogue distinguishes `browseGroup` from `primaryMuscles`, `secondaryMuscles` and `subdivisions`. A chest press, for example, browses under Chest and retains proposed triceps and front-deltoid participation. A hip abduction movement may browse under Glutes while its primary anatomical group is Hip abductors. The controlled vocabulary includes the requested 18 main groups, named anatomical terms where the spreadsheet supplied them, and explicit unspecified terms. The [ACE exercise library](https://www.acefitness.org/resources/everyone/exercise-library/body-part/) and [NASM exercise library](https://www.nasm.org/workout-exercise-guidance) support the broad taxonomy and some representative movement distinctions. They do not verify every row or establish equivalence to particular WGER IDs. All classifications remain provisional unless their specific fields were already reviewed in checkpoint 049. No set credit or recovery estimate is inferred.

The 42 selected WGER references comprise the 21 nonhistorical strong candidates from checkpoint 048 plus 21 additional snapshot matches reviewed for movement name and equipment. They are optional external references, not Nevfit identities or historical equivalence claims. Another 66 suggested IDs remain `candidateWgerId` only. The other entries are valid without WGER. A selected WGER ID is never assigned to two catalogue entries. WGER primary-muscle labels were not copied into Nevfit classifications.

## Identity and ambiguity

`src/data/nevfitExerciseIdentityRegistry.v1.json` assigns each ID once. `src/data/nevfitExerciseCatalogue.v1.json` contains the 247 records, including names, aliases, equipment, movement pattern and variant tags, proposed muscle data, source and confidence. Optional media fields are deliberately absent; the validation contract permits later description, instructions, image/video references and attribution without requiring media now.

`evaluation/nevfitLegacyExerciseCrosswalk.v1.json` maps each of the 28 user-supplied historical WGER IDs to one Nevfit ID while keeping preferred WGER text and IDs separate. All 28 relationships explicitly prohibit automatic history attribution. Twenty-two need variant review and six retain unresolved historical context. The Seated Leg Curl relationship is `nevfit-seated-leg-curl` ↔ historical `wger-364`, with preferred `wger-2626` only as a review reference. It does not make those two WGER histories equivalent.

Possible duplicate or alias groups are flagged, not merged: Cable Face Pull/Face Pull; Reverse Barbell Curl/Barbell Reverse Curl; the generic and two directional Cable Woodchops; and two Dumbbell Side Bend labels. Other variant distinctions, including seated versus lying leg curl, incline versus flat presses, equipment, grip, laterality and angle, retain separate IDs. A historical WGER ID could have denoted more than one movement in old logs; without record-level evidence, the crosswalk must not divide or merge those sets.

## Remaining evidence and risks

- Most secondary involvement is copied from the user's proposed spreadsheet and has not been reviewed exercise by exercise. A blank secondary list means unspecified, not no assisting muscles.
- Movement pattern and variant tags are conservative name-based metadata. They are useful for review and future filtering, not a validated biomechanics model.
- WGER reference coverage is intentionally selective. The 66 candidate-only links require movement/equipment inspection before promotion.
- The future workload dashboard must decide how to count compound sets, subdivisions and uncertain secondaries. This checkpoint assigns no fractional multipliers.
- Legacy WGER records absent from this 247-entry list must remain readable through their existing provider lookup when the new catalogue is activated.

The pure validator and tests establish structure, ID uniqueness, muscle/equipment vocabulary, WGER optionality, historical separation and representative old-workout behaviour. They do not establish user acceptance or anatomical verification of every entry.
