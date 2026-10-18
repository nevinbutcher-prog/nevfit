import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiConfig } from "../functions/src/ai/aiConfig.js";
import { ROB_CATALOGUE_VERSION } from "../functions/src/rob/robExerciseCatalogue.js";
import {
  assessProgramQuality,
  estimateRoutineWorkloadMinutes,
  parseProgramCandidate,
  programCandidateResponseFormat,
  programGenerationMessages,
  validateProgramGenerationRequest,
} from "../functions/src/rob/robProgramGeneration.js";
import { validateRobAdviceRequest } from "../functions/src/rob/robAdvice.js";
import { composeRobAdviceMessages } from "../functions/src/rob/robPrompt.js";
import { buildRobContext, ROB_CONTEXT_TYPES } from "../src/services/rob/robContext.js";
import { catalogueIds, scenarios, syntheticProfile, syntheticProgram } from "./robCoachingEvalFixtures.mjs";

export const modelShortlist = Object.freeze([
  { id: "openai/gpt-4o-mini", inputPerMillion: 0.15, outputPerMillion: 0.60, role: "current baseline" },
  { id: "openai/gpt-4.1", inputPerMillion: 2, outputPerMillion: 8, role: "stronger instruction-following candidate" },
  { id: "anthropic/claude-sonnet-4.5", inputPerMillion: 3, outputPerMillion: 15, role: "cross-provider coaching candidate" },
]);

const promptRevision = "Answer the actual coaching decision first. Prefer conventional, feasible movements. Use the supplied training evidence and explain one meaningful tradeoff. If the evidence or a prior conversation turn is absent, say exactly what is missing. Avoid praise, filler, invented memory, and unsupported claims.";
const revisedScenarioIds = new Set(["questionable-exercise", "training-week"]);
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tokenEstimate = (chars) => Math.ceil(chars / 4);
const estimatedCost = (model, inputTokens, outputTokens) =>
  (inputTokens * model.inputPerMillion + outputTokens * model.outputPerMillion) / 1_000_000;

export function buildEvaluationCases() {
  if (aiConfig.model !== modelShortlist[0].id) {
    throw new Error(`Configured AI_MODEL ${aiConfig.model} differs from the priced evaluation baseline.`);
  }
  return scenarios.flatMap((scenario) => {
    let messages;
    let responseFormat = null;
    let requirements = null;
    let catalogue = null;
    let contextCoverage = null;
    if (scenario.type === "program") {
      const request = validateProgramGenerationRequest({
        requirements: scenario.requirements,
        catalogue: { version: ROB_CATALOGUE_VERSION, ids: catalogueIds },
      });
      ({ requirements, catalogue } = request);
      messages = programGenerationMessages(requirements, catalogue);
      responseFormat = programCandidateResponseFormat(catalogue);
    } else {
      const context = buildRobContext({
        requestType: ROB_CONTEXT_TYPES.ADVICE,
        program: syntheticProgram,
        completedWorkouts: scenario.workouts ?? [],
      });
      // Preserve the production context shape and history limits while replacing
      // the repository's personal static profile with wholly synthetic data.
      context.profile = structuredClone(syntheticProfile);
      const request = validateRobAdviceRequest({ question: scenario.question, context });
      messages = composeRobAdviceMessages(request);
      contextCoverage = {
        suppliedWorkouts: scenario.workouts?.length ?? 0,
        visibleWorkouts: context.history.workouts.length,
        priorConversationTurns: 0,
      };
    }
    const variants = ["current", ...(revisedScenarioIds.has(scenario.id) ? ["clearer-prompt"] : [])];
    return variants.flatMap((variant) => modelShortlist
      .filter((model) => variant === "current" || model.id === modelShortlist[0].id)
      .map((model) => {
        const caseMessages = structuredClone(messages);
        if (variant === "clearer-prompt") caseMessages[0].content += `\n\n${promptRevision}`;
        const maxOutputTokens = scenario.type === "program" ? aiConfig.programMaxOutputTokens : aiConfig.maxOutputTokens;
        const inputChars = caseMessages.reduce((sum, message) => sum + message.content.length, 0)
          + (responseFormat ? JSON.stringify(responseFormat).length : 0);
        return {
          id: `${scenario.id}:${variant}:${model.id}`,
          scenarioId: scenario.id, title: scenario.title, type: scenario.type,
          variant, model, messages: caseMessages, responseFormat,
          requirements, catalogue, checks: scenario.checks,
          contextCoverage, maxOutputTokens, inputChars,
          promptHash: sha256({ messages: caseMessages, responseFormat, maxOutputTokens }),
          estimatedCostUsd: estimatedCost(model, tokenEstimate(inputChars), maxOutputTokens),
          conservativeCostCeilingUsd: estimatedCost(model, inputChars, maxOutputTokens),
        };
      }));
  });
}

export function dryRunManifest(cases = buildEvaluationCases()) {
  return {
    mode: "dry-run", calls: cases.length,
    estimatedMaximumUsd: Number(cases.reduce((sum, item) => sum + item.estimatedCostUsd, 0).toFixed(4)),
    conservativeCostCeilingUsd: Number(cases.reduce((sum, item) => sum + item.conservativeCostCeilingUsd, 0).toFixed(4)),
    cases: cases.map(({ id, promptHash, inputChars, maxOutputTokens, estimatedCostUsd, contextCoverage }) => ({
      id, promptHash, inputChars, maxOutputTokens,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(5)), contextCoverage,
    })),
  };
}

