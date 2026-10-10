
# Fitbot — Rob Coaching Engine: Card 4

**Title:** Structured Weekly Training Blueprint  
**Type:** Implementation — isolated, non-production  
**Dependencies:** Cards 1–3, including corrective commit `f31629c`  
**Priority:** High

## 1. Objective

Build a strict, policy-guided weekly training-blueprint generator that enables Rob to design coherent training programs **before selecting individual exercises**.

Rob must behave like a competent, evidence-informed personal trainer: setting ambitious but appropriate training demands, accounting for weekly stimulus and recovery, and making purposeful programming decisions.

The blueprint establishes the intended training week. Card 5 will subsequently fulfil its exercise slots using trusted catalogue exercises.

**Do not replace the existing production program generator in this card.**

## 2. Coaching philosophy — productive challenge, not excessive caution

Rob should design training that is challenging, progressive, purposeful and proportionate to the user's goal and experience.

Avoid two extremes:

- Underprescribing training in the name of caution.
- Prescribing excessive or poorly distributed work in the name of intensity.

The policy engine is a coaching guide, not a mechanism for automatically choosing the lowest permitted workload.

### Required principles

- Use training goals, duration, available days and priorities to determine appropriate workload.
- Design sessions that provide a meaningful training stimulus.
- Allow demanding compound movements and substantial accessory work where appropriate.
- Permit overlapping muscle stimulus when it serves a deliberate purpose.
- Distinguish fatigue management from avoiding fatigue altogether.
- Do not automatically discourage challenging sessions because multiple exercises train related muscles.
- Preserve room for progression rather than assuming all users need minimalist programs.
- Treat uncertain experience or recovery information as a reason for reasonable assumptions, not automatic underprescription.
- Respect explicit constraints, exclusions and equipment limitations.
- Avoid implying that high effort, failure training or high volume is universally necessary.

Science-informed principles must remain distinct from practical coaching heuristics.

## 3. Individual-session emphasis versus whole-week balance

A balanced weekly program **does not require every workout to train every muscle group equally**.

The blueprint must support focused sessions within a balanced training week.

For example, a chest-emphasis session may contain significant chest, triceps and shoulder work, with additional leg work and little direct back training.

That's acceptable if the remaining sessions provide appropriate back, posterior-chain and other necessary training.

Similarly, selected shoulder emphasis must not turn an entire four-day program into four shoulder-isolation workouts.

### Requirements

- Evaluate muscle-group coverage primarily across the full week.
- Give each session a coherent purpose.
- Distribute training stimulus in a recovery-aware manner.
- Allow focused, mixed, full-body and split sessions.
- Allow different sessions to have different workloads and exercise counts.
- Preserve muscle emphasis without neglecting major weekly coverage.
- Do not impose a universal split or require every session to contain a push, pull, squat and hinge.

## 4. Real-world positive fixture: challenging chest-emphasis session

Use this actual completed workout as a positive programming example:

**Session:** Full Body — Chest Emphasis

| Exercise | Working sets |
|---|---:|
| Leg Press | 3 |
| Incline Chest Press | 3 |
| Dual Cable Lateral Raise | 3 |
| Chest Fly Machine | 3 |
| Arnold Shoulder Press | 3 |
| Seated Dip Machine | 3 |
| Leg Extension | 3 |

**Total:** 7 exercises, 21 working sets.

This session should be recognised as a plausible hypertrophy workout within a suitable weekly program.

Expected coaching interpretation:

- Chest receives priority through pressing and fly work.
- Deltoids and triceps receive significant additional stimulus.
- Quads receive direct work.
- Multiple pressing-related exercises create fatigue overlap, but they have distinguishable purposes.
- Back and hamstring stimulus must be evaluated across the week, not demanded within this individual session.
- Sequencing may be refined to prioritise performance on the most important exercises.
- The session should not be rejected merely because it contains multiple presses or 21 working sets.

Do not hardcode this exact workout or seven-exercise structure into the generator.

At blueprint stage, represent the **intended training roles and workload**, not the specific exercise names.

Include a mocked blueprint capable of supporting this session and demonstrate why the session is acceptable.

## 5. Blueprint data contract

Create a versioned, strict JSON blueprint contract.

The blueprint should describe:

### Program level

- Confirmed training goal.
- Training frequency.
- Weekly structure and rationale.
- Selected muscle priorities.
- Intended major-muscle coverage.
- Weekly workload distribution.
- Movement-pattern requirements.
- Recovery considerations.
- Assumptions and limitations.

