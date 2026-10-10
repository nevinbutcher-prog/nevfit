
# Codex — Rob Coaching Engine, Card 2

**Title:** Deterministic Weekly Programming Policy Engine  
**Project:** Fitbot / Nevfit  
**Type:** Implementation  
**Dependency:** Card 1 — Exercise Planning Taxonomy

## Objective

Build a deterministic, evidence-informed policy layer that translates Rob's structured intake requirements into a weekly training-planning envelope.

The policy describes what a credible program should achieve **before exercises are selected**.

It must not generate workout routines, select exercise IDs, or replace the current production generator.

## Scope

### 1. Weekly muscle-group coverage

Develop a general-purpose representation of expected weekly muscle-group coverage based on:

- Training goal.
- Days per week.
- Session duration.
- Selected development priorities.
- Available equipment.
- Any structured constraints currently available.

Treat `balanced` as a whole-program coverage requirement.

Selected muscle priorities should adjust relative emphasis without removing appropriate baseline coverage.

Use conservative, configurable workload bands. Distinguish evidence-supported principles from practical programming heuristics.

Do not prescribe an identical set count for everyone.

### 2. Training frequency and distribution

Represent reasonable training exposure and workload distribution across available sessions.

Account for:

- Frequency of major muscle-group training.
- Distribution of demanding compound movements.
- Recovery between sessions.
- Practical session workload.
- Whether a split or full-body structure could reasonably fulfil the requirements.

Do not hardcode an upper/lower or push/pull/legs split.

Where actual training days are unknown, do not invent a weekly calendar or assume exact recovery intervals.

### 3. Primary and secondary stimulus

Use the Card 1 taxonomy to distinguish:

- Primary training stimulus.
- Meaningful secondary involvement.
- Supporting involvement.
- Unknown involvement.

Use direct working sets as the main quantitative volume signal.

Secondary involvement should inform overlap and fatigue assessment without pretending there is a scientifically exact conversion into direct sets.

Unknown metadata must never be silently interpreted as zero stimulus or verified absence of overlap.

### 4. Exercise compatibility principles

Define reusable policy considerations for:

- Complementary movement patterns.
- Redundant exercise roles.
- Potential fatigue interference.
- Exercise ordering and muscle priorities.
- Demanding compounds and recovery.

These should eventually allow Rob to recognise interactions such as bench pressing followed by overhead pressing.

Do not build pairwise exercise blacklists.

Do not treat all overlapping movements as prohibited.

### 5. Session workload envelope

Create reasonable workload expectations for 45-, 60- and 75-minute sessions, including:

- Set volume.
- Rest demands.
- Exercise complexity.
- Equipment transitions.
- Warm-up allowance.
- Uncertainty in duration estimates.

Exercise count should be an outcome of programming requirements, not a universal fixed quota.

Avoid rigid session-volume requirements that would invalidate legitimate lower-volume programs.

### 6. Deterministic API

Expose pure, testable functions that accept validated requirements and return a structured planning-policy object.

The result should communicate:

- Required and optional muscle coverage.
- Priority emphasis.
- Workload guidance.
- Movement-pattern needs.
- Recovery and sequencing considerations.
- Assumptions.
- Confidence and uncertainty.
- Any limitations caused by insufficient intake data.

Keep the output suitable for the future structured weekly-blueprint contract.

### 7. Tests and validation

Add deterministic tests covering:

- Balanced development with shoulder emphasis.
- Balanced development with arms or back emphasis.
- Multiple simultaneous priorities.
- Three-, four- and five-day schedules.
- Different session durations.
- General hypertrophy versus other supported goals.
- Unknown secondary muscle metadata.
- Incomplete movement-pattern classifications.
- Overlapping pressing demands.
- Appropriate variation in session structure.
- Missing availability or recovery information.
- Conflicting or insufficient equipment capabilities.

Specifically demonstrate why four nine-set sessions are an implausibly low-workload response to the previously tested 75-minute balanced hypertrophy brief, without claiming that nine sets is universally wrong.

### 8. Boundaries

Do not:

- Change active AI generation.
- Generate actual exercise prescriptions.
- Modify the intake wizard.
- Implement Card 3 quality scorecards.
- Implement Card 4 AI blueprints.
- Introduce new persistence.
- Introduce automatic rejection or regeneration.
- Make paid AI calls.

Keep the engine independent of React, Firebase callables and external AI providers.

## Deliverables

1. Policy architecture and function signatures.
2. Configurable policy assumptions with rationale.
3. Representative outputs for the known four-day hypertrophy case.
4. Explicit handling of uncertain taxonomy classifications.
5. Test results and limitations.
6. Any genuine intake-data gaps identified.

**Success:** Rob has a reusable weekly-planning policy that can guide a future AI blueprint while preserving flexibility and individualisation.

Do not integrate it into production generation yet.