# Nevfit — Rob: Meaningful Weekly Training Reviews

**Goal:** Make Rob capable of reviewing an athlete's actual training week, identifying meaningful performance patterns, and giving specific, useful coaching feedback.

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`

## User intent

When I ask Rob to review my training week, I expect him to understand what I've actually done, recognise meaningful progress or problems, and give me a knowledgeable personal trainer's assessment.

The response should be engaging, candid, specific and actionable — not generic encouragement or a mechanical summary of workout records.

## Expected experience

A user can ask Rob to review their week and receive:

1. **A concise overall assessment** of the training completed.
2. **Specific observations** supported by their logged workouts.
3. **Meaningful comparisons** with the preceding equivalent period where data permits.
4. **Progression insights** covering relevant changes in sets, repetitions, loads, training frequency and consistency.
5. **Constructive coaching advice** identifying one or two worthwhile adjustments or priorities.
6. **Honest uncertainty** where sufficient information is unavailable.

The response should sound like a knowledgeable, personable trainer rather than a reporting system.

## Implementation scope

### 1. Weekly training context

Inspect the existing workout history, context builder and review infrastructure.

Create a deterministic, bounded weekly training context that:

- Uses actual completed workouts and their recorded dates.
- Defines the reviewed week explicitly, with consistent local calendar boundaries.
- Includes the preceding equivalent period for comparison.
- Preserves exercise identity across routines.
- Includes meaningful set, rep and load information.
- Preserves recorded weight units.
- Distinguishes completed work from scheduled or prescribed work.
- Uses the current athlete goals and constraints where reliably available.
- Identifies missing or incomplete evidence.

Do not arbitrarily truncate history to one workout for this review.

Use compact, derived summaries where needed to respect model input limits without losing important comparison information.

### 2. Coaching analysis

Rob should be able to recognise:

- Training frequency and consistency.
- Genuine exercise-level progression or regression.
- Changes in working-set volume.
- Potentially uneven distribution of training.
- Relevant workload changes between periods.
- Meaningful training patterns deserving attention.

Do not equate every increase in weight with improved performance without considering repetitions and available context.

Do not infer recovery, pain, effort, sleep or exercise technique from workout logs that don't record those details.

Avoid invented training-science precision.

### 3. Coaching response

Use a focused weekly-review coaching instruction that prioritises:

- Direct answers.
- Evidence-based observations.
- Practical training judgement.
- Natural, engaging language.
- Candid but constructive criticism.
- One or two clear next actions.

Avoid excessive headings, repetitive disclaimers, generic praise and unnecessary verbosity.

Rob should be willing to say that a week's training was poorly balanced or unproductive when the evidence supports that judgement.

### 4. Model evaluation

Treat GPT-4.1 as the preferred candidate based on the completed coaching evaluation.

Allow the weekly-review route to use an independently configured model without silently switching all Rob functions.

Do not introduce a permanent production model change or additional paid evaluation calls without approval.

### 5. Integration

Integrate the weekly-review capability into the existing Rob experience.

Prefer a clearly identifiable **Review my week** action alongside existing coaching functionality.

Reuse existing authenticated server-side AI boundaries, error handling and loading states.

The feature must not modify program definitions, workout history or user profile data.

### 6. Validation

Add focused automated tests demonstrating:

- Correct weekly date boundaries.
- Correct preceding-period comparisons.
- Multiple workouts included without accidental truncation.
- Accurate exercise-level performance comparisons.
- Correct treatment of missing units and incomplete records.
- No fabricated progression from insufficient evidence.
- Existing Rob advice and program-review flows remain unaffected.
- No cross-user access to workout data.
- No data mutation from reviewing.

Include representative synthetic weeks covering genuine progression, flat performance, mixed results and insufficient history.

## Scope exclusions

Do not implement:

- Persistent conversational memory.
- A new athlete-profile management system.
- Program-generation changes.
- Exercise-catalogue improvements.
- Automatic routine modifications.
- A complete Rob personality redesign.
- General AI infrastructure refactoring.

These remain separate potential improvements.

## Delivery requirements

Follow the agreed NevDev workflow.

Inspect the repository before implementation and deliver the smallest credible solution.

Report the files changed, test results, commit, deployment requirements and remaining manual verification.

Submit for independent code review before user verification.

**Success criterion:** Rob can accurately describe the training performed during a selected week, compare it with relevant preceding history and provide an insightful coaching response grounded in actual logged evidence.

### Amendment — Whole-Activity Weekly Coaching Context

Extend the agreed **Rob: Meaningful Weekly Training Reviews** checkpoint to incorporate all existing Fitbot activity records.

The weekly review must include:

- Completed strength workouts and relevant performance comparisons.
- Logged runs, including date, distance, duration, pace where derivable, and weekly totals.
- Recorded daily steps, including weekly average, total and comparison with the preceding equivalent period.
- An integrated assessment of training frequency, activity distribution and changes in overall workload.

Use the existing Firestore-backed health and workout data. Do not introduce new activity tracking or external integrations.

Distinguish missing step entries from recorded zero-step days. Do not assume unlogged activity did not occur.

Rob should consider the interaction between resistance training, running and daily movement when offering coaching recommendations, without inventing fatigue, recovery status or causal relationships.

The weekly response should read as **one cohesive personal-training assessment**, not three disconnected reports about weights, running and steps.

Include synthetic test scenarios covering combined activity increases, reduced lifting performance alongside additional running, stable activity, and incomplete step/run data.

All other checkpoint scope boundaries remain unchanged.