### Session level

- Session name and purpose.
- Primary training focus.
- Secondary training contributions.
- Approximate working-set workload.
- Intended training stimulus.
- Exercise-role distribution.
- Sequencing priorities.
- Estimated practical duration or duration guidance.
- Relationship to the other sessions.

### Exercise-slot level

Each planning slot should describe:

- Primary intended muscle stimulus.
- Relevant secondary stimulus.
- Required or preferred movement pattern.
- Exercise role: compound, isolation, trunk or conditioning.
- Intended working sets.
- Rep-range guidance appropriate to the goal.
- Rest guidance.
- Priority within the session.
- Fatigue or sequencing considerations.
- Optional alternatives or flexibility where useful.

Do not use WGER IDs, free-text exercise names, fictional equipment or fabricated catalogue references in blueprint slots.

Keep the contract compact enough for economical AI generation.

## 6. Integrate the existing coaching foundations

Reuse:

- Card 1 exercise planning taxonomy.
- Card 2 deterministic weekly programming policy.
- Card 3 advisory quality-assessment principles.

Do not duplicate their classifications or create conflicting programming rules.

The Card 2 policy should establish a deterministic planning envelope.

The AI should be free to make meaningful coaching decisions **inside that envelope**.

For example:

- Choose a full-body, upper/lower or another reasonable training structure.
- Allocate training volume to relevant muscle groups.
- Decide how to distribute muscle emphasis.
- Select appropriate movement and exercise roles.
- Allocate more challenging work when justified.
- Organise exercise roles to manage fatigue and performance.

The AI must not be allowed to disregard explicit requirements or produce structurally invalid blueprints.

Do not automatically turn advisory workload bands into rigid limits.

## 7. Weekly workload and muscle-stimulus planning

Use direct hard working sets as the main quantitative workload-planning signal.

Consider meaningful and supporting secondary stimulus qualitatively.

Do not invent scientifically precise fractional set credits.

### Requirements

- Provide baseline whole-week muscle coverage.
- Allow modest additional stimulus for selected priority muscles.
- Distribute major-muscle training appropriately across sessions.
- Avoid redundant loading patterns unless purposeful.
- Consider compound-exercise contribution when allocating accessory work.
- Balance local muscular stimulus with overall fatigue demands.
- Avoid prescribing simultaneous high-end volumes for every muscle group.
- Support variability according to goals and confirmed training experience.

Where experience level is unavailable, record the assumption used.

Do not fabricate personal training history or recovery capacity.

## 8. Session duration and workload

Account for the user's confirmed duration.

For example, a four-day, 75-minute hypertrophy program should normally plan meaningful workloads consistent with those sessions.

Reference Card 2's guidance of approximately 14–24 working sets per typical 75-minute session as an **advisory planning range**, not a universal prescription or hard quota.

A well-designed session may reasonably fall outside that range depending on exercise demands, intensity, rest, training experience or purpose.

Exercise counts should emerge from the training plan rather than an imposed target.

A program containing four nine-set sessions should not silently pass as an appropriately filled 75-minute hypertrophy plan without a defensible reason.

Conversely, a 21-set session must not be flagged as inherently excessive merely because it includes multiple movements contributing to the same region.

Session duration should account conservatively for rest, setup, warm-ups, movement complexity and transitions.

Do not claim precise timing.

## 9. Exercise ordering and fatigue relationships

Blueprint slots must support purposeful exercise sequencing.

Consider:

- Priority exercises earlier when performance is important.
- Demanding compounds and fatigue-sensitive movements.
- Local muscle overlap.
- Complementary movement patterns.
- Useful accessory work.
- Training order relative to user goals.
- Accumulated fatigue across a session.
- Recovery and workload across the week.

Do not create hardcoded prohibited exercise pairs.

Do not assume every pressing combination is redundant or unsafe.

The blueprint should explain the intended order sufficiently for Card 5 to select and arrange exercises coherently.

## 10. Structured AI generation

Implement an isolated blueprint-generation function using the existing AI provider abstraction.

Requirements:

- Strict structured-output contract where supported.
- Compact requirements and policy input.
- Versioned blueprint output.
- Deterministic validation.
- Clear diagnostics for malformed or incomplete output.
- No invented exercise IDs.
- No automatic retries.
- No paid calls in tests.

The blueprint generator should not require the full 907-exercise catalogue in its AI context.

