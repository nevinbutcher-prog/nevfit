# Checkpoint 051B — Historical exercise identity review

Source: private read-only account preflight dated 2026-10-20; Nevfit 247-exercise catalogue; committed WGER snapshot; original 28-entry crosswalk. This report contains aggregate exercise identity information only. It has no account or document identifiers or workout details.

## Summary

The preflight contains 60 completed workouts, 330 historical workout exercise references and 45 saved routine references. There are no active workout or note references. It contains 68 distinct WGER IDs: 27 from the original crosswalk and 41 additional IDs. The expanded crosswalk also retains `wger-1012` from the original crosswalk with zero observed references.

| Class | Observed IDs | Workout references | Routine references | Treatment |
| --- | ---: | ---: | ---: | --- |
| A — user confirmed | 1 | 10 | 1 | Include in a future reviewed plan; no live write authorised. |
| B — strong proposal | 33 | 171 | 19 | Seek mapping approval before migration. |
| C — clarify | 28 | 131 | 22 | Hold until movement or equipment is resolved. |
| D — no safe match | 6 | 18 | 3 | Retain the historical identity. |

The confirmed plus strong proposed group covers **181 workout and 20 routine references** if all B proposals are approved and a fresh preflight still matches. Only the A relationship has prior user confirmation (10 workout and 1 routine reference). C could add at most 131 workout and 22 routine references after clarification; four `wger-1444` workouts labelled “Unknown exercise” cannot be assigned from their saved name. These are aggregate potential counts, not an approved or executed migration.

## A — user confirmed

| WGER ID | Recorded names | Proposed Nevfit ID | Workouts / routines |
| --- | --- | --- | ---: |
| wger-364 | Leg Curl | nevfit-seated-leg-curl (Seated Leg Curl) | 10 / 1 |

The user confirmed that every historical `wger-364` workout used a seated leg curl machine. The original completed workout name remains “Leg Curl”; only its identity would change in an eventual approved migration. This confirmation is an identity mapping decision, not Firestore execution approval.

## B — strong proposed matches (mapping approval pending)

