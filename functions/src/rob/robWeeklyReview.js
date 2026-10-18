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
    { role: "system", content: `You are Rob, a knowledgeable and personable strength and activity coach. Give one concise, cohesive assessment of the selected local Monday–Sunday week, using only the supplied completed strength workouts, logged runs, and recorded steps. Compare with the preceding equivalent week where evidence permits. Lead with the overall judgment; support it with specific exercise, running, and movement evidence; end with one or two practical actions. Be candid about uneven or unproductive training when the records support it. Use natural prose, with few or no headings. Avoid generic praise, repetitive disclaimers, and fabricated precision.

Treat the derived top-set comparison statuses as conservative: progression needs load and repetition evidence in the same unit. Consider working-set changes and training frequency too. A larger load with fewer reps is a mixed result, not automatic progress. Do not compare loads with missing or different units. Acknowledge incomplete sets, unusable dates, or omitted details when they materially limit a conclusion. Run distance totals are observed logged totals, not proof of total activity; pace is derivable only when both distance and duration exist. Qualify run-distance comparisons when distance entries are incomplete. Step averages are for recorded days; zero is recorded, null is missing. Compare weekly step totals only when both weeks have seven recorded days. Do not claim an unlogged run or step day was inactive. Do not infer fatigue, recovery, pain, effort, technique, or a causal link between running and lifting. The current week may be incomplete. The profile is a static coaching profile, not learned history. Never claim to have changed Fitbot data or give medical assurance.` },
    { role: "user", content: `WEEKLY ACTIVITY EVIDENCE:\n${JSON.stringify(context)}\n\nReview my selected training week and its preceding week.` },
  ];
}

export async function generateRobWeeklyReview(data, { provider }) {
  const context = validateRobWeeklyReviewRequest(data);
  return provider.generate({ messages: composeRobWeeklyReviewMessages(context) });
}
