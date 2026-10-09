# Codex Implementation Brief — Catalogue-Grounded AI Program Generation

**Project:** Fitbot (Nevfit)  
**Card:** ROB-PROGRAM-04B  
**Title:** Generate Rob Programs Exclusively From Verified Fitbot Exercises  
**Phase:** Program Generation Architecture  
**Priority:** Critical  
**Dependency:** Multi-routine generation and exercise-resolution foundations (Cards 03, 04, 04A)

## 1. Objective

Replace the current free-text exercise generation and subsequent manual matching workflow with catalogue-grounded program generation.

Rob must design complete multi-routine programs using verified exercises from Fitbot's existing WGER-backed exercise library.

Every exercise Rob selects must have a trusted identity established before generation, not inferred afterwards.

The user should receive a complete, usable program without routinely having to identify exercises manually.

Preserve explicit user review, replacement and approval boundaries.

## 2. Product Principle

The current workflow is fundamentally too cumbersome:

1. Rob generates arbitrary exercise names.
2. Fitbot tries to match them against WGER.
3. Multiple ambiguous and unresolved exercises require user intervention.
4. The user effectively helps construct the program Rob was supposed to create.

The replacement workflow:

1. Fitbot prepares a verified, eligible exercise catalogue.
2. Rob receives permitted exercise options and their identifiers.
3. Rob designs the program using those identifiers.
4. Fitbot validates every returned identifier against the supplied catalogue.
5. The resulting program proceeds to executable proposal validation.
6. The user reviews the program and can replace exercises voluntarily.

**Routine manual exercise matching should no longer be part of successful generation.**

## 3. Existing Architecture

Inspect the current repository and documentation before implementing.

Relevant areas include:

- `src/services/exerciseProvider.js`
- `src/services/exerciseResolution.js`
- `src/services/rob/robProgramResolution.js`
- `src/services/rob/robProgramIntake.js`
- `src/components/rob/RobProgramIntake.jsx`
- `src/App.jsx`
- `src/services/programProposal.js`
- `functions/src/rob/robProgramGeneration.js`
- Firebase callable entry points and associated tests

Reuse the existing WGER provider, program-domain validators, intake model, candidate lifecycle and approval safety boundaries.

Do not introduce another exercise provider.

Do not remove existing exercise resolution services, which remain useful for legacy workflows and exceptional cases.

## 4. Verified Exercise Catalogue

Create a controlled catalogue-selection layer using actual WGER exercise records.

Each eligible exercise should carry:

- Trusted WGER-backed ID.
- Canonical display name.
- Equipment metadata.
- Relevant muscle/body-part information.
- Original provider identity.
- Enough variation information to distinguish different movements.

### Catalogue eligibility

Support excluding exercises that are:

- Clearly unsuitable for general programming.
- Incomplete or malformed.
- Duplicated in a way that creates confusing alternatives.
- Unsupported by the selected equipment context.
- Explicitly excluded by the user's preferences.

Do not treat unusual exercise names as inherently invalid.

An exercise must be excluded for a documented reason or explicit user preference, not solely because it appears unfamiliar.

### Catalogue size

Do not send all approximately 920 WGER records to Rob indiscriminately.

Prepare a bounded, useful selection relevant to the user's requested goals, equipment, priorities and training frequency.

Avoid a tiny fixed shortlist that causes repetitive programs or omits major movement patterns.

Codex should determine reasonable selection bounds based on the existing provider data and AI request-size limits, and document the trade-offs.

The catalogue must provide sufficient coverage for realistic multi-day hypertrophy, strength and general fitness programs.

## 5. Critical Trust Boundary — Client to Firebase

The catalogue is initially retrieved through Fitbot's existing browser-side WGER provider.

However, **Firebase must not blindly trust exercise IDs, eligibility flags or catalogue metadata supplied by the browser**.

Design a trustworthy server-side validation mechanism for catalogue-grounded generation.

Possible approaches include:

- A server-owned verified catalogue snapshot.
- A versioned curated catalogue of provider-backed IDs.
- Server-side verification of selected catalogue records.

Choose the smallest maintainable approach that does not depend on trusting arbitrary client-provided exercise records.

Ensure the system can operate within Firebase's existing runtime, token and latency constraints.

Do not expose provider credentials or privileged controls to the client.

## 6. Catalogue-Grounded Generation Contract

Modify the Rob generation request and response contracts as needed.

Rob should receive a bounded list of eligible exercises, each with a compact identifier and relevant descriptive metadata.

For example:

```json
{
  "id": "wger-123",
  "name": "Dumbbell Bench Press",
  "equipment": ["Dumbbell", "Bench"],
  "primaryMuscle": "Chest"
}
```

