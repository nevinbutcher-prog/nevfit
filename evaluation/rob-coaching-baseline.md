# Rob coaching quality baseline

**Status:** Pre-run plan. The authorised run and preserved evidence are in the [execution report](rob-coaching-run-2026-10-18.md).
**Date prepared:** 18 October 2026.
**Scope:** Five synthetic scenarios, the repository's configured default model, two comparison models, and two small baseline prompt variants. Production code and user data are untouched.

## Method

`scripts/evaluateRobCoaching.mjs` creates 17 fixed requests: five current-prompt scenarios for each of three models, plus clearer-instruction variants for two advice scenarios on the baseline model. It reuses the production advice context builder and prompt composer, and the production program request validator, catalogue, prompt, strict response schema, candidate parser, and advisory quality check. It substitutes a synthetic athlete profile for the repository's static personal profile. All models receive the same messages, response schema and output ceiling for a given current-prompt scenario; prompt hashes make that equivalence inspectable. The OpenRouter request matches the production adapter's chat-completions fields and 25-second timeout. Calls run one at a time without retries.

The script captures requested and returned model IDs, raw output, HTTP or validation failure, finish reason, latency, token usage, estimated token-priced cost, and OpenRouter's billed `total_cost` when generation metadata is available. Results contain blank human scoring fields. Automatic schema and workload checks are evidence, not proof of coaching competence. A reviewer should score the outputs without seeing the model labels first where practical, then compare reliability, latency and cost.

## Synthetic scenarios and expected evidence

| Scenario | Primary decision | Known context limit |
| --- | --- | --- |
| 60-minute hypertrophy session | Select practical exercises, sets, rests and order within time and equipment limits | Uses a one-day `create_program` request because there is no separate session-generation contract. |
| Four-day shoulder and arm emphasis | Cover the whole body while adding modest priority volume and feasible recovery | The bounded 32-exercise catalogue determines available choices. |
| Unconventional exercise choice | Challenge an Axe Hold ahead of a lateral raise and offer a small correction | The odd choice is stated in the question; no executable change is requested. |
| Completed training week | Compare four synthetic sessions across two weeks and make evidence-based next steps | Production advice context includes only the latest one of four supplied workouts. |
| Follow-up conversation | Stay consistent with known constraints and an alleged prior preference | No prior chat turn is in the production advice request. A grounded answer must acknowledge that. |

The synthetic athlete prefers shoulder and arm hypertrophy, has dumbbells, a barbell, bench and cable machine, dislikes behind-the-neck pressing, lacks leg press access, and reports discomfort with heavy unsupported hinges. These are test facts, not account records or medical findings.

## Human scoring rubric

Score each applicable dimension from **0 to 4**. Use **N/A** when the scenario does not test it. Record a supporting excerpt or specific omission for every score, and mark critical failures separately. Do not average away a critical failure.

| Dimension | 0 | 2 | 4 |
| --- | --- | --- | --- |
| Programming competence | Unsafe or unworkable selection, volume, timing or recovery | Mostly plausible but has a material gap | Practical, coherent, feasible choices with suitable progression |
| Cohesiveness | Contradicts supplied goals, preferences or constraints | Mostly consistent with minor unexplained drift | Recommendations fit together and consistently respect supplied facts |
| Coaching insight | Invents patterns or misses the key evidence | Notices some evidence but gives generic next steps | Correctly interprets the visible log and gives a useful, bounded next action |
| Personality | Generic praise, evasive or needlessly long | Clear enough but stiff or verbose | Candid, natural and concise while answering the decision |
| Reliability | Fabricates facts, IDs, memory or safety, or fails to return usable output | Minor uncertainty or formatting issues | Grounded, explicit about uncertainty, valid output with no material failure |

Critical failures include an invented prior conversation, a false comparison using workouts absent from the prompt, disregard of a stated discomfort constraint, a fabricated exercise ID, an invalid executable candidate, or an unsupported medical safety claim. Record these independently of style preferences. Before attributing a poor answer to model reasoning, compare the scenario's supplied facts with the `contextCoverage` field and the actual prompt. A missing fact is an architecture/context issue; mishandling a visible fact is a model or prompt issue. Compare the two clearer-prompt baseline pairs to assess prompt sensitivity without changing production instructions.

## Model shortlist and cost

The repository default is `openai/gpt-4o-mini` unless deployment sets `AI_MODEL`. The two proposed comparison routes are `openai/gpt-4.1` for stronger instruction following and `anthropic/claude-sonnet-4.5` for a cross-provider coaching comparison. These are hypotheses to test, not established winners. [Official OpenAI documentation](https://developers.openai.com/api/docs/models/gpt-4.1) describes GPT-4.1's instruction-following strengths; the route IDs and prices below come from OpenRouter.

| OpenRouter route | Input / 1M tokens | Output / 1M tokens | Source |
| --- | ---: | ---: | --- |
| `openai/gpt-4o-mini` | US$0.15 | US$0.60 | [OpenRouter](https://openrouter.ai/openai/gpt-4o-mini/overview) |
| `openai/gpt-4.1` | US$2.00 | US$8.00 | [OpenRouter](https://openrouter.ai/openai/gpt-4.1) |
| `anthropic/claude-sonnet-4.5` | US$3.00 | US$15.00 | [OpenRouter](https://openrouter.ai/anthropic/claude-sonnet-4.5/) |

The dry run estimates **US$0.3155** if every output reaches its configured ceiling, using approximately four input characters per token. A deliberately higher character-per-token budget calculation is **US$0.4365**. These are planning estimates, not a billing guarantee: route prices, tokenisation, provider behavior and extra charges can differ. The execution command requires an explicit `--max-usd` budget and checks it against that higher calculation. After execution, use the returned token counts and [OpenRouter generation metadata](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation) for measured costs. A missing `total_cost` is flagged rather than described as zero.

## Commands and configuration

From the repository root, preview all requests and cost estimates with no key or network call:

```powershell
node scripts/evaluateRobCoaching.mjs
```

After explicit authorisation for the paid evaluation, provide `OPENROUTER_API_KEY` through the local environment or a secret manager and run:

```powershell
node scripts/evaluateRobCoaching.mjs --execute --acknowledge-paid-calls --max-usd 1
```

The script writes incremental and final JSON to ignored `eval-results/`. It does not send user account data. Do not put the key in source, CLI arguments or the report. Before execution, confirm that production has not overridden `AI_MODEL`; the script refuses a locally configured value different from the priced baseline. If the deployed model differs, update the shortlist and prices before seeking execution authorisation. Model route support for strict JSON schema is verified only by the paid run, not by the dry run.

## Architectural findings and limits

- `buildRobContext()` caps advice history at one workout and review history at three. The training-week case therefore cannot provide all four sessions to the advice prompt. A model that honestly declines the comparison may be behaving correctly.
- `composeRobAdviceMessages()` carries one question and context, with no conversation transcript. The follow-up case tests whether Rob admits that gap rather than inventing a memory.
- The profile is a static in-repository object, not a persisted athlete preference history. The evaluation substitutes a synthetic profile with the same shape; production cannot learn evolving preferences from prior chats through this route.
- Whole-program output is restricted to a bounded verified catalogue and a strict executable schema. This protects IDs but limits evaluation of free-form coaching explanations and exercise alternatives. The experimental weekly-blueprint path remains disconnected.
- The execution report records latency, response reliability and available billed costs. Coaching quality remains subject to independent human scoring.