async function getBilledCost(apiKey, generationId) {
  if (!generationId) return null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const cost = (await response.json())?.data?.total_cost;
        if (Number.isFinite(cost)) return cost;
      }
    } catch { /* The completion result remains usable if cost metadata is delayed. */ }
    if (attempt < 2) await new Promise((done) => setTimeout(done, 1000));
  }
  return null;
}

async function runCase(item, apiKey) {
  const started = performance.now();
  try {
    // Match the production OpenRouter request fields and timeout. Only the
    // locally fixed model ID varies. No Firebase callable or account data is used.
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: item.model.id, messages: item.messages, max_tokens: item.maxOutputTokens,
        stream: false,
        ...(item.responseFormat ? { response_format: item.responseFormat, provider: { require_parameters: true } } : {}),
      }),
      signal: AbortSignal.timeout(aiConfig.timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) return { status: "http-error", httpStatus: response.status, latencyMs };
    const body = await response.json();
    const output = body?.choices?.[0]?.message?.content;
    if (typeof output !== "string" || !output.trim()) return { status: "invalid-response", latencyMs };
    const usage = {
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
      totalTokens: body.usage?.total_tokens ?? null,
    };
    const result = {
      status: "completed", requestedModel: item.model.id, actualModel: body.model ?? null,
      generationId: body.id ?? null, latencyMs, finishReason: body.choices[0].finish_reason ?? null,
      usage, billedCostUsd: await getBilledCost(apiKey, body.id),
      tokenPricedCostUsd: Number.isFinite(usage.inputTokens) && Number.isFinite(usage.outputTokens)
        ? estimatedCost(item.model, usage.inputTokens, usage.outputTokens) : null,
      output,
    };
    if (item.type === "program") {
      try {
        const parsed = parseProgramCandidate(output, item.requirements, item.catalogue);
        result.validation = { valid: true, quality: assessProgramQuality(parsed.candidate, item.requirements, item.catalogue),
          routineMinutes: parsed.candidate.program.days.map(estimateRoutineWorkloadMinutes) };
      } catch (error) {
        result.validation = { valid: false, reason: error.validationDiagnostic ?? error.code ?? "unknown" };
      }
    }
    return result;
  } catch (error) {
    return { status: error.name === "TimeoutError" || error.name === "AbortError" ? "timeout" : "request-error",
      latencyMs: Math.round(performance.now() - started), errorName: error.name ?? "Error" };
  }
}

export async function executeEvaluation(cases, { apiKey, maxUsd, onProgress = async () => {} }) {
  if (!apiKey || !Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error("Execution requires an API key and positive --max-usd budget.");
  const conservativeTotal = cases.reduce((sum, item) => sum + item.conservativeCostCeilingUsd, 0);
  if (conservativeTotal > maxUsd) throw new Error(`Budget is below conservative ceiling $${conservativeTotal.toFixed(2)}.`);
  const results = [];
  for (const item of cases) {
    const result = await runCase(item, apiKey);
    results.push({
      id: item.id, scenarioId: item.scenarioId, title: item.title, type: item.type,
      variant: item.variant, checks: item.checks, contextCoverage: item.contextCoverage,
      promptHash: item.promptHash, result,
      humanReview: { programming: null, cohesiveness: null, insight: null, personality: null, reliability: null,
        criticalFailures: [], missingContext: [], reasoningFailures: [], notes: "" },
    });
    process.stdout.write(`${item.id}: ${result.status}\n`);
    await onProgress(results);
  }
  return { generatedAt: new Date().toISOString(), mode: "executed", modelRatesUsdPerMillion: modelShortlist,
    results, totalBilledCostUsd: results.reduce((sum, item) => sum + (item.result.billedCostUsd ?? 0), 0),
    billedCostComplete: results.every((item) => item.result.status !== "completed" || item.result.billedCostUsd !== null) };
}

async function main() {
  const args = process.argv.slice(2);
  const cases = buildEvaluationCases();
  if (!args.includes("--execute")) {
    process.stdout.write(`${JSON.stringify(dryRunManifest(cases), null, 2)}\n`);
    return;
  }
  if (!args.includes("--acknowledge-paid-calls")) throw new Error("Paid execution requires --acknowledge-paid-calls.");
  const budgetIndex = args.indexOf("--max-usd");
  const maxUsd = budgetIndex >= 0 ? Number(args[budgetIndex + 1]) : NaN;
  const path = resolve("eval-results", `rob-coaching-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await mkdir(dirname(path), { recursive: true });
  const report = await executeEvaluation(cases, {
    apiKey: process.env.OPENROUTER_API_KEY, maxUsd,
    onProgress: async (results) => writeFile(path, JSON.stringify({ mode: "in-progress", results }, null, 2)),
  });
  await writeFile(path, JSON.stringify(report, null, 2));
  process.stdout.write(`Saved ${path}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