| WGER ID | Recorded names | Proposed Nevfit ID | Workouts / routines |
| --- | --- | --- | ---: |
| wger-20 | Arnold Shoulder Press | nevfit-arnold-press (Arnold Press) | 2 / 1 |
| wger-91 | Biceps Curls With Barbell | nevfit-standing-barbell-curl (Standing Barbell Curl) | 6 / 0 |
| wger-172 | Crunches on Machine | nevfit-abdominal-crunch-machine (Abdominal Crunch Machine) | 8 / 1 |
| wger-202 | Dumbbell Concentration Curl | nevfit-concentration-curl (Concentration Curl) | 5 / 0 |
| wger-222 | Facepull | nevfit-cable-face-pull (Cable Face Pull) | 15 / 1 |
| wger-272 | Hammer Curls | nevfit-hammer-curl (Hammer Curl) | 1 / 0 |
| wger-348 | Lateral Raises | nevfit-dumbbell-lateral-raise (Dumbbell Lateral Raise) | 14 / 2 |
| wger-369 | Leg Extension | nevfit-leg-extension-machine (Leg Extension Machine) | 10 / 1 |
| wger-465 | Preacher Curls | nevfit-preacher-ez-bar-curl (Preacher EZ-bar Curl) | 3 / 1 |
| wger-537 | Incline Bench Press - Dumbbell | nevfit-incline-dumbbell-bench-press (Incline Dumbbell Bench Press) | 3 / 1 |
| wger-538 | Incline Bench Press - Barbell | nevfit-incline-barbell-bench-press (Incline Barbell Bench Press) | 1 / 0 |
| wger-572 | Shrugs, Dumbbells | nevfit-dumbbell-shrug (Dumbbell Shrug) | 1 / 0 |
| wger-584 | Single-arm Preacher Curl | nevfit-preacher-dumbbell-curl (Preacher Dumbbell Curl) | 1 / 0 |
| wger-627 | Stiff-legged Deadlifts | nevfit-stiff-leg-deadlift (Stiff-leg Deadlift) | 5 / 0 |
| wger-684 | Underhand Lat Pull Down | nevfit-underhand-lat-pulldown (Underhand Lat Pulldown) | 6 / 0 |
| wger-702 | Calf raises, one legged | nevfit-single-leg-calf-raise (Single-leg Calf Raise) | 7 / 0 |
| wger-926 | Machine chest fly | nevfit-pec-deck-fly (Pec Deck Fly) | 10 / 1 |
| wger-1277 | Incline Dumbbell Press | nevfit-incline-dumbbell-bench-press (Incline Dumbbell Bench Press) | 1 / 0 |
| wger-1283 | Incline Chest-Supported Dumbbell Row | nevfit-incline-bench-dumbbell-row (Incline Bench Dumbbell Row) | 6 / 0 |
| wger-1470 | 1-Arm Half-Kneeling Lat Pulldown | nevfit-single-arm-cable-lat-pulldown (Single-arm Cable Lat Pulldown) | 3 / 1 |
| wger-1513 | Overhead Cable Tricep Extension | nevfit-overhead-cable-triceps-extension (Overhead Cable Triceps Extension) | 13 / 2 |
| wger-1551 | Push-Up | nevfit-push-up (Push-up) | 3 / 1 |
| wger-1651 | Dumbbell Rear Lunge | nevfit-dumbbell-reverse-lunge (Dumbbell Reverse Lunge) | 4 / 2 |
| wger-1652 | Dumbbell Romanian Deadlift | nevfit-dumbbell-romanian-deadlift (Dumbbell Romanian Deadlift) | 6 / 1 |
| wger-1694 | Flat Machine Press | nevfit-seated-chest-press-machine (Seated Chest Press Machine) | 1 / 0 |
| wger-1726 | Straight-Arm Pulldown | nevfit-straight-arm-cable-pulldown (Straight-arm Cable Pulldown) | 1 / 0 |
| wger-1748 | Machine Hip Abduction | nevfit-hip-abduction-machine (Hip Abduction Machine) | 4 / 1 |
| wger-1772 | Reverse crunch | nevfit-reverse-crunch (Reverse Crunch) | 8 / 0 |
| wger-1801 | Barbell Full Squat | nevfit-barbell-back-squat (Barbell Back Squat) | 6 / 0 |
| wger-1900 | Tricep Rope Pushdowns | nevfit-rope-triceps-pushdown (Rope Triceps Pushdown) | 5 / 0 |
| wger-1972 | Single-Arm Lat Pulldown | nevfit-single-arm-cable-lat-pulldown (Single-arm Cable Lat Pulldown) | 6 / 0 |
| wger-2627 | Machine Chest Press | nevfit-seated-chest-press-machine (Seated Chest Press Machine) | 2 / 1 |
| wger-2659 | Alternating Dumbbell Curl | nevfit-alternating-dumbbell-curl (Alternating Dumbbell Curl) | 4 / 1 |

## C — material clarification needed

