# Fitbot — Card 04B Corrective Implementation

**Project:** Fitbot (Nevfit)  
**Card:** ROB-PROGRAM-04B  
**Status:** Acceptance failed — corrective implementation required  
**Priority:** Critical  
**Existing commit:** `21767316184d0300fa175d40812835ae00499f72`

## 1. Objective

Correct the catalogue-grounded AI program generation implementation so Rob produces complete, readable, equipment-appropriate workout programs using verified Fitbot exercises.

Three user-facing failures must be resolved:

1. The approved exercise catalogue contains only approximately 35 exercises, with excessive representation of certain movements.
2. Generated programs display raw WGER IDs instead of exercise names.
3. The legacy exercise-matching interface still appears during program generation.

**Required experience:** The user describes their training requirements, Rob generates a complete program, and the user immediately sees recognisable exercises with appropriate prescriptions — without manually identifying or matching exercises.

Retain the existing architecture where appropriate. Do not return to unrestricted free-text exercise generation.

## 2. Exercise Catalogue — Remove Arbitrary Restrictions

The existing 35-exercise approved catalogue and 32-exercise generation limit were implementation decisions, not product requirements.

Remove these arbitrary restrictions.

Maintain three distinct concepts:

- **Verified exercise catalogue:** A comprehensive, maintainable collection of trusted WGER-backed exercises.
- **Generation candidate selection:** A relevant, balanced selection of verified exercises supplied to Rob for a particular program.
- **Prescribed workout structure:** The exercises Rob actually selects for each session, determined by training goals, duration and equipment.

### Catalogue requirements

- Cover major muscle groups and movement patterns.
- Include common machine, cable, dumbbell, barbell and bodyweight exercises.
- Include appropriate compound and isolation movements.
- Avoid excessive duplicate or near-duplicate variants.
- Preserve meaningful variations such as different grips, equipment and movement mechanics.
- Support explicit exercise exclusions.
- Support future My Gym equipment filtering.
- Retain trusted WGER identifiers and human-readable metadata.

Do not introduce another provider.

### Catalogue architecture

Prefer a generated, versioned catalogue derived from real WGER records, rather than maintaining separate hardcoded exercise-ID lists in browser and Firebase code.

Keep exercise identity, name, equipment requirements and relevant movement metadata together.

The server must remain authoritative.

Catalogue updates should be deliberate, repeatable and testable.

Do not rely on live WGER availability during every paid AI generation request.

### Generation selection

Use coverage-aware selection rather than simply sorting by user priorities and taking the first N exercises.

Preserve useful choices across major movement patterns and muscle groups, even when a user emphasises particular muscles.

Ensure sufficient diversity for complete 3-, 4- and 5-day programs.

Do not impose a new arbitrary numerical cap.

Any generation-request bounds must be justified through measured token budget, expected latency and representative coverage tests.

Keep the full verified catalogue separate from the smaller selection supplied to the AI.

**Before expanding the catalogue, report the proposed architecture, catalogue coverage and proposed request-size strategy. Do not proceed with implementation until these decisions have been reviewed.**

## 3. Equipment Compatibility

Rob must respect the equipment actually confirmed in the available-equipment wizard.

Do not assume all equipment is available simply because the user selected a commercial gym.

Exercise eligibility must consider the complete set of required equipment and movement capabilities.

For example:

- Bench availability does not imply barbell availability.
- Dumbbell availability does not imply an adjustable bench.
- A generic machine selection does not imply every specialised machine exists.
- Selecting cables does not make all machine exercises eligible.

Where WGER metadata is missing or ambiguous, avoid making unsupported assumptions. Require verified compatibility for automatic eligibility.

Equipment compatibility must be enforced through trusted validation, not merely AI prompting or browser-side filtering.

### Future My Gym integration

Preserve a clean equipment-context abstraction supporting:

- A saved default gym in Settings.
- A saved home-equipment profile.
- Manual equipment selection.
- A one-program override of the default environment.

Future My Gym profiles, including facilities such as PCYC Ipswich, will provide available equipment and capabilities.

The chosen context should be snapshotted for a generated program so later Settings changes do not silently alter existing programs.

**Do not implement My Gym or new Settings screens in this card.**

Use the existing equipment wizard and its confirmed selections.

