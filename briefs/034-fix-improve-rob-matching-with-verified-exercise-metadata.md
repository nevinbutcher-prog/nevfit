# Codex Brief — Improve Rob Exercise Matching Using Real-World QA Evidence

**Project:** Fitbot (Nevfit)  
**Card:** 04A — Improve Rob Exercise Matching Accuracy and Library Coverage  
**Type:** Targeted follow-up  
**Priority:** High  
**Baseline:** `bc2597b`  
**Phase:** Exercise Resolution

## Objective

Improve Fitbot's deterministic matching of Rob-generated exercises against WGER using a real 16-exercise production QA case.

Current results: 7 of 16 exercises automatically matched, leaving 9 requiring manual intervention.

Several failures involve common movements already represented in WGER under different names or equipment metadata. Others are legitimately ambiguous and should remain subject to user confirmation.

Improve matching accuracy and coverage without weakening safeguards against incorrect automatic substitutions.

Do not introduce a second exercise provider, paid AI matching calls or persistent user mapping infrastructure.

## 1. Investigate the Entire Matching Pipeline

Inspect the existing implementation, particularly:

- `src/services/exerciseProvider.js`
- `src/services/exerciseResolution.js`
- `src/services/rob/robProgramResolution.js`
- Relevant tests and existing aliases.

For every example below, determine:

1. Whether the intended WGER record exists.
2. Whether provider search returns it.
3. Whether name normalization recognises it.
4. Whether resolver scoring evaluates it appropriately.
5. Whether equipment and other metadata provide useful disambiguation.
6. Whether automatic matching is safe or user confirmation is required.

**Distinguish retrieval failures from resolution failures.**

Do not compensate for poor retrieval simply by lowering confidence thresholds.

## 2. Real-World QA Dataset

Use the following 16 exercises as regression fixtures.

These are observations from actual Fitbot manual testing, not hypothetical examples.

| # | Rob suggested | WGER result / observation | Expected behaviour |
|---|---|---|---|
| 1 | Barbell Bench Press | Bench Press; equipment: Barbell | Automatically match if equipment and movement are verified |
| 2 | Cable Flyes | Fly with Cable; also upper/lower chest variants | Auto-match only if the general fly is unambiguously equivalent; otherwise offer choices |
| 3 | Lat Pulldown | Lat Pull Down | Preserve correct automatic match |
| 4 | Dumbbell Bent-Over Row | Bent Over Dumbbell Rows | Automatically match equivalent wording |
| 5 | Dumbbell Deadlift | Dumbbell Deadlift | Preserve correct automatic match |
| 6 | Seated Dumbbell Shoulder Press | Shoulder Press, Dumbbells; no explicit seated designation | Require confirmation unless seating is verified |
| 7 | Pull-ups | Three WGER records with identical display names | Do not arbitrarily choose an ID; show distinguishable choices or explain ambiguity |
| 8 | Plank | Plank | Preserve correct automatic match |
| 9 | Russian Twists with Weight | Russian Twist | Require confirmation unless weighted execution is verified |
| 10 | Dumbbell Side Bends | Side Dumbbell Trunk Flexion | Investigate as a curated movement synonym |
| 11 | Treadmill Sprints | Run – Treadmill | Treat as possible substitution; sprint intensity is not established |
| 12 | Cable Woodchoppers | Cable Woodchoppers | Preserve correct automatic match |
| 13 | Barbell Squat | Barbell Full Squat | Preserve correct automatic match, subject to verified movement equivalence |
| 14 | Leg Press Machine | Leg Presses (Quads) / Leg Press (Hamstrings) | Require confirmation where movement emphasis is not established |
| 15 | Seated Leg Curl | Machine Seated Leg Curl | Preserve correct automatic match |
| 16 | Calf Raises on Machine | Calf Raises on Hackenschmitt Machine | Investigate possible overmatch; generic equipment must not silently become specific equipment |

Record the actual WGER IDs and relevant metadata during investigation. Do not invent fixture IDs or assume these names represent unique records.

## 3. Improve Name Normalization

Address harmless naming differences such as:

- Word order: `Dumbbell Bent-Over Row` versus `Bent Over Dumbbell Rows`.
- Singular/plural: `Row` versus `Rows`.
- Equipment placement: `Barbell Bench Press` versus `Bench Press` with Barbell equipment.
- Alternate names: `Dumbbell Side Bend` versus `Side Dumbbell Trunk Flexion`.
- Common punctuation, hyphenation and spacing differences.

Prefer reusable deterministic normalization over an expanding collection of one-off string replacements.

Where a synonym is genuinely equivalent but cannot be derived safely through generic normalization, use a small curated, explicitly documented mapping.

Preserve the distinction between naming equivalence and exercise substitution.

## 4. Use Exercise Metadata for Matching

Fitbot already receives provider metadata such as equipment and muscle groups.

Assess whether this information can improve matching when movement names omit important information.

Example:

Rob: `Barbell Bench Press`

WGER:
- Name: `Bench Press`
- Equipment: `Barbell`

If the movement is otherwise equivalent and the verified equipment agrees, the match should not fail simply because WGER places equipment outside its display name.

Requirements:

- Use verified provider metadata, not AI-supplied metadata, as evidence.
- Equipment can support a match but cannot override a contradictory movement name.
- Missing metadata must not be treated as positive evidence.
- Conflicting equipment should prevent automatic selection.
- Muscle metadata may help disambiguate, but shared muscle groups alone do not prove exercise equivalence.
- Keep the algorithm deterministic, testable and explainable.

Do not create a complex scoring engine unless evidence demonstrates that simpler changes are insufficient.

