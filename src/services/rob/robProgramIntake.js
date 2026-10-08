export const ROB_PROGRAM_INTAKE_VERSION = 1;
export const ROB_PROGRAM_INTAKE_STEPS = Object.freeze(["goal", "days", "duration", "priorities", "equipment", "constraints", "summary"]);
export const ROB_PROGRAM_GOALS = Object.freeze(["hypertrophy", "strength", "general_fitness", "hypertrophy_strength", "other"]);
export const ROB_PROGRAM_PRIORITIES = Object.freeze(["shoulders", "arms", "chest", "back", "legs", "glutes", "core", "balanced"]);
export const ROB_PROGRAM_ENVIRONMENTS = Object.freeze(["commercial_gym", "home_gym", "both", "minimal_equipment", "other"]);
export const ROB_PROGRAM_EQUIPMENT = Object.freeze(["machines", "dumbbells", "barbell", "cables", "bench", "pull_up_equipment"]);

const text = (value) => typeof value === "string" ? value : "";
const normalizedText = (value) => text(value).trim();
const validList = (items, supported, limit) => Array.isArray(items) && items.length <= limit && items.every((item) => supported.includes(item)) && new Set(items).size === items.length;

export function createRobProgramIntake() {
  return { version: ROB_PROGRAM_INTAKE_VERSION, goal: null, goalDescription: "", daysPerWeek: null, sessionMinutes: null, priorities: [], priorityNote: "", environment: null, equipment: [], equipmentOther: "", equipmentConfirmed: false, constraints: "", constraintsConfirmed: false, confirmedRequirements: null };
}

export function updateRobProgramIntake(intake, updates) {
  const updatedIntake = { ...createRobProgramIntake(), ...intake, ...updates, confirmedRequirements: null };
  if (Object.hasOwn(updates, "constraints") && updates.constraints !== intake.constraints) updatedIntake.constraintsConfirmed = false;
  return updatedIntake;
}

export function validateRobProgramIntake(intake) {
  const errors = {};
  if (!intake || intake.version !== ROB_PROGRAM_INTAKE_VERSION) return { valid: false, errors: { intake: "This program brief is not supported." } };
  if (!ROB_PROGRAM_GOALS.includes(intake.goal)) errors.goal = "Choose your main training goal.";
  if (intake.goal === "other" && (!normalizedText(intake.goalDescription) || text(intake.goalDescription).length > 160)) errors.goalDescription = "Describe your goal in 160 characters or fewer.";
  if (!Number.isInteger(intake.daysPerWeek) || intake.daysPerWeek < 1 || intake.daysPerWeek > 6) errors.days = "Choose one to six training days per week.";
  if (!Number.isInteger(intake.sessionMinutes) || intake.sessionMinutes < 20 || intake.sessionMinutes > 180) errors.duration = "Choose a session duration from 20 to 180 minutes.";
  if (!validList(intake.priorities, ROB_PROGRAM_PRIORITIES, 6)) errors.priorities = "Choose up to six supported priorities.";
  if (text(intake.priorityNote).length > 240) errors.priorityNote = "Keep this note to 240 characters or fewer.";
  if (!ROB_PROGRAM_ENVIRONMENTS.includes(intake.environment)) errors.environment = "Choose your training environment.";
  if (!validList(intake.equipment, ROB_PROGRAM_EQUIPMENT, 8)) errors.equipment = "Choose supported equipment options.";
  if (text(intake.equipmentOther).length > 160) errors.equipmentOther = "Keep equipment details to 160 characters or fewer.";
  if (!intake.equipmentConfirmed) errors.equipmentConfirmed = "Confirm the equipment you can use.";
  if (text(intake.constraints).length > 360) errors.constraints = "Keep constraints to 360 characters or fewer.";
  if (!intake.constraintsConfirmed) errors.constraintsConfirmed = "Confirm your constraints or choose no additional constraints.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function getNextRobProgramIntakeStep(intake) {
  const validation = validateRobProgramIntake(intake);
  if (validation.errors.goal || validation.errors.goalDescription) return "goal";
  if (validation.errors.days) return "days";
  if (validation.errors.duration) return "duration";
  if (validation.errors.priorities || validation.errors.priorityNote) return "priorities";
  if (validation.errors.environment || validation.errors.equipment || validation.errors.equipmentOther || validation.errors.equipmentConfirmed) return "equipment";
  if (validation.errors.constraints || validation.errors.constraintsConfirmed) return "constraints";
  return "summary";
}

export function confirmRobProgramIntake(intake) {
  const normalizedIntake = { ...intake, goalDescription: normalizedText(intake?.goalDescription), priorityNote: normalizedText(intake?.priorityNote), equipmentOther: normalizedText(intake?.equipmentOther), constraints: normalizedText(intake?.constraints) };
  const validation = validateRobProgramIntake(normalizedIntake);
  if (!validation.valid) return { confirmed: false, errors: validation.errors, intake: updateRobProgramIntake(intake, {}) };
  const requirements = { version: ROB_PROGRAM_INTAKE_VERSION, goal: normalizedIntake.goal, ...(normalizedIntake.goalDescription ? { goalDescription: normalizedIntake.goalDescription } : {}), daysPerWeek: normalizedIntake.daysPerWeek, sessionMinutes: normalizedIntake.sessionMinutes, priorities: [...normalizedIntake.priorities], ...(normalizedIntake.priorityNote ? { priorityNote: normalizedIntake.priorityNote } : {}), environment: normalizedIntake.environment, equipment: [...normalizedIntake.equipment], ...(normalizedIntake.equipmentOther ? { equipmentOther: normalizedIntake.equipmentOther } : {}), constraints: normalizedIntake.constraints };
  const confirmedRequirements = { ...requirements, priorities: [...requirements.priorities], equipment: [...requirements.equipment] };
  return { confirmed: true, errors: {}, intake: { ...updateRobProgramIntake(intake, {}), confirmedRequirements }, requirements };
}