## 4. Exercise Exclusions

Maintain a mechanism for excluding particular exercises from Rob's eligible catalogue.

Exclusions must operate at the catalogue-selection layer rather than being optional instructions to the AI.

Requirements:

- Support verified exercise-ID exclusions.
- Reject or safely ignore unknown exclusion IDs without affecting unrelated exercises.
- Ensure excluded exercises cannot be selected in the generated result.
- Preserve compatibility with future persistent user preferences.
- Do not automatically interpret arbitrary free-text injury descriptions as permanent exercise exclusions.

Do not build a new preferences-management interface in this card.

## 5. Human-Readable Program Preview

Generated programs currently display raw WGER IDs.

Investigate and correct catalogue metadata propagation through the complete generation-to-render lifecycle.

Relevant code includes:

- `src/services/rob/robProgramCandidateDetails.js`
- `src/services/rob/robProgramResolution.js`
- `src/components/rob/RobProgramIntake.jsx`
- `src/App.jsx`

Each generated exercise must display:

- Verified exercise name.
- Sets.
- Rep range.
- Rest period.
- Notes, when present.
- Superset relationship, when applicable.

Exercise IDs must remain available internally for proposal construction and validation, but must not appear as normal exercise titles.

Use the trusted catalogue snapshot associated with the generated program.

If metadata is missing, show a recoverable integrity error rather than falling back to displaying `wger-XXXX`.

## 6. Remove Mandatory Matching and Duplicate Preview

The legacy matching interface still appears in the live experience.

Investigate the actual generation-to-render lifecycle rather than assuming an existing conditional is sufficient.

For catalogue-grounded generation:

- Never display the legacy matching panel.
- Never require the user to identify generated exercises.
- Do not display duplicate representations of the program.
- Display one clear, read-only program preview.
- Preserve all generated routines and exercise prescriptions.
- Preserve legacy matching only for genuinely legacy or unsupported workflows.
- Retain the technical ability to replace exercises voluntarily in a later workflow.

The full interactive review, replacement and approval experience belongs to Card 05.

Do not implement Card 05 early.

## 7. Training Program Quality

Rob must produce useful workout programs, not merely structurally valid ones.

For typical 60–75-minute hypertrophy sessions, Rob should generally prescribe approximately **5–8 exercises per session**, unless there is a sound programming reason otherwise.

This is guidance, not a mandatory minimum or maximum.

A seven-exercise session is a useful reference point, but should not become a universal hardcoded target.

Program design should account for:

- Session duration.
- Training goal.
- Sets and repetitions.
- Rest periods.
- Exercise complexity.
- Available equipment.
- Weekly training frequency.
- Muscle-group coverage.
- Requested priorities.
- Recovery requirements.

Avoid padding sessions with unnecessary exercises simply to meet a numerical range.

### Validation

Use conservative, explainable workload-quality checks.

Distinguish hard failures such as fabricated IDs and invalid prescriptions from softer concerns such as limited workload or imbalanced coverage.

Do not introduce automatic paid regeneration loops.

## 8. Security and Proposal Integrity

Preserve the catalogue-grounded trust model.

Requirements:

- The server owns the authoritative verified catalogue.
- Browser-submitted exercise IDs are never trusted without validation.
- AI-generated IDs must belong to the exact authorised catalogue for the request.
- Fabricated, excluded, incompatible and out-of-catalogue IDs must be rejected.
- Missing or stale catalogue metadata must fail safely.
- Program structures and prescriptions remain validated.
- Routine-local superset relationships remain valid.
- Valid output materialises directly into a transient executable proposal.
- No program is automatically saved, activated or scheduled.

Continue using the existing program proposal validation and materialisation architecture wherever practical.

Retain legacy resolution functionality without placing it in the successful catalogue-grounded user journey.

## 9. Failure Handling

Handle these cases explicitly:

- Catalogue unavailable.
- Insufficient eligible exercises.
- Missing display metadata.
- Equipment restrictions eliminating important movement options.
- Conflicting equipment requirements.
- Unsupported AI-generated IDs.
- Stale catalogue or intake context.
- Invalid program prescriptions.
- Incomplete program output.
- Generation timeout or provider failure.

Provide understandable, recoverable errors.

Do not silently fall back to arbitrary exercise names.

