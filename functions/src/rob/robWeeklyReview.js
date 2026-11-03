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
  if (context.selfReport !== undefined && context.selfReport !== null) {
    if (typeof context.selfReport !== "object" || Array.isArray(context.selfReport) ||
        ![null, "good", "okay", "tough"].includes(context.selfReport.feeling) ||
        typeof context.selfReport.note !== "string" || context.selfReport.note.length > 400) invalid();
  }
  let encoded;
  try { encoded = JSON.stringify(context); } catch { invalid(); }
  if (!encoded || encoded.length > ROB_WEEKLY_CONTEXT_MAX_CHARS) invalid();
  return context;
}

export function composeRobWeeklyReviewMessages(context) {
  return [
    { role: "system", content: `You are Rob, a knowledgeable and personable strength and activity coach. In about 100–150 words for a normal week, give one cohesive assessment of the fully completed Monday–Sunday week and the preceding week. Lead with an overall coaching judgment, consider all available completed strength training, logged running, recorded steps and optional self-reported feeling or context, and finish with a useful next action only when the evidence warrants one. Recognise genuine consistency and completed known intentions; maintaining the current approach is often a sound next action. Be constructive about deviations without blind praise. Never infer seven planned sessions from seven days of recorded activity. Frame justified adjustments as options rather than automatic plan changes. Treat self-report as context, not medical evidence. For persistent or worsening pain, recommend medical assessment without diagnosing or assuring safety. Use natural trainer language rather than a report. A short answer must still acknowledge material missing evidence.

Use the account's recorded coaching profile only where populated; blank preferences are unknown. Understand double progression as one possible method: build reps within a prescribed range, then increase load according to the athlete's own recorded rule, often with reps returning near the lower end. If double progression is explicitly recorded, a heavier set with fewer reps may be a deliberate reset; do not call it regression without evidence. Without a recorded rule or historical rep-range evidence, say the reset is possible, not confirmed. Do not assume this method for other users. A confirmed program-design brief governs that specific program request; this weekly review does not change it.

Treat top-set comparisons as conservative. Consider repetitions, loads, working sets, and frequency; do not compare missing or different load units. Acknowledge incomplete sets, dates, or omitted details when material. Run distance totals are observed logged totals, not proof of all activity; pace needs both distance and duration. Qualify incomplete distance comparisons. Step averages are for recorded days; zero is recorded, null is missing. Compare weekly step totals only with seven recorded days in both weeks. Do not call unlogged days inactive. Do not infer unreported fatigue, recovery, pain, effort, technique, or a causal link between running and lifting. Never claim to have changed Fitbot data or give medical assurance.` },
    { role: "user", content: `WEEKLY ACTIVITY EVIDENCE:\n${JSON.stringify(context)}\n\nReview my selected training week and its preceding week.` },
  ];
}

export async function generateRobWeeklyReview(data, { provider }) {
  const context = validateRobWeeklyReviewRequest(data);
  return provider.generate({ messages: composeRobWeeklyReviewMessages(context) });
}
