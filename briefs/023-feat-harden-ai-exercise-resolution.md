
# Codex Implementation Brief — Pivot Rob to Program-Level Coaching and Evidence-Based Progression

## PROJECT

Fitbot

## INITIATIVE

**Pivot Rob from routine generation to program-level coaching, progression intelligence, and session prescription**

## PRIORITY

High strategic priority

## CONTEXT

Fitbot's existing Rob work has established several valuable safety boundaries:

- deterministic Fitbot training context;
- authenticated/provider-neutral AI calls;
- structured routine and program reviews;
- provider-backed exercise identity;
- validated proposal contracts;
- deterministic proposal previews;
- explicit human approval;
- stale-proposal detection;
- draft-only proposal application;
- **Save Program** as the sole persistence boundary.

These foundations should be preserved.

However, the current product direction places too much emphasis on Rob creating or modifying a **single routine**.

The more valuable coaching unit is the **whole training program**.

Users should be able to ask Rob to:

- build a 3-, 4-, or 5-day program;
- assess balance across all routines;
- identify over/under-trained movement patterns or muscle groups;
- alter rep ranges or volume when training has stagnated;
- recommend progression changes based on logged performance;
- eventually provide evidence-based target sets/reps/load/RIR for each workout.

Routine-level review remains useful, but routine generation should no longer drive the Rob roadmap.

---

# 1. Product direction

Reframe Rob as:

> **A program coach supervising training over time, rather than a workout generator.**

The desired long-term architecture has three layers.

## Layer 1 — Program design and program review

Rob understands the whole program.

Examples:

```text
Build me a 4-day hypertrophy program.

I want shoulders and arms prioritised without making sessions longer.

Review my current program for volume and balance.

I've been running this program for eight weeks. What should change?

Turn my current program into an Upper / Lower / Upper / Lower split.

Reduce pressing volume without losing chest work.
```

Rob should be capable of proposing coordinated changes across multiple routines as a single coherent program proposal.

---

## Layer 2 — Progression intelligence

Fitbot analyses actual workout history and detects meaningful training signals.

Examples:

```text
You have hit the top of this rep range for three consecutive sessions.

Performance on this exercise has stalled for five exposures.

Your weekly direct biceps volume has increased substantially while performance has fallen.

This exercise has remained at the same load and rep range for eight weeks.

You are consistently exceeding the prescribed rep range.

Your performance has dropped across several related exercises.
```

These observations should be derived primarily through deterministic Fitbot analysis.

Rob can interpret them and propose changes.

---

## Layer 3 — Session prescription

Before each workout, Fitbot can eventually provide a suggested prescription for each exercise.

Example:

```text
Machine Chest Press

Today:
62.5 kg
3 × 8–10
Target: 1–2 RIR

Why:
Last session at 60 kg:
10 / 10 / 10

You reached the top of the prescribed range, so load has progressed.
```

This should behave more like an evidence-based progression engine with Rob acting as the explanatory coaching layer.

Do **not** make an LLM responsible for inventing arbitrary weights/reps each workout.

---

# 2. Evidence model

Training logic must be grounded in defensible resistance-training principles.

Fitbot does not need to pretend that exercise science provides one universally optimal prescription.

It should instead encode broad evidence-supported ranges and expose uncertainty where appropriate.

The current evidence base supports several useful principles.

## Hypertrophy volume

Higher weekly resistance-training volume generally produces greater hypertrophy up to individual tolerance, and ACSM's 2026 guidance highlights approximately 10 weekly sets per muscle group as a useful hypertrophy-oriented reference point rather than a universal prescription.

Treat volume targets as ranges and contextual signals rather than hard medical thresholds.

---

## Load and rep ranges

Muscle hypertrophy can occur across a broad loading spectrum when training is sufficiently demanding, while heavier loading tends to offer greater specificity for maximal strength.

Therefore Fitbot should not hard-code:

```text
8–12 reps = hypertrophy
```

as an absolute truth.

Rep ranges should instead be selected according to:

- goal;
- exercise characteristics;
- user preference;
- fatigue;
- joint comfort;
- progression history;
- practical loading increments.

---

## Proximity to failure

