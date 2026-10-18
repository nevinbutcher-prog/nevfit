import { AiError } from "../ai/aiErrors.js";

export const ROB_WEEKLY_CONTEXT_MAX_CHARS = 22000;
export const ROB_WEEKLY_MODEL = process.env.ROB_WEEKLY_REVIEW_MODEL || null;

const invalid = () => { throw new AiError("ai_invalid_request"); };

export function validateRobWeeklyReviewRequest(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 1 || !data.context) invalid();
  const context = data.context;
  if (typeof context !== "object" || Array.isArray(context) || context.version !== 1 || context.requestType !== "weekly_review" || context.calendar !== "device_local_monday_sunday") invalid();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(context.selectedDate ?? "")) invalid();
  if (!context.current?.start || !context.current?.end || !context.preceding?.start || !context.preceding?.end || !context.comparison || !context.evidenceLimits) invalid();
  if (!Array.isArray(context.current.strength?.exercises) || !Array.isArray(context.preceding.strength?.exercises) ||
      !Array.isArray(context.current.runs?.runs) || !Array.isArray(context.preceding.runs?.runs) ||
      !Array.isArray(context.current.steps?.days) || !Array.isArray(context.preceding.steps?.days)) invalid();
  let encoded;
  try { encoded = JSON.stringify(context); } catch { invalid(); }
  if (!encoded || encoded.length > ROB_WEEKLY_CONTEXT_MAX_CHARS) invalid();
  return context;
}

export function composeRobWeeklyReviewMessages(context) {
  return [
    { role: "system", content: `You are Rob, a knowledgeable and personable strength and activity coach. In about 100–150 words for a normal week, give one cohesive assessment of the current local Monday–Sunday week and the preceding week. Lead with an overall coaching judgment, make two or three meaningful observations across completed strength training, logged running, and recorded steps, and finish with one or two specific next actions. Use natural trainer language rather than a report. Do not praise increased volume automatically, recite every statistic, or add generic encouragement. A short answer must still acknowledge material missing evidence.

Use the account's recorded coaching profile only where populated; blank preferences are unknown. Understand double progression as one possible method: build reps within a prescribed range, then increase load according to the athlete's own recorded rule, often with reps returning near the lower end. If double progression is explicitly recorded, a heavier set with fewer reps may be a deliberate reset; do not call it regression without evidence. Without a recorded rule or historical rep-range evidence, say the reset is possible, not confirmed. Do not assume this method for other users. A confirmed program-design brief governs that specific program request; this weekly review does not change it.

Treat top-set comparisons as conservative. Consider repetitions, loads, working sets, and frequency; do not compare missing or different load units. Acknowledge incomplete sets, dates, or omitted details when material. Run distance totals are observed logged totals, not proof of all activity; pace needs both distance and duration. Qualify incomplete distance comparisons. Step averages are for recorded days; zero is recorded, null is missing. Compare weekly step totals only with seven recorded days in both weeks. Do not call unlogged days inactive. The current week may be incomplete. Do not infer fatigue, recovery, pain, effort, technique, or a causal link between running and lifting. Never claim to have changed Fitbot data or give medical assurance.` },
    { role: "user", content: `WEEKLY ACTIVITY EVIDENCE:\n${JSON.stringify(context)}\n\nReview my selected training week and its preceding week.` },
  ];
}

export async function generateRobWeeklyReview(data, { provider }) {
  const context = validateRobWeeklyReviewRequest(data);
  return provider.generate({ messages: composeRobWeeklyReviewMessages(context) });
}