| WGER ID | Recorded names | Candidate Nevfit ID | Workouts / routines | Uncertainty |
| --- | --- | --- | ---: | --- |
| wger-48 | No saved name (routine only) | nevfit-reverse-barbell-wrist-curl (Reverse Barbell Wrist Curl) | 0 / 1 | Routine has no recorded name; confirm the WGER reverse barbell wrist curl was intended. |
| wger-75 | Benchpress Dumbbells | nevfit-flat-dumbbell-bench-press (Flat Dumbbell Bench Press) | 8 / 1 | Dumbbell bench press is recorded without an angle; confirm flat versus incline or decline. |
| wger-129 | Incline Chest Press Machine; Chest Press | nevfit-incline-chest-press-machine (Incline Chest Press Machine) | 8 / 1 | One WGER ID has incline machine and generic chest press labels; split by actual movement. |
| wger-184 | Deadlifts | nevfit-conventional-barbell-deadlift (Conventional Barbell Deadlift) | 1 / 0 | Barbell deadlift is clear, but conventional versus another stance is unrecorded. |
| wger-237 | Fly With Cable | nevfit-standing-cable-chest-fly (Standing Cable Chest Fly) | 1 / 1 | Cable fly path and angle are unrecorded; Nevfit has several variants. |
| wger-238 | Fly With Dumbbells | nevfit-dumbbell-chest-fly (Dumbbell Chest Fly) | 5 / 0 | Dumbbell fly angle is unrecorded; confirm standard flat fly. |
| wger-354 | Lat Pull Down | nevfit-underhand-lat-pulldown (Underhand Lat Pulldown) | 7 / 1 | Generic lat pulldown does not establish the underhand grip; do not borrow the preferred reference. |
| wger-371 | Leg Press | nevfit-horizontal-leg-press (Horizontal Leg Press) | 10 / 1 | Generic leg press does not distinguish horizontal, 45-degree or another machine. |
| wger-543 | Shoulder Press, on Machine | nevfit-seated-shoulder-press-machine (Seated Shoulder Press Machine) | 9 / 1 | Machine press is clear but seated posture is unrecorded. |
| wger-567 | Shoulder Press, Dumbbells | nevfit-seated-dumbbell-shoulder-press (Seated Dumbbell Shoulder Press) | 4 / 1 | Dumbbell press is clear but seated versus standing is unrecorded. |
| wger-687 | Overhead Press | nevfit-standing-barbell-overhead-press (Standing Barbell Overhead Press) | 5 / 0 | WGER identifies barbell but seated versus standing is unrecorded. |
| wger-805 | Tricep Pushdown on Cable | nevfit-cable-triceps-pushdown-straight-bar (Cable Triceps Pushdown (Straight Bar)) | 8 / 2 | Cable pushdown attachment is unrecorded; straight bar and rope must stay separate. |
| wger-1109 | Concentration Curl Machine | nevfit-seated-biceps-curl-machine (Seated Biceps Curl Machine) | 8 / 1 | Recorded concentration curl machine conflicts with WGER cable concentration curl; verify equipment and movement. |
| wger-1117 | Seated Cable Row | nevfit-close-grip-seated-cable-row (Close-grip Seated Cable Row) | 6 / 1 | Recorded seated cable row is not the old proposed seated row machine; grip is unrecorded. |
| wger-1185 | Triceps Pushdown | nevfit-cable-triceps-pushdown-straight-bar (Cable Triceps Pushdown (Straight Bar)) | 6 / 0 | Cable pushdown attachment is unrecorded. |
| wger-1370 | Dumbbell Deadlift | nevfit-dumbbell-romanian-deadlift (Dumbbell Romanian Deadlift) | 2 / 1 | Dumbbell deadlift is explicit but Romanian versus conventional hinge range is not. |
| wger-1372 | Triceps Dips | nevfit-seated-dip-machine (Seated Dip Machine) | 10 / 2 | Triceps dips do not establish use of a seated dip machine rather than parallel bars. |
| wger-1378 | Cable Lateral Raises | nevfit-dual-cable-lateral-raise (Dual Cable Lateral Raise) | 7 / 1 | Cable lateral raise is clear, but single-arm versus dual cable is unrecorded. |
| wger-1381 | Upper Back | nevfit-rear-delt-row-machine (Rear Delt Row Machine) | 3 / 1 | Upper Back is too broad to establish rear-delt row machine. |
| wger-1424 | Biceps Curl Machine | nevfit-seated-biceps-curl-machine (Seated Biceps Curl Machine) | 1 / 1 | Generic biceps curl machine does not establish seated machine configuration. |
| wger-1444 | Unknown exercise; Incline Chest Press DB | nevfit-incline-dumbbell-bench-press (Incline Dumbbell Bench Press) | 6 / 0 | Two records identify incline dumbbell press; four say Unknown exercise and must be excluded pending clarification. |
| wger-1486 | Alternating High Cable Row | nevfit-cable-high-row (Cable High Row) | 3 / 1 | Alternating high cable row may differ from the standard bilateral high row. |
| wger-1567 | Alternating dumbbell hammer curl | nevfit-hammer-curl (Hammer Curl) | 1 / 0 | Alternating dumbbell hammer curl lacks an explicit alternating Nevfit variant; confirm shared progression. |
| wger-1654 | Machine Lateral Raise | nevfit-lateral-raise-machine (Lateral Raise Machine) | 3 / 1 | Recorded machine lateral raise conflicts with WGER gym-mat equipment metadata. |
| wger-1893 | Overhead Barbell Press | nevfit-standing-barbell-overhead-press (Standing Barbell Overhead Press) | 1 / 0 | Barbell overhead press is explicit, but standing versus seated is unrecorded. |
| wger-1929 | Assisted Pull-Up | nevfit-assisted-pull-up (Assisted Pull-up) | 4 / 1 | WGER specifies band assistance; verify Nevfit assisted pull-up should share this progression. |
| wger-2503 | Face Pulls | nevfit-cable-face-pull (Cable Face Pull) | 2 / 1 | Recorded Face Pulls lacks WGER snapshot metadata; confirm cable setup before merging with wger-222. |
| wger-2614 | Adductor Machine | nevfit-hip-adduction-machine (Hip Adduction Machine) | 2 / 0 | Recorded Adductor Machine conflicts with WGER bodyweight Adductor Rock Backs identity. |