Current evidence suggests hypertrophy tends to improve as sets are terminated closer to failure, without requiring every set to reach momentary muscular failure.

Fitbot should therefore support **RIR** as a coaching target.

Do not encode:

```text
Every set must reach failure.
```

A practical general hypertrophy target may often be approximately:

```text
1–3 RIR
```

but this must remain configurable/contextual rather than treated as universal scientific law.

---

## Autoregulation

RPE/RIR and other autoregulatory approaches are legitimate methods of individualising resistance training rather than arbitrary AI behaviour.

Fitbot should progressively move toward:

```text
planned prescription
+
recent performance
+
user effort feedback
=
next-session recommendation
```

rather than static plans alone.

---

# 3. Architectural principle

Maintain this authority chain:

```text
Scientific/evidence rules
        ↓
Fitbot deterministic analysis
        ↓
Rob interpretation
        ↓
Structured proposal
        ↓
Fitbot validation
        ↓
Human review
        ↓
Human approval
        ↓
Unsaved draft
        ↓
Save Program
        ↓
Persistence
```

The LLM must never become the system of record for:

- exercise identity;
- progression calculations;
- workout history;
- program state;
- persistence;
- active workout state.

---

# 4. Do not discard existing routine work

Retain:

```text
Review routine with Rob
```

because focused routine review remains useful.

Examples:

```text
Is this pull workout too long?

Does this routine have redundant exercises?

Is this exercise order sensible?

Could I superset anything here?
```

Retain the existing routine proposal contract for targeted modifications.

However:

**Do not invest further in making single-routine creation a headline Rob capability.**

The current **Create Routine with Rob** entry point may remain temporarily available while the new program architecture is developed.

Do not delete working functionality prematurely.

Once program generation is available, reconsider whether routine generation should:

- remain as a secondary action;
- be hidden under advanced actions;
- or be removed.

That product decision is outside the first implementation card.

---

# 5. Immediate prerequisite — harden exercise resolution

Before whole-program generation is attempted, improve AI-proposed exercise resolution.

The current resolver deliberately requires an exact normalized exercise-name match.

This is safe but brittle.

For example:

```text
Rob:
Incline Dumbbell Bench Press

Provider:
Dumbbell Incline Bench Press
```

may fail despite being semantically equivalent.

Whole-program generation magnifies this issue because a 20-exercise program only needs one unresolved movement to invalidate the whole proposal.

## Preserve the security rule

Rob must **never** supply trusted exercise IDs.

Provider-backed Fitbot identity remains authoritative.

The flow remains:

```text
AI exercise description
        ↓
Fitbot search/resolution
        ↓
provider-backed exerciseId
```

---

# 6. Improved exercise resolution pipeline

Introduce a reusable deterministic resolution service.

Suggested module:

```text
src/services/exerciseResolution.js
```

or:

```text
src/services/rob/robExerciseResolution.js
```

Avoid burying increasingly sophisticated identity logic inside `robProposalResolver.js`.

Conceptual API:

```js
resolveProposedExercise({
  requestedName,
  query,
  exerciseProvider,
  aliases
})
```

Return:

```js
{
  status: "resolved" | "ambiguous" | "unresolved",
  exercise: null | providerExercise,
  candidates: [],
  confidence: ...
}
```

Do not expose speculative IDs as resolved.

---

# 7. Resolution stages

Use conservative staged matching.

## Stage 1 — exact normalized match

Retain existing behaviour.

Normalize:

- case;
- punctuation;
- excess whitespace;
- obvious formatting differences.

If exactly one provider exercise matches:

```text
resolved
```

---

## Stage 2 — canonical alias matching

Support a bounded Fitbot-owned alias dictionary.

Examples:

```text
DB → Dumbbell
BB → Barbell
Lat Raise → Lateral Raise
Pulldown → Lat Pulldown
Cable Pushdown → Triceps Pushdown
DB Bench → Dumbbell Bench Press
```

Aliases must be deterministic and testable.

Do not allow the AI to define its own canonical aliases at execution time.

---

## Stage 3 — token similarity / deterministic scoring

For unresolved names, score provider results using deterministic text similarity.

Consider:

