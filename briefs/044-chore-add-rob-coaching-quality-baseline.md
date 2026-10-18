# Codex Brief — Rob Coaching Quality Baseline

**Project:** Nevfit
**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`

## Goal

Establish an objective, repeatable assessment of Rob's coaching competence, cohesiveness and personality before making further production changes.

Determine whether stronger AI models, improved prompting or existing architectural limitations explain the current poor coaching quality.

## Expected outcome

A repeatable, non-production evaluation that compares Rob's current AI model against up to two stronger alternatives using identical training scenarios and context.

Evaluate:

1. **Programming competence:** Practical exercise selection, appropriate volume, session-duration feasibility, weekly structure, recovery and progression.
2. **Cohesiveness:** Consistency across recommendations, respect for the athlete's established preferences, goals and constraints.
3. **Coaching insight:** Ability to interpret actual training evidence, identify meaningful patterns and provide useful next steps.
4. **Personality:** Natural, confident, engaging and appropriately candid communication without generic encouragement or unnecessary verbosity.
5. **Reliability:** Factual grounding, handling of uncertainty, response failures, latency and API cost.

## Test scenarios

Develop five representative scenarios:

- A 60-minute hypertrophy session with realistic equipment and constraints.
- A four-day hypertrophy program prioritising shoulders and arms.
- Assessment of a questionable exercise selection, including an unnecessarily unconventional movement.
- Review of a completed training week containing enough historical evidence for meaningful comparisons.
- A follow-up coaching conversation requiring consistency with previously established information.

Include realistic athlete preferences and constraints, including exercise dislikes, preferred equipment and movements that aggravate discomfort.

Use synthetic or explicitly approved training data. Do not modify actual workout records.

## Evaluation method

- Inspect the existing Rob architecture, prompts, context builders, model configuration and test infrastructure.
- Use the current configured model as the baseline.
- Identify up to two stronger models supported by the existing OpenRouter integration.
- Compare models using equivalent instructions, context and generation settings wherever supported.
- Capture actual model identity, outputs, latency, token usage and estimated cost.
- Evaluate outputs against a consistent scoring rubric.
- Identify critical coaching failures separately from subjective stylistic preferences.
- Distinguish failures caused by missing context from failures caused by poor model reasoning.
- Include a small prompt-quality comparison to determine whether clearer coaching instructions materially improve results.

Do not treat plausible-sounding explanations as proof of coaching competence.

## Scope boundaries

- Do not change the production AI model.
- Do not replace existing Rob prompts or program-generation flows.
- Do not connect the experimental weekly-blueprint architecture to production.
- Do not modify user programs, routines or workout history.
- Do not create additional implementation cards or sequences.
- Do not make paid model calls without explicit authorisation.
- Prefer existing infrastructure and minimise unnecessary complexity.

## Deliverables

Provide:

1. A concise description of the evaluation approach.
2. Reusable scenarios and scoring criteria.
3. A proposed model shortlist with estimated evaluation cost.
4. A clear separation between evaluation tooling that is ready and paid API tests awaiting authorisation.
5. The exact command or mechanism to execute the evaluation.
6. Any identified architectural blockers.

If execution is authorised, produce a comparison report containing representative outputs, scores, failure analysis, actual costs and recommended next steps.

## Validation and handoff

Run relevant local tests and lint checks.

Report changed files, commit, tests, limitations and any configuration requirements.

Follow the NevDev checkpoint workflow. Submit the implementation for independent code review before user verification.

**Success criterion:** We can demonstrate why Rob currently performs poorly and identify the smallest justified improvement, rather than simply generating more code or switching models on assumption.
