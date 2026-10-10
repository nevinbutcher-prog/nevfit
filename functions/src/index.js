import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { aiConfig } from "./ai/aiConfig.js";
import { AiError, normalizeAiError, toClientError } from "./ai/aiErrors.js";
import { createOpenRouterProvider } from "./ai/providers/openRouterProvider.js";
import { generateAiResponse } from "./ai/aiService.js";
import { generateRobAdvice } from "./rob/robAdvice.js";
import { generateRobReview } from "./rob/robReview.js";
import { generateRobProposal } from "./rob/robProposal.js";
import { generateRobProgramCandidate } from "./rob/robProgramGeneration.js";

const openRouterApiKey = defineSecret("OPENROUTER_API_KEY");

export function createAiGenerateHandler({ providerFactory = () => createOpenRouterProvider({ apiKey: openRouterApiKey.value(), config: aiConfig }) } = {}) {
  return async (request) => {
    if (!request.auth) {
      const error = toClientError(new AiError("ai_unauthenticated"));
      throw new HttpsError("unauthenticated", error.message, error);
    }
    const startedAt = Date.now();
    try {
      const result = await generateAiResponse(request.data, { provider: providerFactory() });
      logger.info("AI request completed", { provider: aiConfig.provider, model: result.model, durationMs: Date.now() - startedAt, usage: result.usage, authenticatedUidPresent: true });
      return result;
    } catch (error) {
      const normalized = normalizeAiError(error);
      logger.warn("AI request failed", { provider: aiConfig.provider, model: aiConfig.model, code: normalized.code, durationMs: Date.now() - startedAt, authenticatedUidPresent: true });
      throw new HttpsError(normalized.code === "ai_invalid_request" ? "invalid-argument" : "internal", normalized.message, toClientError(normalized));
    }
  };
}

export const aiGenerate = onCall({ secrets: [openRouterApiKey], timeoutSeconds: 35 }, createAiGenerateHandler());

export function createRobAdviceHandler({ providerFactory = () => createOpenRouterProvider({ apiKey: openRouterApiKey.value(), config: aiConfig }) } = {}) {
  return async (request) => {
    if (!request.auth) {
      const error = toClientError(new AiError("ai_unauthenticated"));
      throw new HttpsError("unauthenticated", error.message, error);
    }
    const startedAt = Date.now();
    try {
      const result = await generateRobAdvice(request.data, { provider: providerFactory() });
      logger.info("Rob advice completed", { operation: "rob_advice", model: result.model, durationMs: Date.now() - startedAt, usage: result.usage, authenticatedUidPresent: true });
      return result;
    } catch (error) {
      const normalized = normalizeAiError(error);
      logger.warn("Rob advice failed", { operation: "rob_advice", model: aiConfig.model, code: normalized.code, validation: normalized.validationDiagnostic ?? null, durationMs: Date.now() - startedAt, authenticatedUidPresent: true });
      throw new HttpsError(normalized.code === "ai_invalid_request" ? "invalid-argument" : "internal", normalized.message, toClientError(normalized));
    }
  };
}

export const robAdvice = onCall({ secrets: [openRouterApiKey], timeoutSeconds: 35 }, createRobAdviceHandler());

export function createRobReviewHandler({ providerFactory = () => createOpenRouterProvider({ apiKey: openRouterApiKey.value(), config: aiConfig }) } = {}) {
  return async (request) => {
    if (!request.auth) {
      const error = toClientError(new AiError("ai_unauthenticated"));
      throw new HttpsError("unauthenticated", error.message, error);
    }
    const startedAt = Date.now();
    try {
      const result = await generateRobReview(request.data, { provider: providerFactory() });
      logger.info("Rob review completed", { operation: "rob_review", reviewType: result.review.reviewType, model: result.model, durationMs: Date.now() - startedAt, usage: result.usage, authenticatedUidPresent: true });
      return result;
    } catch (error) {
      const normalized = normalizeAiError(error);
      logger.warn("Rob review failed", { operation: "rob_review", reviewType: request.data?.context?.requestType ?? null, code: normalized.code, validation: normalized.validationDiagnostic ?? null, durationMs: Date.now() - startedAt, authenticatedUidPresent: true });
      throw new HttpsError(normalized.code === "ai_invalid_request" ? "invalid-argument" : "internal", normalized.message, toClientError(normalized));
    }
  };
}