- normalized token overlap;
- exercise-name ordering;
- equipment tokens;
- movement tokens;
- muscle/body-region metadata where available.

Example:

```text
Incline Dumbbell Bench Press
Dumbbell Incline Bench Press
```

should score extremely highly.

Do not automatically resolve weak semantic matches.

---

## Stage 4 — ambiguity handling

If Fitbot has multiple plausible provider-backed candidates:

```text
Rob suggested:
Incline Dumbbell Press

Fitbot found:

○ Dumbbell Incline Bench Press
○ Dumbbell Incline Fly
```

Require explicit user resolution before the overall proposal becomes executable.

Do not ask Rob to choose again automatically.

Do not make another paid AI call.

---

# 8. Proposal resolution state

Program proposal preparation must support:

```text
resolving
needs_resolution
resolved
invalid
```

If one or more exercises are ambiguous, retain the proposal preparation context transiently and allow the user to resolve those specific movements.

Once all movements have Fitbot/provider identity:

```text
materialize proposal
→ validate
→ preview
```

No program draft mutation occurs during resolution.

---

# 9. New program-level proposal contract

Do **not** force whole-program semantics into increasingly complicated `routineProposal` operations.

Introduce an explicit provider-neutral program proposal boundary.

Suggested:

```text
src/services/programProposal.js
```

Version:

```js
PROGRAM_PROPOSAL_VERSION = 1
```

Suggested proposal types:

```text
create_program
modify_program
```

or equivalent names clearly distinguishing them from routine proposals.

---

# 10. `create_program` semantics

This means:

> Create a complete new Fitbot program definition containing multiple routines.

It should not automatically become the user's active program.

Conceptual schema:

```js
{
  id: "proposal-*",
  version: 1,
  proposalType: "create_program",

  title: "...",
  summary: "...",

  program: {
    id: "program-rob-*",
    name: "4 Day Hypertrophy",

    routines: [
      {
        id: "routine-rob-*",
        name: "Upper A",
        exercises: [...]
      },
      {
        id: "routine-rob-*",
        name: "Lower A",
        exercises: [...]
      },
      {
        id: "routine-rob-*",
        name: "Upper B",
        exercises: [...]
      },
      {
        id: "routine-rob-*",
        name: "Lower B",
        exercises: [...]
      }
    ]
  },

  coaching: {
    goal: "hypertrophy",
    progressionStrategy: ...
  }
}
```

IDs must always be generated by Fitbot.

Rob never invents executable IDs.

---

# 11. `modify_program` semantics

Program review needs to support coordinated changes across several routines.

Avoid requiring users to approve four disconnected routine proposals.

Conceptually:

```js
{
  proposalType: "modify_program",
  targetProgramId: "...",

  routineChanges: [
    {
      routineId: "upper-a",
      changes: [...]
    },
    {
      routineId: "upper-b",
      changes: [...]
    }
  ],

  title: "...",
  summary: "..."
}
```

Where possible, reuse the existing routine operation vocabulary:

```text
add_exercise
remove_exercise
replace_exercise
move_exercise
update_exercise
set_superset
clear_superset
rename_routine
```

Do not invent alternate mutation semantics for the same underlying routine changes.

---

# 12. Atomicity

A program proposal is one coherent transaction.

If any part fails:

```text
nothing applies
```

For example:

```text
Upper A valid
Upper B valid
Lower A contains stale exercise reference
Lower B valid
```

must result in:

```text
whole proposal rejected
```

not:

```text
3 routines partially changed
```

---

# 13. Program proposal validation

Introduce:

```js
validateProgramProposal(proposal, currentPrograms)
```

and:

```js
applyProgramProposal(currentPrograms, proposal)
```

Both should be pure.

No:

```text
Firebase
Firestore
localStorage
React
AI provider
network calls
```

inside these modules.

---

# 14. Program proposal validation requirements

Validate at minimum:

- supported version;
- supported proposal type;
- target program identity;
- program/routine count limits;
- unique program IDs;
- unique routine IDs;
- unique routineExerciseIds;
- provider-backed exercise IDs;
- exercise prescription;
- routine names;
- operation compatibility;
- superset membership;
- proposal-local group identity;
- duplicate/conflicting operations;
- archived routine handling;
- maximum proposal size.

