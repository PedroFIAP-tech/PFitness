/** Limites da ficha, alinhados aos checks de plan_exercises no banco. */
export const PLAN_LIMITS = {
  titleMaxLength: 40,
  maxExercises: 30,
  maxRestSeconds: 600,
  notesMaxLength: 200,
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
} as const;

/** Valores de um exercício recém-adicionado (protótipo: 3×12, 90 s de descanso). */
export const NEW_EXERCISE_DEFAULTS = {
  targetSets: 3,
  targetReps: 12,
  restSeconds: 90,
} as const;

/** Dias da semana na ordem de Date.getDay (0 = domingo), como em workout_plans.weekday. */
export const WEEKDAYS = [
  { initial: "D", short: "DOM", name: "Domingo" },
  { initial: "S", short: "SEG", name: "Segunda" },
  { initial: "T", short: "TER", name: "Terça" },
  { initial: "Q", short: "QUA", name: "Quarta" },
  { initial: "Q", short: "QUI", name: "Quinta" },
  { initial: "S", short: "SEX", name: "Sexta" },
  { initial: "S", short: "SÁB", name: "Sábado" },
] as const;

/** Estimativa do protótipo: ~2,6 min por série, já contando o descanso. */
export function estimatePlanMinutes(totalSets: number) {
  return Math.round(totalSets * 2.6);
}
