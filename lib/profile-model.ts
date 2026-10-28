import type { ActivityLevel, Goal, Sex } from "@/lib/nutrition-calc";

// Opções do onboarding e do Perfil (servidor e cliente)

export const SEX_OPTIONS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
] as const satisfies readonly { value: Sex; label: string }[];

export const GOAL_OPTIONS = [
  { value: "ganhar_massa", label: "Ganhar massa", short: "Massa", hint: "Superávit leve para ganhar músculo." },
  { value: "perder_gordura", label: "Perder gordura", short: "Perder", hint: "Déficit moderado, proteína alta." },
  { value: "manter", label: "Manter", short: "Manter", hint: "Comer o que gasta e evoluir nos treinos." },
] as const satisfies readonly { value: Goal; label: string; short: string; hint: string }[];

export const ACTIVITY_OPTIONS = [
  { value: "sedentaria", label: "Sedentária", example: "Trabalho sentado, pouco deslocamento a pé." },
  { value: "moderada", label: "Moderada", example: "Em pé boa parte do dia ou caminho bastante." },
  { value: "ativa", label: "Ativa", example: "Trabalho físico, muito movimento o dia todo." },
] as const satisfies readonly { value: ActivityLevel; label: string; example: string }[];

export const RESTRICTION_OPTIONS = [
  { value: "vegetariano", label: "Vegetariano" },
  { value: "sem_lactose", label: "Sem lactose" },
  { value: "sem_gluten", label: "Sem glúten" },
] as const;

export type Restriction = (typeof RESTRICTION_OPTIONS)[number]["value"];

export const BODY_LIMITS = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 250 },
  /** Idade aceita no onboarding (save_onboarding) */
  age: { min: 13, max: 100 },
} as const;

export const MEALS_PER_DAY = { min: 3, max: 6 } as const;

/** Limites das metas editáveis (set_daily_goals). */
export const GOAL_LIMITS = {
  kcal: { min: 800, max: 6000, step: 50 },
  protein: { min: 0, max: 600, step: 5 },
  carbs: { min: 0, max: 1000, step: 5 },
  fat: { min: 0, max: 400, step: 5 },
} as const;

export type GoalsSource = "padrao" | "calculado" | "personalizado";

export const GOALS_SOURCE_LABEL: Record<GoalsSource, string> = {
  padrao: "padrão",
  calculado: "calculado",
  personalizado: "personalizado",
};

/** kcal que os macros somam (4/4/9). */
export function macroKcal({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  return protein * 4 + carbs * 4 + fat * 9;
}

/** IMC com 1 casa. */
export function bmi(weightKg: number, heightCm: number) {
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export const isGoal = (value: unknown): value is Goal => GOAL_OPTIONS.some((option) => option.value === value);
export const isSex = (value: unknown): value is Sex => SEX_OPTIONS.some((option) => option.value === value);
export const isActivityLevel = (value: unknown): value is ActivityLevel =>
  ACTIVITY_OPTIONS.some((option) => option.value === value);