Reuse existing routine validation internally where practical.

Do not duplicate mature logic unnecessarily.

---

# 15. Creation limits

Set conservative initial limits.

Example:

```text
maximum routines: 6
maximum exercises per routine: 12
maximum total exercises: 50
```

Use values appropriate to existing Fitbot model limits.

Reject over-sized AI proposals.

Do not silently truncate a generated program.

---

# 16. Program generation UX

The primary Rob creation entry point should become:

```text
Create Program with Rob
```

rather than:

```text
Create Routine with Rob
```

Suggested form:

```text
Create a program with Rob

Primary goal
[ Hypertrophy ▼ ]

Training days per week
[ 4 ▼ ]

Typical session duration
[ 60 minutes ▼ ]

Available equipment
[ Full gym / custom ]

Priorities
[ Shoulders and arms ]

Additional constraints
[ Keep leg volume moderate... ]

[Ask Rob to design program]
```

Support free text where useful without turning the form into a 20-question wizard.

---

# 17. Reuse profile context

Do not force users to repeatedly specify existing known preferences.

Program generation should use Fitbot profile/context for:

- training goal;
- equipment;
- injuries/constraints explicitly captured by Fitbot;
- training style;
- preferred session duration if available;
- previous training history;
- existing programs where relevant.

Explicit request values override general profile preferences for that request.

---

# 18. Program-generation context

Introduce or extend Rob context intentionally.

Prefer a new explicit request type:

```text
program_creation
```

rather than pretending creation is a review forever.

Existing `PROGRAM_REVIEW` behaviour should remain for review.

New context should contain:

```text
profile
request constraints
existing relevant programs
recent training history
exercise/provider capabilities where appropriate
```

Do not send unbounded workout history.

---

# 19. Program proposal AI contract

The authenticated server call should require exact structured output.

Example high-level AI output:

```json
{
  "version": 1,
  "explanation": "...",
  "candidate": {
    "proposalType": "create_program",
    "title": "...",
    "summary": "...",
    "program": {
      "name": "...",
      "routines": [...]
    }
  }
}
```

Exercises from AI must continue to use:

```js
exerciseRef: {
  query,
  name
}
```

Never:

```js
exerciseId
routineExerciseId
routineId
programId
```

from the model as trusted execution identity.

---

# 20. Program creation preview

Before approval, show the entire proposed program.

Example:

```text
Rob's proposed program

4-Day Hypertrophy
Shoulder & arm emphasis

UPPER A
1. Incline Chest Press
   3 × 6–10 · 120 sec

2. Lat Pulldown
   3 × 8–12 · 120 sec

3. Cable Lateral Raise
   3 × 12–20 · 60 sec

...

LOWER A
...

UPPER B
...

LOWER B
...

Weekly overview
Chest      10 sets
Back       12 sets
Delts      14 sets
Biceps      9 sets
Triceps     9 sets
Quads      10 sets
Hamstrings  8 sets

[Reject]              [Approve program]
```

Weekly set totals are useful only if Fitbot can calculate them deterministically from exercise-muscle metadata.

Do not have Rob invent totals.

---

# 21. Program approval

Follow the established safety model.

```text
AI candidate
↓
exercise resolution
↓
program validation
↓
deterministic preview
↓
freshness check
↓
human approval
↓
programDrafts only
↓
Save Program
↓
persistence
```

Do not automatically:

- activate the new program;
- change the weekly schedule;
- start its first workout;
- archive the old program.

---

# 22. Program modification preview

Program-level review should result in coherent cross-routine proposals.

Example:

```text
Rob suggests 4 program changes

UPPER A
Machine Chest Press
3 × 8–12 → 3 × 6–10

Cable Lateral Raise
3 sets → 4 sets

UPPER B
Add Cable Lateral Raise
2 × 15–20

PULL
EZ-Bar Curl
8–12 → 10–15

Why:
Your pressing work is concentrated in one rep range and your direct
lateral-delt volume is relatively low compared with your stated priority.
```

The deterministic Fitbot preview remains authoritative.

Rob's prose is explanatory.

---

