# Checkpoint 048 — proposed exercise mapping review

This is an offline research artefact, not an approved replacement catalogue. The source is the 247-row `Exercise Master` tab of `Nevfit_Exercise_Master_Research_Draft-NB Program.xlsx`; the comparison source is the committed 907-entry `functions/src/rob/robExerciseCatalogue.v2.json` snapshot. `node scripts/buildExerciseCatalogueMapping.mjs` reproduces the mapping and counts. Spreadsheet rows remain traceable by `sourceRow` in `exercise-catalogue-mapping.json`.

## Coverage and interpretation

| Status | Rows | Meaning |
| --- | ---: | --- |
| `protected_existing_id` | 28 | User-supplied routine ID; historical reference must remain intact, regardless of candidate quality. |
| `strong_candidate` | 21 | Normalised snapshot name agrees, source equipment supports the proposed equipment, and the broad primary group does not conflict; still requires movement review. |
| `needs_review` | 71 | A lexical/equipment candidate exists but variant, equipment, classification, or identity is uncertain. |
| `no_suitable_match` | 127 | Conservative automated search found no defensible candidate; this does **not** prove WGER has no suitable movement. |

All 247 source rows are represented. The 28 historical IDs are distinct and all resolve in the committed snapshot. Six cells contain user-supplied preferred ID text: five are valid snapshot IDs; `wger-2634?` (Seated Dip Machine, row 247) is deliberately retained as unconfirmed text, not treated as an ID. No ID in this deliverable authorises historical replacement. The heuristic found 27 rows sharing a suggested ID with another master row; each is flagged and any otherwise strong candidate is downgraded. No master rows are merged.

Equipment distribution: Dumbbell 62, Cable 53, Machine 51, Bodyweight 46, Barbell / EZ-bar 35. Browse groups: Chest 26; Biceps 24; Quadriceps 21; Back—Lats 20; Glutes 19; Triceps 18; Core—Abs 17; Back—Upper/mid back 15; Hamstrings 14; Shoulders—Front delts 13; Forearms/Grip 11; Calves 10; Core—Obliques 9; Adductors/Abductors, Shoulders—Rear delts, and Shoulders—Side delts 8 each; Back—Spinal erectors 6. These are **spreadsheet proposal counts**, not verified physiological coverage.

The mapping contains separate `historicalWgerId`, `preferredWgerId`, `preferredWgerIdRaw`, and `suggestedWgerId` fields with provenance. `canonicalIdentity` is null by design; no production identity has been created. `displayName`, `aliases`, equipment, proposed secondary muscles, source review status and notes remain separate. Suggested WGER name, primary muscle, equipment, alternatives, discrepancies, confidence, and matching evidence support manual review. Confidence is limited to medium even for a strong candidate because this exercise has no independent movement or anatomy validation. Broad primary-muscle labels differ on 22 suggested candidates and four protected historical IDs; these are review flags, not proof that the spreadsheet or WGER is wrong.

## Priority review

1. **Historical identity corrections:** rows 21 (`wger-354` → preferred `wger-684`), 74 (`wger-1109` → `wger-1424`), 105 (`wger-129` → `wger-2632`), 106 (`wger-926` → `wger-1904`), and 179 (`wger-364` → `wger-2626`). Confirm movement, equipment, and whether each prior ID ever represented a different exercise before approving a bridge. Row 247 has an unconfirmed preferred ID.
2. **Historical equipment/movement conflicts:** row 50 is a machine row historically pointing to `wger-1117` Seated Cable Row; row 74 points to Cable Concentration Curl; row 221 points to Upper Back; row 230 points to Machine Lateral Raise with contradictory source equipment noted in checkpoint 047. These require actual variant inspection and possibly user verification.
3. **Shared proposed candidates:** rows 78/80 seated versus standing dumbbell calf raises receive `wger-1620`. Distinct movements must not share a future canonical identity. Other examples include rows 85/86 decline versus flat barbell presses and rows 203/204 seated versus standing overhead presses. The mapping marks each collision. A generic-word false positive for row 229 Seated Dumbbell Lateral Raise was explicitly excluded from the calf-raise candidate.
4. **Unmatched common movements:** Barbell Good Morning, chest-supported machine rows, Dead Bug, 45-degree Leg Press, Smith Machine Hip Thrust, Face Pull, and cable woodchop variants need manual catalogue inspection or an explicit no-match decision.
5. **Anatomy:** 74 master rows explicitly say `Needs anatomy/variant review`; the other 173 say `Proposed`, which is not independent validation. Verify deltoid heads, elbow flexors/extensors, quads/hamstrings, hip abductors/adductors, and compound presses, rows, squats, lunges and hinges. Blank/`—` secondary fields mean unspecified. Do not convert proposed involvement into fractional set credit. WGER primary muscle is recorded for comparison, not used to overwrite the spreadsheet classification.

## Unresolved decisions

- Which preferred IDs, if any, accurately describe the movement going forward? Confirm with a reviewer and the user's actual equipment/setup.
- Which similarly named variants are separate Nevfit exercises versus aliases? Treat all spreadsheet rows as separate review records until resolved.
- For historical IDs that may have been used for more than one movement, user history cannot be reliably divided using ID alone. A name, routine context, date, or manual record review may help particular records, but no general split is proven.
- Source equipment is often absent, especially for machines. A name saying “machine” is not a verified hardware description.

The source workbook's reference links are broad research starting points, not row-specific evidence. This checkpoint made no network claims about them, no paid AI calls, and no personal Firestore reads.
