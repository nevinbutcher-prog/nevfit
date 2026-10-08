const parseBoundedInt = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

export const aiConfig = Object.freeze({
  provider: "openrouter",
  model: process.env.AI_MODEL || "openai/gpt-4o-mini",
  maxOutputTokens: parseBoundedInt(process.env.AI_MAX_OUTPUT_TOKENS, 1200, 100, 2000),
  // Whole-program candidates contain several routines. Keep this separate from
  // the short-response ceiling used by advice and single-routine generation.
  programMaxOutputTokens: parseBoundedInt(process.env.AI_PROGRAM_MAX_OUTPUT_TOKENS, 4000, 1000, 5000),
  timeoutMs: parseBoundedInt(process.env.AI_TIMEOUT_MS, 25000, 5000, 30000),
});

export const aiInputLimits = Object.freeze({
  maxMessages: 8,
  maxMessageChars: 4000,
  maxTotalChars: 12000,
});