# 23. Progression engine — separate from Rob

Introduce a deterministic service such as:

```text
src/services/trainingProgression.js
```

Do not put progression arithmetic into prompts.

Initial responsibilities:

```text
analyseExerciseProgression()
analyseProgramVolume()
buildSessionPrescription()
detectTrainingSignals()
```

Keep these pure where possible.

---

# 24. Training history normalization

Before progression logic, define a consistent normalized exercise-performance record.

Conceptually:

```js
{
  workoutId,
  completedAt,

  programId,
  routineId,
  routineExerciseId,
  exerciseId,

  prescribed: {
    sets,
    repRange,
    restSeconds,
    targetRir
  },

  performed: [
    {
      weight,
      reps,
      rir
    }
  ]
}
```

Support legacy workout records conservatively.

Do not invent missing RIR.

---

# 25. Introduce optional RIR logging

For future autoregulation, Fitbot needs perceived effort information.

Add optional RIR capture at a sensible granularity.

Preferred initial UX:

```text
Weight | Reps | RIR | ✓
```

RIR options could be:

```text
0
1
2
3
4+
unknown
```

Do not force users to log RIR.

The progression engine must degrade gracefully when RIR is absent.

Do not implement this in the program-proposal card if scope becomes too large; create a dedicated implementation card.

---

# 26. Deterministic progression — initial hypertrophy rule

Fitbot already uses rep ranges.

A straightforward initial model is **double progression**.

Example prescription:

```text
3 × 8–12
```

Possible deterministic rule:

If:

```text
all prescribed work sets reach the top of the range
AND
reported RIR is within acceptable bounds
AND
performance quality is valid
```

then recommend:

```text
increase load next exposure
```

Otherwise:

```text
retain load and attempt additional reps
```

Do not increase load merely because one set reaches 12 reps.

---

# 27. Load increments

Do not hard-code one universal increment.

Use available exercise/equipment information where possible.

Conceptually:

```text
plate-loaded/barbell:
smallest practical plate increment

dumbbell:
next available dumbbell increment

selectorised machine:
next stack increment where known

unknown:
recommend increase, but allow user-selected load
```

If Fitbot cannot know the next increment reliably, say:

```text
Increase to the next practical load.
```

Do not fabricate a number.

---

# 28. Session prescription states

For each exercise, progression analysis should be capable of returning:

```text
progress_load
progress_reps
hold
reduce_load
consider_deload
insufficient_data
manual_review
```

Example:

```js
{
  status: "progress_load",
  confidence: "high",
  reasonCodes: [
    "top_of_rep_range_repeated",
    "target_rir_met"
  ],
  previousPerformance: ...
}
```

Rob can translate these into normal coaching language.

---

# 29. Avoid false precision

Do not output:

```text
Use 63.74 kg today.
```

Fitbot should generate practical prescriptions based on real equipment increments and actual historical performance.

---

# 30. Rep-range change detection

Introduce training signals such as:

```text
same_rep_range_long_duration
repeated_top_of_range
repeated_bottom_of_range
performance_plateau
declining_performance
rapid_progress
```

A signal does **not** automatically cause a program mutation.

It becomes input to:

- session prescription;
- program review;
- Rob recommendations.

---

# 31. Plateau detection

Start conservatively.

Do not declare a plateau after one poor workout.

A plateau signal may require, for example:

```text
3–5 comparable exposures
```

with:

- no meaningful load increase;
- no meaningful rep increase;
- similar effort;
- no obvious missing sessions.

Keep thresholds configurable.

Document them as heuristics rather than scientific certainties.

---

# 32. Fatigue signals

Fitbot may identify potential fatigue patterns such as:

```text
performance decline across multiple exercises
increasing RPE/decreasing RIR at same load
repeated missed rep targets
unusually low completed volume
```

Do not diagnose overtraining.

Use language such as:

```text
Possible accumulated fatigue
```

not:

```text
You are overtrained.
```

---

# 33. Program volume analysis

Create deterministic weekly program metrics.

Potential dimensions:

```text
direct sets per muscle
indirect/secondary sets where reliable
movement-pattern frequency
exercise frequency
routine frequency
```

