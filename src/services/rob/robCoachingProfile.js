export const emptyRobCoachingProfile = () => ({
  version: 1,
  goals: [], equipment: [], constraints: [], likes: [], dislikes: [],
  trainingStyle: { setting: null, targetSessionMinutes: null, daysPerWeek: null },
  progression: { method: null, rule: null },
});

export function robCoachingProfileDocumentSegments(uid) {
  if (typeof uid !== "string" || !uid.trim() || uid.includes("/")) throw new Error("invalid_profile_owner");
  return ["users", uid, "appState", "robCoaching"];
}

const limitedText = (value, max) => typeof value === "string" ? value.trim().slice(0, max) || null : null;
const list = (value) => Array.isArray(value) ? [...new Set(value.map((item) => limitedText(item, 100)).filter(Boolean))].slice(0, 6) : [];
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : null;

export function normalizeRobCoachingProfile(value) {
  const empty = emptyRobCoachingProfile();
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) return empty;
  return {
    version: 1,
    goals: list(value.goals), equipment: list(value.equipment), constraints: list(value.constraints),
    likes: list(value.likes), dislikes: list(value.dislikes),
    trainingStyle: {
      setting: limitedText(value.trainingStyle?.setting, 100),
      targetSessionMinutes: integer(value.trainingStyle?.targetSessionMinutes, 20, 180),
      daysPerWeek: integer(value.trainingStyle?.daysPerWeek, 1, 7),
    },
    progression: {
      method: ["double_progression", "other"].includes(value.progression?.method) ? value.progression.method : null,
      rule: limitedText(value.progression?.rule, 240),
    },
  };
}

export function parseRobProfileList(value) {
  return list(typeof value === "string" ? value.split(",") : []);
}
