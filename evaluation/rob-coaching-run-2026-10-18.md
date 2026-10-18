# Rob coaching evaluation: execution report

**Run date:** 18 October 2026 (UTC). **Status:** Executed for independent assessment; human scores remain blank. **Production Rob code:** unchanged. The fixtures contain synthetic athlete and workout data only.

## Evidence and method

- [Raw 17-request run](results/rob-coaching-2026-10-18T01-45-43-760Z.json) contains each request ID and prompt hash, raw response, returned model, token usage, latency, finish reason, program validation, and blank `humanReview` fields. The [generation-cost metadata](results/rob-coaching-2026-10-18T01-45-43-760Z-cost-metadata.json) was fetched read-only after the run and keyed by case and generation ID. The evaluator's immediate billing lookup returned `null` for all 15 successes; use the separate metadata file for the retrieved billed amounts.
- [Initial authentication-failure record](results/rob-coaching-2026-10-18T01-44-04-250Z-auth-fail.json) preserves 17 HTTP 401 attempts caused by including Firebase CLI status lines in the key. They yielded no generation IDs, output, or usage. The user then explicitly authorised exactly 17 replacement requests. No further model requests were made.
- Before the replacement run, the repository default `openai/gpt-4o-mini` was checked against deployed `robAdvice` and `robProgramGeneration` environment variables; neither had an `AI_MODEL` override. The correctly extracted secret passed OpenRouter's key check. Current prices were checked against OpenRouter's live model catalogue: `gpt-4o-mini` $0.15/$0.60, `gpt-4.1` $2/$8, and `claude-sonnet-4.5` $3/$15 per million input/output tokens, respectively ([model pages](https://openrouter.ai/openai/gpt-4o-mini), [GPT-4.1](https://openrouter.ai/openai/gpt-4.1), [Claude](https://openrouter.ai/anthropic/claude-sonnet-4.5)). The harness calculated a $0.3155 output-ceiling estimate and $0.4365 conservative preflight ceiling, within the authorised US$1 budget.
- The 17 replacement requests were sequential, with no retries, using the fixed three-model shortlist, five scenarios, and two baseline prompt variants described in the [evaluation plan](rob-coaching-baseline.md). The program requests used the production strict schema and catalogue. Advice requests used the production context builder with synthetic fixtures. All current-prompt models within a scenario shared a prompt hash. The 25-second request timeout matched the production adapter.

## Results

Fifteen requests returned usable text. Both Claude program requests timed out at about 25 seconds; this is a **request reliability finding**, with no program content to score. All four returned program candidates passed the production parser and schema validation. Two also had non-blocking quality warnings.

| Model | Completed / attempted | Input / output tokens on completed calls | Median completed latency | Billed cost found |
| --- | ---: | ---: | ---: | ---: |
| `openai/gpt-4o-mini` (including two prompt variants) | 7 / 7 | 10,050 / 1,684 | 1,061 ms | $0.0025179 |
| `openai/gpt-4.1` | 5 / 5 | 7,920 / 2,303 | 532 ms | $0.0342640 |
| `anthropic/claude-sonnet-4.5` | 3 / 5 | 3,317 / 782 | 1,341 ms | $0.0216810 |
| **Total** | **15 / 17** | **21,287 / 4,769** | — | **$0.0584629** |

These are OpenRouter `total_cost` values for the 15 completed generation IDs, retrieved through its [generation metadata endpoint](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation). They equal the token-priced calculation for those calls. **The total is a known billed subtotal, not a complete account charge:** the two timed-out calls returned no generation ID or usage, so any charge for them cannot be attributed from this run. The 17 earlier 401 attempts yielded no generations and no observed model billing.

| Scenario | Baseline `gpt-4o-mini` | `gpt-4.1` | Claude 4.5 | Automated finding |
| --- | --- | --- | --- | --- |
| 60-minute session | Completed | Completed | Timed out | Both returned valid programs; workload estimates 50.8 and 48.6 minutes. |
| Four-day program | Completed | Completed | Timed out | Both valid. Baseline lower-body day estimated at 22.6 minutes (`limited_workload`); GPT-4.1 arm day flagged `routine_muscle_concentration`. |
| Axe Hold advice | Completed; clearer prompt completed | Completed | Completed | Human judgment needed on whether the unusual choice was challenged clearly enough. |
| Training-week comparison | Completed; clearer prompt completed | Completed | Completed | Only one of four supplied workouts reached every advice prompt. |
| Follow-up / remembered row | Completed | Completed | Completed | No prior conversation turn reached any prompt. |

## Findings for human review

**Visible-fact handling and model reasoning.** The baseline model's current Axe Hold response calls the hold “great” for stabilizers and potentially beneficial for hypertrophy before recommending the conventional lateral raise first. The clearer-prompt baseline response still rationalises the hold as an activation step. This is a prompt-sensitive coaching-judgment concern, not a schema defect; the GPT-4.1 and Claude responses give a more direct rationale for prioritising lateral raises. The baseline follow-up begins “Yes, if you agreed...” and does not explicitly say it lacks the alleged earlier conversation. It avoids naming an invented preference, but may leave a false impression of remembered agreement. GPT-4.1 and Claude explicitly identify the absent turn. The baseline four-day program's 22.6-minute lower-body day is below the requested 60-minute session; the validator caught this as an advisory quality concern. Its dumbbell Romanian deadlift deserves review against the stated lower-back discomfort: the constraint prohibits *heavy unsupported* hinges, and the output omits loading, so this is not automatically a violation.

**Missing context supplied by the architecture.** The training-week fixture has four completed sessions across two weeks; `buildRobContext()` exposes only the latest one to advice. Every model therefore correctly declined to claim a two-week comparison. The responses could describe only the latest lunge and hip-thrust session; lack of a comparison is not a model reasoning failure. The follow-up fixture supplies no prior chat turn through the production advice path. No model can verify which row variation was agreed or why. These are context limitations, not evidence that the user's earlier data does not exist.

**Prompt and interaction weaknesses.** The clearer prompt asks for the actual decision first, conventional movements, explicit missing evidence, and no invented memory. In this single Axe Hold comparison, it did not remove the baseline model's initial rationalisation. In the training-week comparison, it made the baseline response more explicit about missing history but reduced the answer to a request for more data, omitting the useful next action grounded in the visible workout. The program system prompt asks for practical duration and balanced coverage, yet the baseline generated a short lower-body day and GPT-4.1 concentrated one day on arms. The two program quality warnings are evidence for human scrutiny, not proof that either program is unusable.

**Reliability and limits.** Claude completed all three advice calls but timed out on both strict-schema program calls. This run cannot determine whether the cause was provider latency, strict-schema handling, or transient service conditions. It contains one sample per model/scenario, so differences in style, latency, and cost are observations, not stable rankings. The workload estimator is approximate, and no output has been human scored or exercised in the product. Do not infer medical safety from the automated checks.

## Independent assessment handoff

Score each completed response using the five 0–4 dimensions and critical-failure rules in the [baseline rubric](rob-coaching-baseline.md#human-scoring-rubric). The raw JSON leaves `humanReview` fields blank; retain the response text and cite a concrete phrase or omission for every score. Mark the two timeouts **N/A for coaching quality** and record them under reliability. Compare current-prompt responses within each scenario before considering the two baseline prompt variants. Separate (1) mishandling facts visible in the prompt, (2) facts dropped before the prompt, and (3) instructions that leave room for an undesirable answer. No model or production prompt change is recommended from automated validation alone.