`wger-1012` is also C in the crosswalk but has no reference in this account preflight and is excluded from these counts.

## D — no safe existing Nevfit identity

| WGER ID | Recorded names | Proposed treatment | Workouts / routines | Gap |
| --- | --- | --- | ---: | --- |
| wger-265 | No saved name (routine only) | Retain WGER identity | 0 / 1 | Generic glute bridge lacks a matching unweighted Nevfit identity; weighted and single-leg variants differ. |
| wger-1466 | Calf Raise using Hack Squat Machine | Retain WGER identity | 4 / 1 | Hack-squat-machine calf raise has no exact Nevfit identity; standing calf machine is different equipment. |
| wger-1519 | Overhead Triceps Extension | Retain WGER identity | 1 / 0 | Overhead EZ-bar triceps extension lacks a corresponding Nevfit identity; cable and dumbbell versions differ. |
| wger-1530 | Lying Dumbbell Curls | Retain WGER identity | 7 / 1 | Lying dumbbell curl has no corresponding Nevfit identity; incline curl changes the movement setup. |
| wger-1828 | Abdominal Draw-In | Retain WGER identity | 4 / 0 | Abdominal draw-in has no corresponding Nevfit identity. |
| wger-1830 | Barbell Step Back Lunge | Retain WGER identity | 2 / 0 | Barbell step-back lunge has no corresponding Nevfit identity; dumbbell reverse lunge differs. |

## Consolidated user questions

1. **Press and hinge variants:** For `wger-75`, was the dumbbell bench press flat, incline or decline? For `wger-129`, were the two “Chest Press” references flat or incline, and should saved routines follow either? For `wger-184` and `wger-1370`, were these conventional barbell and Romanian dumbbell deadlifts respectively?
2. **Leg press and upper-body posture:** Was `wger-371` horizontal, 45-degree or another leg press? Were `wger-543`, `wger-567`, `wger-687` and `wger-1893` seated or standing presses?
3. **Cable paths and handles:** Which angles or grips were used for `wger-237`, `wger-354`, `wger-805`, `wger-1117`, `wger-1185` and `wger-1378`? In particular, keep generic lat pulldown distinct from confirmed underhand `wger-684`, and cable row distinct from a row machine.
4. **Machines versus bodyweight or cable:** Were `wger-1109` and `wger-1424` seated curl machines, `wger-1372` a seated dip machine, and `wger-1381` a rear-delt row machine? The saved `wger-2614` name says “Adductor Machine” while WGER metadata says bodyweight adductor rock backs; which was performed?
5. **Missing or generic history:** What exercise was performed in the four `wger-1444` workouts labelled “Unknown exercise”? Can `wger-2503` be confirmed as a cable face pull? The two `wger-1444` incline dumbbell press records can be reviewed separately. A `wger-48` saved routine has no recorded name; was it reverse barbell wrist curl?
6. **Remaining variant decisions:** Was `wger-238` a standard flat dumbbell fly? Should alternating high cable row (`wger-1486`) and alternating dumbbell hammer curl (`wger-1567`) share the proposed standard identities? Was `wger-1654` a machine lateral raise despite conflicting WGER metadata? Was band-assisted `wger-1929` intended to share the Nevfit assisted pull-up progression?

The D group is a catalogue gap or a movement that differs materially from available variants; it can remain visible under its WGER identity. No new catalogue entry is proposed in this checkpoint.

## Review and migration boundary

A fresh read-only preflight and current full backup are required before any future migration. B and resolved C relationships need explicit mapping approval; exact occurrence exclusions remain possible. The migration writer and rollback are separate controlled actions and this checkpoint does not authorise running them on the real account. User acceptance follows independent code review and verification.
