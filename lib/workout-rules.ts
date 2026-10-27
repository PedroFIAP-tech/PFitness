/** Limites da ficha, alinhados aos checks de plan_exercises no banco. */
export const PLAN_LIMITS = {
  titleMaxLength: 40,
  maxExercises: 30,
  maxRestSeconds: 600,
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
} as const;

/** Valores de um exercício recém-adicionado (protótipo: 3×12, 90 s de descanso). */
export const NEW_EXERCISE_DEFAULTS = {
  targetSets: 3,
  targetReps: 12,
  restSeconds: 90,
} as const;

/** Estimativa do protótipo: ~2,6 min por série, já contando o descanso. */
export function estimatePlanMinutes(totalSets: number) {
  return Math.round(totalSets * 2.6);
}