## 5. Preserve Movement and Variant Safety

The existing `bc2597b` safeguards must remain effective.

Specifically:

- Dumbbell Bicep Curl must not automatically match Dumbbell Bicep Curl and Press.
- Flat pressing must not automatically match incline pressing.
- Seated shoulder press must not silently become standing shoulder press.
- Weighted Russian twists must not silently become an unspecified variation.
- Treadmill sprints must not silently become ordinary treadmill running.
- Generic machine calf raises must not automatically become a specific machine variation without justified equivalence.

Continue distinguishing:

**Equivalent naming:** Safe for automatic matching when confidently established.

**Unspecified variant:** May need user confirmation.

**Different movement:** Must not automatically match.

Prefer an ambiguous or unresolved outcome over an incorrect confident match.

## 6. Handle Duplicate Provider Records

Investigate WGER's multiple Pull-ups records.

Determine whether they are:

- Genuine duplicate records.
- Different exercise variants.
- Different equipment or muscle configurations.
- Distinct IDs representing otherwise equivalent movements.

Do not select an arbitrary record merely because multiple entries have the same display name.

If distinct variants exist, preserve them as choices and show distinguishing metadata.

If records are genuinely equivalent duplicates, consider deterministic grouping or ranking using verified metadata and documented rules.

Do not discard genuine exercise variations to simplify the interface.

Any changes to provider result deduplication must avoid accidentally merging distinct movements.

## 7. Curated Matchups

A small curated mapping layer is permitted where evidence supports it.

For example, if verified against WGER:

- `Dumbbell Side Bends` ↔ `Side Dumbbell Trunk Flexion`.

Requirements:

- Use real provider IDs or validated library identities.
- Document why each mapping is considered equivalent.
- Keep the mapping small and maintainable.
- Do not automatically equate personal substitutions with synonyms.
- Do not allow curated aliases to override conflicting equipment or exercise variants.
- Add a regression test for every curated mapping introduced.

No Firestore persistence or user-learning implementation in this card.

## 8. Diagnostics and Measurement

Provide a reproducible local diagnostic harness or test report for the 16-exercise dataset.

For each exercise report:

- Requested name.
- Retrieved WGER candidates.
- Selected automatic match, if any.
- Match confidence/category.
- Reason for ambiguity or failure.
- Whether the issue was retrieval, normalization, metadata or safety-related.

Do not expose sensitive information.

No production user data is necessary; the supplied QA exercise names are sufficient.

### Metrics

Report:

- Automatically resolved: X/16.
- Correctly ambiguous: Y/16.
- Unresolved: Z/16.
- Unsafe automatic matches: X/16.

The goal is to materially reduce unnecessary manual intervention while maintaining **zero known unsafe automatic matches** in this dataset.

Do not target an arbitrary percentage by weakening confidence thresholds.

## 9. Integration Requirements

Preserve existing:

- Whole-program generation.
- Multi-routine matching.
- Manual exercise search and replacement.
- Provider-backed selection validation.
- Original candidate immutability.
- Candidate fingerprints and stale-result handling.
- Bounded concurrency.
- Executable proposal validation.
- Existing single-routine resolution.
- No paid regeneration for matching decisions.

Do not change saved programs or active workouts.

## 10. Testing

Add regression coverage for all 16 production examples, using verified provider metadata where available.

Include focused tests covering:

- Word-order invariance.
- Singular/plural normalization.
- Equipment-aware equivalence.
- Conflicting equipment.
- Missing equipment metadata.
- Original provider names and aliases.
- Curated exercise synonyms.
- Multiple identically named WGER records.
- Safety-sensitive variants.
- Curl versus curl-and-press.
- Flat versus incline press.
- Generic versus specific machine variants.
- Provider search returning no suitable record.
- Genuine movement absent from provider results.
- Existing manual replacement.
- Existing single-routine matching.

Use real WGER records for the diagnostic evidence where practical; keep automated tests deterministic with captured, appropriately scoped fixtures.

Avoid fragile tests depending on live WGER availability.

## 11. Documentation

Update relevant technical and current-state documentation.

Document:

- Root causes identified.
- Normalization changes.
- Metadata-based matching rules.
- Curated aliases added.
- Duplicate-record handling.
- Remaining unavoidable ambiguities.
- Before/after results from the 16-exercise fixture set.

Keep the documentation proportional to the implementation.

## 12. Verification and Release

Run:

- Full application tests.
- Functions tests if affected.
- Root and Functions lint.
- Production build.

Review the diff for scope creep.

Commit, push and deploy to Vercel only after verification.

Firebase deployment is unnecessary unless server-side code actually changes.

Suggested commit:

`fix: improve Rob matching with verified exercise metadata`

## 13. Out of Scope

Do not implement:

- New exercise providers.
- AI-powered exercise matching.
- Persistent personal or community mappings.
- Automatic recording of user-confirmed matches.
- Conversational exercise substitutions.
- Program approval or saving.
- New training-volume generation logic.
- Broad Rob interface redesign.
- Card 05 functionality.

## 14. Completion Debrief

Report:

1. Root causes for the failed matches.
2. Before/after classification for all 16 exercises.
3. Verified WGER identities and metadata used.
4. Normalization and synonym changes.
5. Metadata-matching rules and safety constraints.
6. Duplicate-record findings.
7. Any remaining incorrect or unnecessary manual matches.
8. Regression tests added.
9. Tests, lint and build results.
10. Commit SHA and deployment status.

If certain cases cannot be improved safely, explicitly retain them as ambiguous and explain why.

