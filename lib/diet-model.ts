import { dayToDate, formatTimeOfDay, shiftDay } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import type { Enums } from "@/types/database";

// Regras do diário alimentar, usadas no servidor e no cliente

export type MealType = Enums<"meal_type">;

export const MEALS: { id: MealType; name: string }[] = [
  { id: "cafe", name: "Café da manhã" },
  { id: "lanche_manha", name: "Lanche da manhã" },
  { id: "almoco", name: "Almoço" },
  { id: "lanche", name: "Lanche" },
  { id: "jantar", name: "Jantar" },
  { id: "ceia", name: "Ceia" },
];

export const MEAL_NAMES = Object.fromEntries(MEALS.map((meal) => [meal.id, meal.name])) as Record<
  MealType,
  string
>;

/** Preposição antes do nome da refeição: "adicionado ao almoço", "à ceia". */
export const MEAL_PREPOSITION: Record<MealType, string> = {
  cafe: "ao",
  lanche_manha: "ao",
  almoco: "ao",
  lanche: "ao",
  jantar: "ao",
  ceia: "à",
};

/** Uma refeição do plano do usuário (profiles.meal_plan), com horário aproximado "HH:MM". */
export type MealPlanEntry = { meal: MealType; time: string };

/** Horário sugerido de cada refeição no onboarding. */
export const DEFAULT_MEAL_TIMES: Record<MealType, string> = {
  cafe: "07:00",
  lanche_manha: "10:00",
  almoco: "12:30",
  lanche: "16:00",
  jantar: "19:30",
  ceia: "22:00",
};

/** Plano de quem ainda não escolheu as refeições. */
export const DEFAULT_MEAL_PLAN: MealPlanEntry[] = (["cafe", "almoco", "lanche", "jantar"] as const).map((meal) => ({
  meal,
  time: DEFAULT_MEAL_TIMES[meal],
}));

/** Peso de cada refeição na divisão da meta do dia: as principais pesam mais. */
export const MEAL_WEIGHTS: Record<MealType, number> = {
  cafe: 2,
  lanche_manha: 1,
  almoco: 3,
  lanche: 1,
  jantar: 3,
  ceia: 1,
};

/** Lê profiles.meal_plan; null se estiver vazio ou fora do formato. */
export function parseMealPlan(value: unknown): MealPlanEntry[] | null {
  if (!Array.isArray(value)) return null;
  const plan = value.flatMap((entry): MealPlanEntry[] =>
    entry &&
    typeof entry === "object" &&
    typeof entry.meal === "string" &&
    entry.meal in MEAL_NAMES &&
    typeof entry.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)
      ? [{ meal: entry.meal as MealType, time: entry.time }]
      : [],
  );
  return plan.length > 0 ? plan : null;
}

/** Meta de cada refeição do plano: a meta do dia dividida pelos pesos. */
export function mealGoals(plan: MealPlanEntry[], goals: Nutrients): Map<MealType, Nutrients> {
  const total = plan.reduce((sum, entry) => sum + MEAL_WEIGHTS[entry.meal], 0);
  return new Map(
    plan.map((entry) => {
      const share = MEAL_WEIGHTS[entry.meal] / total;
      return [
        entry.meal,
        {
          kcal: Math.round((goals.kcal * share) / 10) * 10,
          protein: Math.round(goals.protein * share),
          carbs: Math.round(goals.carbs * share),
          fat: Math.round(goals.fat * share),
        },
      ];
    }),
  );
}

/** Pontos de cada alimento registrado (log_food no banco). */
export const FOOD_POINTS = 5;

/** Roleta de gramas. O banco aceita de 1 a 2000. */
export const GRAMS = { min: 10, max: 1000, step: 10 } as const;

export const GRAM_PRESETS = [50, 100, 150, 200, 300] as const;

/** Limites do "Criar alimento", por 100 g. */
export const NEW_FOOD_LIMITS = {
  nameMaxLength: 60,
  kcalMax: 900,
  macroMax: 100,
} as const;

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };

export type Food = {
  id: number;
  name: string;
  /** Valores por 100 g */
  per100: Nutrients;
  defaultGrams: number;
  /** Criado pelo usuário */
  own: boolean;
};

export type DiaryItem = {
  id: number;
  foodId: number;
  name: string;
  meal: MealType;
  grams: number;
  /** ISO */
  loggedAt: string;
  nutrients: Nutrients;
};

export type MealGroup = {
  meal: MealType;
  name: string;
  /** Horário do primeiro registro ("07:40"), null sem itens */
  time: string | null;
  /** Horário aproximado do plano, null para refeição fora dele */
  plannedTime: string | null;
  items: DiaryItem[];
  totals: Nutrients;
  /** Meta desta refeição, null para refeição fora do plano */
  goal: Nutrients | null;
};