Do not create fake precision around indirect-set accounting.

Initial implementation may count:

```text
direct/primary muscle sets only
```

if that is what exercise metadata supports reliably.

Clearly identify the method.

---

# 34. Muscle-volume trends

Rob program review should receive calculated signals such as:

```js
{
  muscle: "biceps",
  weeklyDirectSets: 10,
  previousBlockAverage: 7,
  trend: "increasing"
}
```

Rob does not calculate these totals itself.

---

# 35. Program age

Track useful program/routine exposure metrics.

Examples:

```text
program created date
program last materially changed
workouts completed under current program
exercise exposures since prescription change
weeks since rep-range change
weeks since set-volume change
```

Do not rely only on calendar age.

Actual completed exposures matter more.

---

# 36. Prescription history

When program prescriptions change, preserve enough history to understand progression.

Do not rewrite old completed workouts.

Example:

```text
Weeks 1–5:
Chest Press 3 × 8–12

Weeks 6–:
Chest Press 3 × 6–10
```

Historical analysis must know the prescription applicable at each time.

---

# 37. Rob program review v2

Enhance program review context with deterministic analytics.

Instead of only sending the structural program, supply bounded derived metrics.

Example:

```text
PROGRAM
...

ANALYTICS

Machine Chest Press:
- 8 exposures
- current prescription: 3 × 8–12
- current load: 60 kg
- last 3 performances: ...
- progression status: top_of_range_repeated

Cable Lateral Raise:
- 7 weeks at 12–15
- load unchanged
- reps stable
- progression status: plateau_candidate

Weekly direct sets:
Chest: 10
Back: 12
Lateral delts: 6
Biceps: 8
...
```

This provides Rob with factual signals rather than requiring the LLM to derive them from raw history.

---

# 38. Evidence-aware Rob prompt

Rob's program-review prompt should explicitly distinguish:

```text
Fitbot facts
Fitbot heuristics
scientific principles
Rob interpretation
```

Rob must not fabricate citations.

Do not ask the model to claim:

```text
Science proves you need exactly 12 sets.
```

Instead:

```text
Your current volume is X.
Your goal is Y.
Evidence generally supports higher weekly volume for hypertrophy,
but individual response and recovery vary.
```

---

# 39. Evidence references in product

Do not make every coaching card look like an academic paper.

Provide optional:

```text
Why this?
```

or:

```text
Evidence
```

details.

Fitbot can maintain a small curated evidence registry.

Conceptually:

```js
{
  id: "hypertrophy-volume",
  claim: "...",
  sourceTitle: "...",
  doiOrPubmed: "...",
  evidenceLevel: ...
}
```

This registry should be authored/curated, not hallucinated dynamically by Rob.

---

# 40. Initial evidence registry

Start with a small number of defensible principles:

- resistance-training volume and hypertrophy;
- broad effective loading ranges;
- heavier load specificity for strength;
- proximity to failure;
- failure not being mandatory;
- autoregulation/RIR;
- progression.

Prefer:

- ACSM position stands;
- systematic reviews;
- meta-analyses;
- major peer-reviewed consensus material.

Do not scrape arbitrary fitness blogs into scientific guidance.

---

# 41. Session prescription engine

Later phase.

Given:

```text
program prescription
+
recent exercise history
+
RIR where available
+
progression rules
```

return:

```js
{
  exerciseId,
  routineExerciseId,

  target: {
    load,
    sets,
    repRange,
    targetRir
  },

  decision: "progress_load",

  explanationData: {
    previousLoad,
    previousSets,
    previousReps,
    reasonCodes
  }
}
```

This must be deterministic and testable.

---

# 42. Workout-start UX

Eventually, starting a workout should show something like:

```text
Machine Chest Press

Suggested today
62.5 kg
3 × 8–10
1–2 RIR

Last time
60 kg
10 / 10 / 10

Reason
You reached the top of your rep range last session.
```

The user can override everything.

Fitbot suggestions are not compulsory.

---

# 43. Rob's role in session prescription

Rob may explain:

> You hit 10 reps on all three sets last time at the target effort, so Fitbot has moved you to the next load.

Rob should not be the component deciding that:

```text
60 → 62.5
```