The ID is illustrative.

Rob's generated program should refer to those approved catalogue identities rather than arbitrary movement names.

### Required validation

- Every generated exercise ID must belong to the exact authorised catalogue for that generation request.
- Reject fabricated or unsupported IDs.
- Reject exercises outside the confirmed eligibility context.
- Preserve strict prescription limits.
- Preserve routine counts and program-size limits.
- Preserve valid routine-local superset relationships.
- Never substitute an unsupported exercise silently.
- Reject incomplete or malformed program structures.

The trusted validation must occur outside AI output.

The AI must not be able to expand its own catalogue or introduce new exercise identities.

## 7. Equipment Context — Future My Gym Compatibility

Design catalogue eligibility around an equipment-context abstraction.

This is important because Fitbot will eventually support **My Gym**, including user-created gym equipment profiles such as PCYC Ipswich.

Future equipment sources should include:

- A saved default gym from user settings.
- A saved home equipment profile.
- Manual equipment selection.
- A temporary override for one program.

### Expected future UX

Settings determines the default training environment.

Rob's available-equipment wizard preselects that environment, but allows the user to change it for an individual program.

For example:

- My Gym — PCYC Ipswich.
- My Home Equipment.
- Choose Equipment Manually.

The selected equipment context must be captured as a snapshot for the generated program. Later changes to the user's default gym must not silently change the program or its eligibility baseline.

### Scope restriction

Do not build My Gym, equipment mapping, new settings screens or shared gym profiles in this card.

For now, use the existing confirmed equipment selections from Rob's intake.

Create a clean interface through which a future saved gym profile can supply equivalent capabilities and exclusions.

Do not hardcode PCYC Ipswich or specific facility equipment.

## 8. User Exercise Exclusions

Support a future-friendly way to exclude exercises from Rob's permitted catalogue.

Examples:

- Exercises the user dislikes.
- Exercises the user does not want prescribed.
- Exercises incompatible with known constraints.
- Exercises unavailable in the selected training environment.

These must be explicit eligibility exclusions, not unreliable prompt suggestions.

### Current card scope

Implement the domain-level exclusion capability and apply it during catalogue construction.

Reuse existing constraint information where safely possible.

Do not infer structured permanent exclusions automatically from arbitrary free-text injury descriptions.

Do not build a complete preferences-management screen.

A future settings feature may persist excluded exercise IDs and preferences.

Unknown exclusion IDs must not silently alter unrelated catalogue entries.

## 9. Program Volume and Duration

Address the repeated QA observation that Rob generates only three or four exercises and approximately 13 sets for a requested 75-minute hypertrophy session.

This card should improve Rob's programming guidance and introduce bounded structural checks.

Rob should consider:

- Available session duration.
- Sets and reps.
- Rest periods.
- Exercise complexity.
- Training frequency.
- Weekly movement-pattern coverage.
- Requested muscle priorities.
- Recovery demands.

Avoid imposing a universal rule that every session must contain six exercises or a fixed number of sets.

However, a 75-minute hypertrophy program should not repeatedly produce obviously underfilled sessions without a meaningful reason.

### Validation approach

Introduce a deterministic, non-medical program-quality assessment that can flag substantially underutilised requested duration or incomplete coverage.

Distinguish:

- Hard contract failures: invalid IDs, malformed prescriptions, missing routines.
- Quality concerns: limited movement-pattern coverage, implausibly low session workload.

Do not automatically discard otherwise valid programs based solely on a simplistic estimated duration.

Avoid repeated paid regeneration loops.

Keep any heuristic conservative, explainable and tested.

## 10. Direct Executable Proposal Materialisation

Once Rob returns a valid catalogue-grounded program, convert it directly into the existing trusted `create_program` proposal shape.

Reuse:

`validateProgramProposal()`

The completed proposal must contain Fitbot-owned IDs and verified exercise identities.

Preserve:

- Routine order.
- Exercise order.
- Sets.
- Rep ranges.
- Rest periods.
- Notes.
- Valid superset grouping.

Do not call `applyProgramProposal()`.

Do not save or activate the generated program.

Retain the original generation context for later review.

## 11. Preserve Manual Replacement Without Mandatory Matching

Users must remain able to change a proposed exercise voluntarily.

Example:

Rob selects a valid barbell row from the approved catalogue.

The user prefers a seated cable row.

The user can search Fitbot's exercise library and replace it with another verified movement.

This should not require regenerating the program.

Keep existing manual replacement functionality where practical.

However:

- Do not require the user to confirm already trusted exercise IDs.
- Do not present a mandatory matching stage for successful catalogue-grounded generation.
- Do not show duplicate matching UI beneath the generated program.
- Do not force manual substitutions to be stored as global synonyms.

The full unified review experience will be handled in Card 05.

## 12. Failure and Recovery

Handle:

- WGER unavailable.
- Catalogue unavailable or empty.
- Insufficient eligible exercises.
- Conflicting equipment constraints.
- AI returns a fabricated catalogue ID.
- AI returns an incomplete program.
- Invalid prescriptions.
- Generation timeouts.
- Stale intake or catalogue snapshot.
- Repeated Generate clicks.
- Provider changes between catalogue construction and generation.

Never silently fall back to unconstrained free-text generation.

Provide clear error messages and a safe retry path.

Do not issue additional paid AI requests automatically.

If the verified catalogue is insufficient, explain the limitation rather than invent unsupported exercises.

## 13. Tests

Add focused tests for:

1. Verified catalogue construction.
2. Invalid provider records.
3. Catalogue duplicate handling.
4. Relevant equipment filtering.
5. Missing and conflicting equipment.
6. Explicit exclusions.
7. Unknown exclusion IDs.
8. Future equipment-context adapter compatibility.
9. Bounded catalogue size.
10. Representative exercise coverage for gym, home and minimal-equipment contexts.
11. AI selecting only supplied IDs.
12. Fabricated and out-of-catalogue IDs.
13. Stale catalogue/candidate fingerprints.
14. Valid whole-program materialisation.
15. Strict executable proposal validation.
16. Original prescriptions and routine order.
17. Optional valid supersets.
18. Quality heuristics for 45-, 60- and 75-minute sessions.
19. Existing single-routine resolution.
20. No accidental program persistence.
21. No unexpected additional paid AI calls.
22. No mandatory matching stage for trusted generated exercises.
23. Voluntary user exercise replacement.
24. Error recovery when the provider catalogue is unavailable.

Include at least one full end-to-end mocked generation test using a realistic multi-routine, catalogue-grounded program.

Avoid relying exclusively on idealised, manually supplied provider candidates.

## 14. Documentation

Update:

- Product documentation.
- Technical architecture documentation.
- Current-state documentation.

Clearly describe the new catalogue-grounded generation architecture and its trust boundaries.

Explain how the existing manual resolver remains available for legacy workflows.

Document catalogue versioning, refresh behaviour, exclusions and future My Gym integration points.

## 15. Explicitly Out of Scope

Do not implement:

- My Gym settings or facility profiles.
- Community gym equipment mapping.
- Persistent personal exclusion settings.
- A second exercise provider.
- Unrestricted AI-generated exercise names.
- Persistent user-confirmed synonym learning.
- Conversational exercise substitutions.
- Full-program approval and saving.
- Scheduling or activation.
- Long-term coaching analytics.
- Automatic paid retries.
- General Rob UI redesign.

Do not implement Card 05 early.

## 16. Completion Criteria

This card is complete when:

1. Rob selects exercises exclusively from a trusted, verified catalogue.
2. No ordinary generation requires routine manual exercise-name matching.
3. Generated exercise IDs are validated against the authorised catalogue.
4. Equipment eligibility is respected.
5. Exercises can be excluded through the catalogue eligibility model.
6. The architecture supports future My Gym equipment contexts.
7. Multi-routine programs remain complete and structurally valid.
8. Training-volume guidance materially improves 75-minute hypertrophy requests.
9. A validated executable proposal is produced without an intermediate name-matching stage.
10. No program data is saved or activated without later explicit approval.
11. Existing single-routine workflows remain functional.
12. Tests, lint and production build pass.
13. Firebase and Vercel deployments are completed where required.
14. Manual QA confirms complete generated programs without obligatory exercise matching.

## 17. Implementation Debrief

Report:

- Chosen catalogue architecture and why.
- Source of authoritative exercise IDs.
- Catalogue filtering and exclusion rules.
- Server-side trust mechanism.
- Catalogue size and representative coverage.
- How the generation prompt receives the catalogue.
- How unsupported IDs are rejected.
- How direct proposal materialisation works.
- Equipment-context interface for future My Gym.
- Training-volume quality assessment.
- Legacy matching compatibility.
- Testing and deployment results.
- Known limitations.

**Suggested commit:** `feat: ground Rob program generation in verified exercise catalogue`

## Final Product Principle

Rob should function like a knowledgeable personal trainer who knows the equipment available before writing a program.

The user should be reviewing and refining Rob's recommendations—not identifying half the exercises on his behalf.