Do not make additional paid AI calls without explicit user action.

## 10. Tests and Acceptance Criteria

Add or update tests covering:

### Catalogue

- Broad, representative coverage of conventional strength and hypertrophy exercises.
- Major movement patterns and muscle groups.
- Compound and isolation exercises.
- Machine, cable, dumbbell, barbell and bodyweight options.
- Duplicate handling without erasing meaningful variants.
- Versioning and repeatable catalogue updates.
- Coverage-aware candidate selection.
- Representative 3-, 4- and 5-day programming contexts.
- Request-size and token-budget constraints.

### Equipment and exclusions

- Explicit equipment restrictions are respected.
- All required equipment is considered.
- Commercial-gym selection does not override restrictions.
- Missing equipment metadata does not create false eligibility.
- Excluded exercise IDs cannot appear in generated programs.
- Unknown exclusions do not affect unrelated exercises.

### Generation and rendering

- Every selected ID belongs to the authorised catalogue.
- Fabricated and out-of-catalogue IDs are rejected.
- All generated exercises display verified names.
- No raw WGER IDs appear as exercise titles.
- No legacy matching interface appears for catalogue-grounded generation.
- No duplicate program previews.
- All routines, sets, reps, rest periods and supersets remain intact.
- Representative 60–75-minute hypertrophy programs have plausible workloads and exercise distributions.

### Persistence and regression

- Generated proposals remain transient.
- No automatic save or activation occurs.
- Existing legacy exercise-resolution paths remain functional.
- Existing workout tracking and routine management are unaffected.

Use deterministic fixtures and realistic captured WGER catalogue data.

Do not rely exclusively on small, idealised candidate lists.

**Do not initiate paid AI generation during automated testing.**

Run:

- Application tests.
- Firebase Functions tests.
- Application lint.
- Functions lint.
- Production build.

Deploy changed Vercel and Firebase components only after implementation and validation are complete.

## 11. Implementation Sequence

### Stage A — Architecture checkpoint

Before making the major catalogue changes, report:

- Proposed authoritative catalogue structure.
- Method for sourcing and updating WGER records.
- Approximate catalogue coverage by equipment and movement pattern.
- Strategy for excluding unsuitable or duplicate exercises.
- Approach to equipment eligibility.
- Proposed AI candidate-selection strategy.
- Expected request size and token-budget implications.
- How browser and Firebase will share or verify catalogue identities.

**Stop and obtain review before proceeding to Stage B.**

### Stage B — Implementation

After architectural approval:

1. Expand and restructure the verified catalogue.
2. Correct equipment eligibility and exclusions.
3. Update the generation selection and server validation contracts.
4. Fix human-readable exercise display.
5. Eliminate matching UI and duplicate previews for catalogue-grounded generation.
6. Preserve transient proposal validation.
7. Update tests and documentation.
8. Run full validation and deploy.

Do not implement unrelated cards or future My Gym functionality.

## 12. Final Debrief

Report:

- Root cause of each original acceptance failure.
- Final verified catalogue size.
- Coverage by equipment type and movement pattern.
- How catalogue updates work.
- Actual generation selection limits and their measured justification.
- Equipment compatibility enforcement.
- Exclusion handling.
- Human-readable preview implementation.
- Confirmation that matching UI is absent in catalogue-grounded workflows.
- Program-quality heuristics.
- Security and proposal-validation results.
- Tests, build and deployment status.
- Remaining known limitations.

## Definition of Done

Card 04B is complete only when:

1. Rob has a sufficiently broad, verified exercise catalogue for conventional gym programming.
2. Generation selection preserves relevant exercise variety across an entire multi-day program.
3. Equipment restrictions and exercise exclusions are enforced reliably.
4. Generated programs display real exercise names and complete prescriptions.
5. Catalogue-grounded programs require **zero manual exercise matching**.
6. The user sees one readable program preview.
7. Typical session volume is consistent with the requested duration and training goal.
8. Programs remain transient until explicitly approved in the later workflow.
9. Automated validation passes.
10. Live manual QA confirms the intended experience.

**Final product principle:** Rob should behave like a personal trainer who knows the available exercises and equipment before designing a program. The user reviews Rob's recommendations — they do not have to identify or reconstruct them.