const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Porção de um alimento, arredondada a 1 casa como v_food_log_detail. */
export function portion(per100: Nutrients, grams: number): Nutrients {
  const scale = (value: number) => Math.round((value * grams) / 10) / 10;
  return {
    kcal: scale(per100.kcal),
    protein: scale(per100.protein),
    carbs: scale(per100.carbs),
    fat: scale(per100.fat),
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    ZERO,
  );
}

/**
 * Alimento de um registro, buscado no catálogo. Se não estiver lá, refaz os
 * valores por 100 g a partir da porção registrada.
 */
export function foodOfItem(item: DiaryItem, foods: Food[]): Food {
  const found = foods.find((food) => food.id === item.foodId);
  if (found) return found;
  const per100 = (value: number) => (item.grams > 0 ? (value * 100) / item.grams : 0);
  return {
    id: item.foodId,
    name: item.name,
    per100: {
      kcal: per100(item.nutrients.kcal),
      protein: per100(item.nutrients.protein),
      carbs: per100(item.nutrients.carbs),
      fat: per100(item.nutrients.fat),
    },
    defaultGrams: item.grams,
    own: false,
  };
}

/**
 * As refeições do plano, na ordem do usuário e com a meta de cada uma. Uma
 * refeição fora do plano que tenha item no dia aparece no fim, para nada sumir.
 */
export function groupByMeal(items: DiaryItem[], plan: MealPlanEntry[], goals: Nutrients): MealGroup[] {
  const goalsByMeal = mealGoals(plan, goals);
  const planned = new Map(plan.map((entry) => [entry.meal, entry.time]));
  const extras = MEALS.filter(({ id }) => !planned.has(id) && items.some((item) => item.meal === id)).map(({ id }) => id);

  return [...plan.map((entry) => entry.meal), ...extras].map((meal) => {
    const mealItems = items.filter((item) => item.meal === meal);
    const first = mealItems.reduce<string | null>(
      (earliest, item) => (earliest === null || item.loggedAt < earliest ? item.loggedAt : earliest),
      null,
    );
    return {
      meal,
      name: MEAL_NAMES[meal],
      time: first ? formatTimeOfDay(new Date(first)) : null,
      plannedTime: planned.get(meal) ?? null,
      items: mealItems,
      totals: sumNutrients(mealItems.map((item) => item.nutrients)),
      goal: goalsByMeal.get(meal) ?? null,
    };
  });
}

/** Só hoje e ontem aceitam mudanças (mesma regra de food_day_is_open no banco). */
export function isDayOpen(day: string, today: string): boolean {
  return day === today || day === shiftDay(today, -1);
}

/** "faltam 42 g" ou "12 g acima". */
export function macroStatus(consumed: number, goal: number): string {
  const diff = Math.round(goal - consumed);
  return diff >= 0 ? `faltam ${formatNumber(diff)} g` : `${formatNumber(-diff)} g acima`;
}

/** "P 19 · C 1 · G 14" */
export function formatMacros({ protein, carbs, fat }: Nutrients, maxDecimals = 0): string {
  const value = (n: number) => formatNumber(n, maxDecimals);
  return `P ${value(protein)} · C ${value(carbs)} · G ${value(fat)}`;
}

/** Rótulo relativo do dia: "Hoje", "Ontem", "Há 3 dias". */
export function relativeDayLabel(day: string, today: string): string {
  const days = Math.round((dayToDate(today).getTime() - dayToDate(day).getTime()) / 86_400_000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

export type NewFoodValues = { name: string } & Nutrients;

/** Primeiro problema do "Criar alimento" (valores por 100 g), ou null se está tudo certo. */
export function newFoodProblem({ name, kcal, protein, carbs, fat }: NewFoodValues): string | null {
  const trimmed = typeof name === "string" ? name.trim() : "";
  const inRange = (value: unknown, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;

  if (!trimmed) return "Dê um nome ao alimento.";
  if (trimmed.length > NEW_FOOD_LIMITS.nameMaxLength) {
    return `O nome pode ter até ${NEW_FOOD_LIMITS.nameMaxLength} caracteres.`;
  }
  if (!inRange(kcal, NEW_FOOD_LIMITS.kcalMax)) return `As kcal vão de 0 a ${NEW_FOOD_LIMITS.kcalMax} por 100 g.`;
  if (![protein, carbs, fat].every((value) => inRange(value, NEW_FOOD_LIMITS.macroMax))) {
    return "Proteína, carbo e gordura vão de 0 a 100 g.";
  }
  if (protein + carbs + fat > 100) return "Proteína, carbo e gordura somam mais de 100 g.";
  return null;
}