The deterministic engine decides it.

---

# 44. Rob proactive insights

Once the deterministic signals are trustworthy, surface useful coaching prompts.

Examples:

```text
Rob noticed something

You've hit the top of the rep range on Machine Chest Press in your
last three sessions.

Fitbot recommends progressing the load next time.

[View details]
```

or:

```text
Program review suggested

You've been using the same rep range and similar loading for
Cable Lateral Raise for eight weeks.

Would you like Rob to review this part of your program?

[Review]
```

Do not automatically alter the program.

---

# 45. Avoid notification spam

Signals must have:

```text
severity
confidence
cooldown
deduplication key
```

Do not show the same insight every workout.

---

# 46. User control

Users should eventually be able to choose coaching aggressiveness.

Conceptually:

```text
Conservative
Balanced
Aggressive
```

But do not implement this prematurely.

Start with one conservative default model.

---

# 47. Safety boundaries

Rob should never independently:

- start workouts;
- change active program;
- schedule training days;
- persist program changes;
- modify historical workouts;
- delete programs;
- alter health data;
- infer injuries as diagnoses;
- prescribe around serious symptoms.

The existing human approval model remains mandatory for structural program changes.

---

# 48. Migration and compatibility

Existing Fitbot programs must continue working.

Do not require users to regenerate programs through Rob.

Existing routine proposal/review functionality must continue passing tests.

Program proposal functionality should coexist with:

```text
manual builder
routine review
routine modification proposal
current Create Routine with Rob
```

during migration.

---

# 49. Recommended build sequence

Do not implement this entire initiative in one Codex execution.

Create implementation cards in this order.

## Card 1 — Harden AI exercise resolution

Build:

- alias support;
- deterministic similarity matching;
- ambiguity state;
- user resolution UI;
- regression tests.

This removes the current provider-ID/name bottleneck.

---

## Card 2 — Define provider-neutral program proposal contract

Implement:

```text
validateProgramProposal()
applyProgramProposal()
```

Support:

```text
create_program
modify_program
```

No AI UI yet.

Build extensive pure tests first.

---

## Card 3 — Generate complete programs with Rob

Add:

```text
Create Program with Rob
```

Support:

```text
3–6 training days
goal
duration
equipment
priorities
constraints
```

Generate one atomic program proposal.

---

## Card 4 — Human review and approval for program proposals

Reuse existing proposal philosophy.

Build:

- full program preview;
- freshness fingerprints;
- approve/reject;
- draft-only application;
- explicit Save Program.

---

## Card 5 — Program-level actionable Rob review

Take existing program review and allow it to generate:

```text
modify_program
```

proposals spanning several routines.

---

## Card 6 — Normalize progression history

Establish deterministic historical records required for longitudinal analysis.

No AI work.

---

## Card 7 — Add optional RIR logging

Integrate RIR cleanly into workout logging and history.

Keep optional.

---

## Card 8 — Build deterministic exercise progression engine

Implement:

- rep-range progression;
- hold/progress states;
- load recommendations where increments are known;
- reason codes;
- tests.

---

## Card 9 — Build program analytics

Implement:

- weekly direct volume;
- exposure counts;
- rep-range duration;
- performance trends;
- plateau candidates;
- progression signals.

---

## Card 10 — Feed progression analytics into Rob

Rob receives compact deterministic analytics rather than deriving everything from raw history.

---

## Card 11 — Add session prescriptions

Generate evidence-aware next-session targets.

No automatic structural program edits.

---

## Card 12 — Surface proactive coaching insights

Show high-value signals without notification spam.

---

# 50. What not to build yet

Do not implement early:

```text
fully autonomous coaching
automatic program periodisation
automatic deload weeks
AI-generated weights without deterministic basis
whole-program replacement without preview
automatic program activation
automatic calendar scheduling
nutrition coaching
medical/injury diagnosis
complex readiness scores
wearable integration
velocity tracking
1RM prediction as a core requirement
```

These can be considered later.

---

# 51. Testing philosophy

The key distinction for future tests is:

```text
AI quality tests
≠
domain safety tests
```

Do not test:

```text
Rob always creates the perfect program.
```

Do test:

```text
untrusted AI output can never bypass validation
```

and:

```text
deterministic progression recommendations follow documented rules.
```

---

# 52. Program proposal tests

Cover at minimum:

```text
valid 3-day program
valid 4-day program
valid 5-day program
duplicate routine IDs
duplicate exercise IDs
invalid prescriptions
invalid exercise IDs
unresolved exercises
ambiguous exercises
valid supersets
invalid supersets
over-sized programs
partial resolution failure
stale proposal
reject
approve
double approval
Save Program persistence
no automatic active-program change
no schedule mutation
```

---

# 53. Progression engine tests

Use table-driven deterministic cases.

Example:

```text
Prescription:
3 × 8–12

History:
10 / 10 / 10
11 / 11 / 10
12 / 12 / 12 @ target RIR

Expected:
progress_load
```

Example:

```text
8 / 8 / 7
8 / 8 / 8
9 / 8 / 8

Expected:
progress_reps / hold
```

Example:

```text
12 / 12 / 12
RIR unknown

Expected:
progress_load_possible
confidence lower
```

Document expected policy clearly.

---

# 54. Scientific-rule tests

Do not encode research papers directly into fragile test assertions.

Tests should target Fitbot's chosen implementation policy.

Example:

```text
Policy:
Hypertrophy default target RIR = 1–3

Test:
configuration returns 1–3
```

Document that this is Fitbot's operational choice informed by evidence, not an immutable scientific constant.

---

# 55. Product terminology

Prefer:

```text
Program
Routine
Prescription
Target
Progress
Review
Suggestion
RIR
```

Avoid overly clinical or pseudo-scientific terminology.

Do not label Rob:

```text
AI physiologist
AI doctor
scientific expert
```

---

# 56. Documentation structure

Update the source-of-truth docs as each stage lands.

Eventually document:

```text
Rob architecture
program proposals
exercise resolution
progression engine
RIR
training analytics
session prescriptions
evidence registry
safety boundaries
```

Keep implemented vs future features clearly separated.

---

# 57. Immediate product decision

From this point forward:

**Program-level coaching is the primary Rob roadmap.**

Single-routine generation is no longer the core feature being optimised.

Routine review and targeted routine modifications remain supported.

The existing `Create with Rob` routine implementation should be treated as:

```text
working experimental capability
```

rather than the foundation for the next sequence.

---

# 58. Near-term target experience

The first major product milestone should be:

```text
User:
Build me a four-day hypertrophy program.
I have about an hour each session.
Full gym.
Prioritise arms and shoulders.

Rob:
generates structured candidate

Fitbot:
resolves every exercise
validates complete program
shows four-routine preview
shows useful program metrics

User:
Approve program

Fitbot:
adds unsaved program draft

User:
edits if desired

User:
Save Program
```

---

# 59. Longer-term target experience

The second major milestone should be:

```text
User has trained the program for several weeks

Fitbot analyses:
exercise performance
rep progression
RIR
weekly set volume
stalls/trends

Rob says:

Your chest pressing continues to progress,
but lateral-delt performance has been flat for six weeks.

You've also reached the top of your current rep range
on Machine Chest Press for the last three exposures.

I recommend:
- progressing Chest Press load;
- changing Lateral Raise from 10–15 to 15–20;
- adding one lateral-delt set to Upper B.

[Review proposed program changes]
```

Then:

```text
Fitbot deterministic proposal preview
↓
Approve
↓
draft
↓
Save Program
```

---

# 60. End-state principle

Fitbot should not become:

> an LLM that spits out workouts.

It should become:

> **a structured training system that understands the user's program and training history, uses evidence-informed deterministic logic to evaluate progression, and gives Rob enough reliable information to behave like a useful coach.**

The product hierarchy should therefore be:

```text
FITBOT DOMAIN LOGIC
owns:
- exercise identity
- program state
- workout history
- progression calculations
- training analytics
- proposal validation
- persistence

ROB
owns:
- synthesis
- explanation
- coaching dialogue
- structured recommendations
- candidate program design

USER
owns:
- goals
- constraints
- overrides
- approval
- final decisions
```

That separation is the foundation for every subsequent Rob feature.