
# Codex — Rob Coaching Engine, Card 3

**Title:** Program Quality Scorecard v2  
**Project:** Fitbot / Nevfit  
**Type:** Implementation  
**Dependencies:** Card 1 taxonomy, Card 2 weekly programming policy

## Objective

Build a deterministic, explainable program-quality evaluator using the existing exercise taxonomy and weekly programming policy.

The evaluator must assess complete training programs, including weekly stimulus, workload, exercise diversity, sequencing and fatigue interactions.

It must remain advisory-only and must not modify the active generation pipeline.

## Requirements

### 1. Whole-program evaluation

Evaluate a proposed program against its original structured intake and the Card 2 policy.

Assess:

- Major muscle-group coverage.
- Priority-muscle emphasis.
- Direct weekly working-set distribution.
- Qualitative secondary muscle involvement.
- Frequency and distribution of training stimulus.
- Movement-pattern coverage.
- Redundant exercise selection.
- Fatigue interactions and exercise sequencing.
- Session workload relative to requested duration.
- Uncertainty caused by incomplete exercise metadata.

Distinguish whole-week concerns from individual-session concerns.

### 2. Exercise sequencing

Recognise overlapping demands without imposing blanket prohibitions.

Examples:

- Heavy bench press followed by heavy overhead press: potentially competing pressing demands.
- Horizontal press paired with a row: potentially complementary.
- Squat followed by leg press: concentrated knee-dominant work.
- Repeated near-identical shoulder presses: potential redundancy.

Account for exercise order, user priority and training context.

Do not infer actual loads, proximity to failure or recovery status where those values are unavailable.

### 3. Explainable concerns

Return structured advisory concerns containing:

- Stable concern code.
- Severity or advisory category.
- Affected routine and exercise indices where applicable.
- Relevant muscle groups or movement patterns.
- Human-readable explanation.
- Confidence/uncertainty.
- Relevant policy expectation.

Avoid fabricated scientific precision or opaque overall fitness scores.

### 4. Metadata uncertainty

Use Card 1 confidence and provenance information.

Unknown secondary stimulus must not be treated as zero.

Poorly classified exercises should generate uncertainty when that uncertainty materially affects an assessment.

Avoid overwhelming the user with warnings for minor metadata gaps.

### 5. Existing compatibility

Preserve existing candidate format and exercise IDs.

Provide an adapter where necessary to evaluate currently generated programs using the new taxonomy.

Do not change current strict validation, equipment eligibility, proposal materialisation, persistence or API response contracts.

Do not replace production `assessProgramQuality()` yet.

### 6. Regression fixtures

Include the two actual failed shoulder-emphasis scenarios:

**Failure A:** Four shoulder-dominated sessions, 13–16 sets each, with inadequate balanced coverage.

**Failure B:**
- Shoulder Focus 1: Arnold press, barbell shoulder press, diagonal shoulder press.
- Legs & Core: barbell squat, cable pull-through, bicycle crunches.
- Shoulder Focus 2: Australian pull-ups, box handstand push-ups, rear-delt row.
- Chest & Back: bench press, kneeling pulldown, high cable row.

All exercises in Failure B have three working sets.

Also include positive fixtures representing coherent balanced hypertrophy programs with modest shoulder emphasis.

Test 3–5 training days, different durations, goals and equipment selections.

Assertions must evaluate meaningful concern codes and explanations, not merely verify non-empty arrays.

### 7. Evaluation boundaries

No automatic program rejection, rewriting, retries or second AI calls.

Do not introduce a user-facing scorecard yet.

Do not change active production generation.

Keep evaluator functions pure and deterministic.

## Validation

Run full relevant automated tests, lint and build.

Report:

1. Scorecard structure and functions.
2. Negative and positive fixture outcomes.
3. How overlapping stimulus is handled.
4. How fatigue sequencing is assessed.
5. Unknown-metadata behaviour.
6. False-positive risks.
7. Differences from existing quality checks.
8. Tests and remaining limitations.

**Success:** We can objectively distinguish Rob's obviously flawed shoulder-heavy programs from sensible alternatives using explainable coaching criteria, without requiring an AI call or affecting production behaviour.