export const robReview = onCall({ secrets: [openRouterApiKey], timeoutSeconds: 35 }, createRobReviewHandler());

export function createRobProposalHandler({ providerFactory = () => createOpenRouterProvider({ apiKey: openRouterApiKey.value(), config: aiConfig }) } = {}) {
  return async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", toClientError(new AiError("ai_unauthenticated")).message);
    const startedAt = Date.now();
    try {
      const result = await generateRobProposal(request.data, { provider: providerFactory() });
      logger.info("Rob proposal completed", { operation: "rob_proposal", proposalType: result.candidate.proposalType, model: result.model, usage: result.usage, durationMs: Date.now() - startedAt, candidateOperationCount: result.candidate.changes?.length ?? result.candidate.routine?.exercises?.length ?? 0, authenticatedUidPresent: true });
      return result;
    } catch (error) {
      const normalized = normalizeAiError(error);
      logger.warn("Rob proposal failed", { operation: "rob_proposal", proposalType: request.data?.request?.type ?? null, code: normalized.code, validation: normalized.validationDiagnostic ?? null, durationMs: Date.now() - startedAt, authenticatedUidPresent: true });
      throw new HttpsError(normalized.code === "ai_invalid_request" ? "invalid-argument" : "internal", normalized.message, toClientError(normalized));
    }
  };
}
export const robProposal = onCall({ secrets: [openRouterApiKey], timeoutSeconds: 35 }, createRobProposalHandler());
export function createRobProgramGenerationHandler({ providerFactory = () => createOpenRouterProvider({ apiKey: openRouterApiKey.value(), config: aiConfig }), config = aiConfig } = {}) {
  return async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", toClientError(new AiError("ai_unauthenticated")).message);
    const startedAt = Date.now();
    const requestedOutputTokens = config.programMaxOutputTokens;
    try {
      const result = await generateRobProgramCandidate(request.data, { provider: providerFactory(), maxOutputTokens: requestedOutputTokens });
      logger.info("Rob program generation completed", {
        operation: "rob_program_generation", failureCategory: null, requestedOutputTokens, ...result.diagnostics,
        durationMs: Date.now() - startedAt, authenticatedUidPresent: true,
      });
      return { model: result.model, usage: result.usage, explanation: result.explanation, candidate: result.candidate, catalogue: result.catalogue };
    } catch (error) {
      const normalized = normalizeAiError(error);
      const candidateValidation = error.programGenerationFailureCategory === "candidate_validation" && normalized.validationDiagnostic?.reason === "exercise" ? normalized.validationDiagnostic : null;
      logger.warn("Rob program generation failed", {
        operation: "rob_program_generation",
        failureCategory: error.programGenerationFailureCategory ?? (normalized.code === "ai_invalid_request" ? "request_validation" : "provider_or_transport"),
        requestedOutputTokens,
        actualModel: error.programGenerationDiagnostic?.actualModel ?? config.model,
        providerOutputTokens: error.programGenerationDiagnostic?.providerOutputTokens ?? null,
        providerFinishReason: error.programGenerationDiagnostic?.providerFinishReason ?? null,
        responseCharacterLength: error.programGenerationDiagnostic?.responseCharacterLength ?? null,
        candidateValidationFailureReason: normalized.validationDiagnostic?.reason ?? null,
        candidateValidationRoutineIndex: Number.isInteger(candidateValidation?.routineIndex) ? candidateValidation.routineIndex : null,
        candidateValidationExerciseIndex: Number.isInteger(candidateValidation?.exerciseIndex) ? candidateValidation.exerciseIndex : null,
        candidateValidationField: typeof candidateValidation?.field === "string" ? candidateValidation.field : null,
        candidateValidationFieldReason: typeof candidateValidation?.fieldReason === "string" ? candidateValidation.fieldReason : null,
        routineCount: error.programGenerationDiagnostic?.routineCount ?? null,
        durationMs: Date.now() - startedAt, authenticatedUidPresent: true,
      });
      throw new HttpsError(normalized.code === "ai_invalid_request" ? "invalid-argument" : "internal", normalized.message, toClientError(normalized));
    }
  };
}
export const robProgramGeneration = onCall({ secrets: [openRouterApiKey], timeoutSeconds: 35 }, createRobProgramGenerationHandler());
