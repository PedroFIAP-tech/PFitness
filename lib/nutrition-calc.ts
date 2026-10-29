// Metas diárias calculadas (determinístico, sem IA) e sugestão de ajuste pela
// tendência do peso. Sem imports do app: roda direto no `node --test`.

export type Sex = "masculino" | "feminino" | "outro";
export type Goal = "ganhar_massa" | "perder_gordura" | "manter";
export type ActivityLevel = "sedentaria" | "moderada" | "ativa";

/**
 * Fator de atividade = base da rotina fora da academia + 0,05 por treino na
 * semana, com teto de 1,9. Fica dentro das faixas clássicas (1,2 a 1,9):
 *
 *   rotina       base   3×/sem  5×/sem
 *   sedentária   1,20   1,35    1,45
 *   moderada     1,35   1,50    1,60
 *   ativa        1,50   1,65    1,75
 */
export const ACTIVITY_BASE: Record<ActivityLevel, number> = { sedentaria: 1.2, moderada: 1.35, ativa: 1.5 };
export const FACTOR_PER_WORKOUT = 0.05;
export const MAX_ACTIVITY_FACTOR = 1.9;

/** Ajuste de kcal por objetivo (configurável). */
export const GOAL_KCAL_ADJUSTMENT: Record<Goal, number> = {
  ganhar_massa: 300,
  perder_gordura: -400,
  manter: 0,
};

/** Proteína por kg de peso; mais alta no déficit para preservar massa magra. */
export const PROTEIN_G_PER_KG: Record<Goal, number> = { ganhar_massa: 2.0, perder_gordura: 2.2, manter: 2.0 };
export const FAT_G_PER_KG = 0.9;
export const MIN_CARBS_G = 50;
/** Piso de segurança das kcal. */
export const MIN_KCAL = 1200;
export const KCAL_ROUNDING = 50;

export const GOAL_LABEL: Record<Goal, string> = {
  ganhar_massa: "ganhar massa",
  perder_gordura: "perder gordura",
  manter: "manter",
};

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentaria: "rotina sedentária",
  moderada: "rotina moderada",
  ativa: "rotina ativa",
};

export type BodyData = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
};

export type GoalsInput = BodyData & {
  goal: Goal;
  activityLevel: ActivityLevel;
  workoutsPerWeek: number;
};

export type CalculatedGoals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Etapas do cálculo, para explicar na tela */
  bmr: number;
  factor: number;
  tdee: number;
  adjustment: number;
  explanation: string[];
};