Consider output-token requirements realistically so the model is not pressured to produce extremely short or incomplete plans merely to satisfy a response budget.

Do not introduce a production model change in this card.

## 11. Schema and semantic validation

Separate validation into two categories.

### Structural validity

Reject malformed or unsupported blueprint data, including:

- Incorrect version.
- Wrong routine count.
- Unsupported slot types.
- Invalid prescription values.
- Unsupported fields.
- Missing required contract elements.
- Invalid cross-references.

### Programming-quality assessment

Evaluate advisory concerns such as:

- Inadequate weekly coverage.
- Inadequate training stimulus.
- Excessive priority concentration.
- Redundant exercise roles.
- Implausible session workload.
- Poor recovery-aware distribution.
- Inappropriate fatigue concentration.
- Unsupported coaching assumptions.

Avoid introducing new hard quality rejection gates without approval.

A structurally valid but questionable blueprint should retain explainable advisory concerns for evaluation.

Do not automatically repair a questionable blueprint or trigger another AI call.

## 12. Deterministic tests

Implement mocked-provider tests for:

1. Four-day, 75-minute balanced hypertrophy with shoulder emphasis.
2. The two previously failed shoulder-heavy programming scenarios.
3. A challenging, chest-emphasis session comparable to the seven-exercise, 21-set real-world fixture.
4. Balanced whole-week coverage despite focused individual sessions.
5. Three-, four- and five-day structures.
6. 45-, 60- and 75-minute sessions.
7. Hypertrophy, strength, hybrid and general fitness goals.
8. Multiple selected muscle priorities.
9. Overlapping but productive pressing work.
10. Excessive redundant pressing work.
11. Primary and secondary muscle-stimulus distinctions.
12. Incomplete intake assumptions.
13. Workload distributions inside and outside advisory bands.
14. Malformed blueprint responses.
15. Unsupported slot types or invalid prescriptions.
16. Preservation of all active generation behaviour.

Tests must validate meaningful structure, planned stimulus and coherent workload—not simply the presence of JSON fields.

No paid AI calls.

## 13. Example blueprint required in debrief

Provide a complete, human-readable example for:

- Hypertrophy.
- Four training days.
- 75 minutes per session.
- Balanced development.
- Shoulder emphasis.
- Commercial-gym equipment.

Show:

- Weekly structure.
- Each session's purpose.
- Planned working sets.
- Muscle-group coverage.
- Exercise slots and their roles.
- Sequencing decisions.
- Reason for shoulder emphasis.
- How the sessions complement one another.
- Advisory concerns, if any.

Also demonstrate how the contract can represent the challenging chest-emphasis fixture without incorrectly rejecting it.

The example should be mocked and deterministic, not the result of a paid generation call.

## 14. Implementation boundaries

Do not implement:

- Card 5 constrained exercise selection.
- Actual WGER exercise selection in blueprint slots.
- Production generation replacement.
- New intake UI.
- Card 6 user-facing preview.
- New program persistence.
- Automatic program activation.
- Model benchmarking or upgrades.
- Paid AI calls.
- Automated quality rejection or regeneration.

Keep the implementation independent of the active production flow.

## 15. Validation and release

Run:

- Full app tests.
- Full Functions tests.
- App and Functions lint.
- Production build.
- New deterministic blueprint regressions.

Commit and push to the existing private GitHub repository.

Do not deploy or activate the new generator.

Stop after implementation and provide a debrief for independent review.

## 16. Acceptance criteria

Card 4 is complete when:

1. Rob has a strict, versioned weekly-blueprint contract.
2. The blueprint is produced before actual exercise selection.
3. Structured requirements and deterministic policy inform planning.
4. The AI retains flexibility to make genuine coaching decisions.
5. Whole-week balance can coexist with specialised individual sessions.
6. Appropriate challenging workloads are supported.
7. Primary/secondary muscle stimulus and fatigue interactions are represented.
8. Structural errors are diagnosed precisely.
9. Programming-quality concerns remain advisory.
10. Deterministic tests demonstrate realistic programs and known failures.
11. The existing production generator remains unchanged.
12. Changes are committed and pushed without deployment.

## Final product principle

**Rob should coach, not merely comply.**

He should design training that is appropriately challenging, scientifically informed, logically structured and adaptable to the individual.

The objective is not to avoid fatigue or maximise exercise counts.

It is to prescribe productive training that makes sense across the entire week and can be defended through sound coaching reasoning.