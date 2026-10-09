# Codex Bugfix Brief — Correct Rob Last-Workout Context Accuracy

**Project:** Fitbot  
**Priority:** High  
**Type:** Narrow corrective follow-up outside the main Rob program-generation sequence

## ELI5

When I ask Rob how I performed in my last workout, he should describe the workout I actually logged.

If I did 7 exercises, Rob should not report only 5.  
If I did 3 sets, Rob should not report 2.  
If I logged kilograms, Rob should not say pounds.  
If I swapped an exercise, Rob should use the real logged exercise identity, not a vague generic name.

## Problem

The workout tracker/logging appears correct, but Rob’s response about the most recent workout is inaccurate.

Observed issues from manual QA:

- Last workout contained 7 exercises, but Rob reported only 5.
- Exercises with 3 logged sets were reported as 2 sets.
- Logged `kg` values were described as `lbs` without conversion.
- A swapped exercise was presented with a generic or degraded name rather than the actual logged workout identity.
- The resulting advice is therefore based on incomplete or distorted workout context.

This appears to be a **Rob context-building / serialization bug**, not a workout-tracking bug.

## Scope

Fix the structured data path that provides the “last workout” context to Rob for advisory / question-answering flows.

Use the actual completed workout data as the source of truth.

Do not redesign the workout tracker UI.  
Do not implement new performance analytics.  
Do not implement long-term progression logic.  
Do not broaden this into a generic coaching overhaul.

## Required behaviour

When the user asks Rob about their last workout, the structured context must accurately reflect the most recent completed workout, including:

- all exercises in the workout
- actual exercise order
- actual exercise identity / display name
- swap-derived exercise name when applicable
- number of logged sets per exercise
- logged reps per set
- logged load / weight per set
- correct unit system (`kg` vs `lb`)
- routine name and workout date
- any existing supported note fields that are already part of the completed workout record

Rob may still summarize the workout in natural language, but the source context must be complete and accurate.

## Investigation

Inspect the Rob advisory / question-answering path, including the modules that:

- gather recent workout history
- build structured Rob context
- serialize the last completed workout
- transform swapped exercises or custom exercise display names
- format set / rep / weight data
- decide or label unit systems

Determine exactly where the data is being truncated or degraded.

Likely candidates include:
- recent-workout summarization logic
- history/context mappers
- Rob context builders
- unit-formatting helpers
- any “top set” / “summary” projection being incorrectly used in place of full workout detail

## Implementation requirements

### 1. Use the completed workout record as source of truth
For “last workout” questions, derive context from the actual most recent completed workout entry, not from a lossy summary projection if one exists.

### 2. Preserve full exercise coverage
Do not silently omit exercises from the workout context unless there is an explicit, documented limit and the user-visible response clearly acknowledges summarization.  
For the normal recent-workout use case, the full exercise list should be available.

### 3. Preserve set counts accurately
Set counts must match the logged workout data.  
Do not collapse 3 sets into 2 due to filtering, incomplete flags, preview logic or summary assumptions.

### 4. Respect units
If the completed workout stores or displays `kg`, Rob must not describe the same values as `lbs` unless an actual conversion is intentionally performed.

Prefer preserving the stored/logged unit rather than performing automatic conversion.

### 5. Preserve swapped exercise identity
If an exercise was swapped or relabelled in the completed workout, Rob should use the actual logged/displayed exercise identity that the user sees in history, not a generic exercise category name.

### 6. Avoid unsupported personal assumptions
Review whether advisory context includes unsupported or stale personal-condition assumptions (for example, medical issues) when answering simple performance questions.

Rob should not inject unrelated or weakly grounded cautionary context into a last-workout factual recap unless it is clearly part of the supported user context model and appropriate to the prompt.

Do not remove legitimate supported profile context globally without checking how other Rob flows use it.  
This part should be handled conservatively.

## Tests

Add focused regression coverage for the advisory context builder and/or Rob question workflow.

Cover:

1. A completed workout with multiple exercises is fully represented.
2. Three logged sets remain three sets in Rob’s structured context.
3. Units remain `kg` when the workout is logged in kilograms.
4. `lb` workouts remain `lb`.
5. Swapped exercises preserve the displayed/logged exercise identity.
6. Exercise order is preserved.
7. The most recent completed workout is chosen correctly.
8. Questions about last workout do not mutate history, active workout or programs.
9. Existing workout tracker behaviour remains unchanged.
10. Existing Rob advisory flows remain functional.

Where practical, test the actual user-facing advisory path rather than only low-level helpers.

## Verification

Run:

- full app tests
- any relevant Functions tests
- root and Functions lint
- production build

If an authenticated interactive session is available, manually verify:
1. complete a workout with several exercises
2. ask Rob how the last workout went
3. confirm all exercises, set counts and units are correct

## Out of scope

Do not implement:
- progression recommendations
- performance scoring
- volume analysis
- saveable Rob feedback
- broader workout-history analytics
- new coaching UI
- Card 05 preview/approval work
- program-generation changes

## Completion criteria

This bugfix is complete when:
- Rob accurately reports the most recent completed workout
- no exercises are dropped unexpectedly
- set counts match the logged workout
- units are correct
- swapped exercises retain their actual identity
- no tracker behaviour regresses
- tests, lint and build pass

**Suggested commit:** `fix: correct Rob last-workout context accuracy`