const formatInt = (value: number) => new Intl.NumberFormat("pt-BR").format(Math.round(value));
const formatDecimal = (value: number, digits: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/** Idade em anos completos numa data (YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * Taxa metabólica basal por Mifflin-St Jeor:
 * 10·kg + 6,25·cm − 5·idade + 5 (homens) ou − 161 (mulheres).
 * Para "outro", a média das duas constantes (−78).
 */
export function bmr({ sex, weightKg, heightCm, age }: BodyData): number {
  const constant = sex === "masculino" ? 5 : sex === "feminino" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + constant;
}

export function activityFactor(level: ActivityLevel, workoutsPerWeek: number): number {
  const workouts = Math.min(7, Math.max(0, Math.round(workoutsPerWeek)));
  const factor = Math.min(MAX_ACTIVITY_FACTOR, ACTIVITY_BASE[level] + workouts * FACTOR_PER_WORKOUT);
  return Math.round(factor * 100) / 100;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** kcal e macros do dia para os dados do usuário. */
export function calculateGoals(input: GoalsInput): CalculatedGoals {
  const base = bmr(input);
  const factor = activityFactor(input.activityLevel, input.workoutsPerWeek);
  const tdee = base * factor;
  const adjustment = GOAL_KCAL_ADJUSTMENT[input.goal];
  const kcal = Math.max(MIN_KCAL, roundTo(tdee + adjustment, KCAL_ROUNDING));

  const proteinPerKg = PROTEIN_G_PER_KG[input.goal];
  const protein = Math.round(proteinPerKg * input.weightKg);
  const fat = Math.round(FAT_G_PER_KG * input.weightKg);
  const carbs = Math.max(MIN_CARBS_G, Math.round((kcal - protein * 4 - fat * 9) / 4));

  const adjustmentLine =
    adjustment === 0
      ? `Sem ajuste para ${GOAL_LABEL[input.goal]} → ${formatInt(kcal)} kcal`
      : `${adjustment > 0 ? "+" : "−"}${formatInt(Math.abs(adjustment))} kcal para ${GOAL_LABEL[input.goal]} → ${formatInt(kcal)} kcal`;

  return {
    kcal,
    protein,
    carbs,
    fat,
    bmr: Math.round(base),
    factor,
    tdee: Math.round(tdee),
    adjustment,
    explanation: [
      `Metabolismo basal (Mifflin-St Jeor): ${formatInt(base)} kcal`,
      `× ${formatDecimal(factor, 2)} de atividade (${ACTIVITY_LABEL[input.activityLevel]} + ${input.workoutsPerWeek} ${input.workoutsPerWeek === 1 ? "treino" : "treinos"}/semana) = ${formatInt(tdee)} kcal`,
      adjustmentLine,
      `Proteína ${formatDecimal(proteinPerKg, 1)} g/kg · gordura ${formatDecimal(FAT_G_PER_KG, 1)} g/kg · carbo com o restante`,
    ],
  };
}

// ---------------------------------------------------------------------
// Meta adaptativa
// ---------------------------------------------------------------------

export const ADAPTIVE = {
  /** Janela olhada (dias) */
  windowDays: 21,
  /** Mínimo de pesagens e de dias entre a primeira e a última */
  minPoints: 4,
  minSpanDays: 14,
  /** Pesagem que difere mais que isso das vizinhas é tratada como erro de digitação */
  outlierKg: 3,
  /** Diferença aceitável entre a tendência e o esperado */
  toleranceKgPerWeek: 0.15,
  gainKgPerWeek: 0.25,
  /** Perda esperada: 0,5% do peso por semana */
  loseFractionPerWeek: 0.005,
  /** ~7.700 kcal por kg de massa corporal */
  kcalPerKg: 7700,
  minAdjust: 100,
  maxAdjust: 200,
} as const;

export type WeightPoint = { day: string; kg: number };

export type GoalSuggestion = {
  /** +150, −100… (múltiplo de 50, entre 100 e 200 em módulo) */
  adjustKcal: number;
  newKcal: number;
  actualKgPerWeek: number;
  expectedKgPerWeek: number;
};

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/**
 * Descarta pesagens que diferem mais de `outlierKg` de todas as vizinhas
 * (anterior e seguinte). Um valor digitado errado no meio da série some; os
 * vizinhos dele continuam porque concordam com o outro lado.
 */
export function dropWeightOutliers(points: WeightPoint[], outlierKg: number = ADAPTIVE.outlierKg): WeightPoint[] {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length < 2) return sorted;
  return sorted.filter((point, index) => {
    const neighbors = [sorted[index - 1], sorted[index + 1]].filter(Boolean);
    return neighbors.some((neighbor) => Math.abs(neighbor.kg - point.kg) <= outlierKg);
  });
}

/**
 * Reta de mínimos quadrados dos pesos pelo dia: kg = intercept + slope·(dia − primeiro dia).
 * É a regressão da meta adaptativa e da linha de tendência do Progresso.
 */
export function weightRegression(points: WeightPoint[]): { slopePerDay: number; intercept: number; firstDay: string } | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const origin = dayNumber(sorted[0].day);
  const xs = sorted.map((point) => dayNumber(point.day) - origin);
  const ys = sorted.map((point) => point.kg);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < xs.length; i++) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  const slopePerDay = denominator === 0 ? 0 : numerator / denominator;
  return { slopePerDay, intercept: meanY - slopePerDay * meanX, firstDay: sorted[0].day };
}

/** Inclinação por mínimos quadrados, em kg por semana. */
export function weightTrendKgPerWeek(points: WeightPoint[]): number {
  return (weightRegression(points)?.slopePerDay ?? 0) * 7;
}

/**
 * Compara a tendência do peso nas últimas 3 semanas com o esperado pelo
 * objetivo e sugere ±100–200 kcal. null sem dados suficientes ou dentro da
 * tolerância.
 */
export function suggestGoalAdjustment({
  weights,
  goal,
  currentKcal,
  today,
}: {
  weights: WeightPoint[];
  goal: Goal;
  currentKcal: number;
  today: string;
}): GoalSuggestion | null {
  const since = dayNumber(today) - ADAPTIVE.windowDays;
  const recent = dropWeightOutliers(weights.filter((point) => dayNumber(point.day) > since));
  if (recent.length < ADAPTIVE.minPoints) return null;
  if (dayNumber(recent.at(-1)!.day) - dayNumber(recent[0].day) < ADAPTIVE.minSpanDays) return null;

  const actual = weightTrendKgPerWeek(recent);
  const expected =
    goal === "ganhar_massa"
      ? ADAPTIVE.gainKgPerWeek
      : goal === "perder_gordura"
        ? -ADAPTIVE.loseFractionPerWeek * recent.at(-1)!.kg
        : 0;
  const diff = expected - actual;
  if (Math.abs(diff) <= ADAPTIVE.toleranceKgPerWeek) return null;

  const raw = (Math.abs(diff) * ADAPTIVE.kcalPerKg) / 7;
  const magnitude = Math.min(ADAPTIVE.maxAdjust, Math.max(ADAPTIVE.minAdjust, roundTo(raw, KCAL_ROUNDING)));
  const adjustKcal = Math.sign(diff) * magnitude;

  return {
    adjustKcal,
    newKcal: Math.max(MIN_KCAL, currentKcal + adjustKcal),
    actualKgPerWeek: Math.round(actual * 100) / 100,
    expectedKgPerWeek: Math.round(expected * 100) / 100,
  };
}

/** Macros para um novo total de kcal mantendo proteína e gordura (carbo absorve a diferença). */
export function rebalanceCarbs(goals: { kcal: number; protein: number; fat: number }): number {
  return Math.max(MIN_CARBS_G, Math.round((goals.kcal - goals.protein * 4 - goals.fat * 9) / 4));
}
