import "server-only";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import {
  DEFAULT_MEAL_PLAN,
  parseMealPlan,
  type DiaryItem,
  type Food,
  type MealPlanEntry,
  type Nutrients,
} from "@/lib/diet-model";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type DiaryDay = {
  /** YYYY-MM-DD */
  day: string;
  /** Meta vigente no dia */
  goals: Nutrients;
  items: DiaryItem[];
  /** Alimentos globais e os do usuário, em ordem alfabética */
  foods: Food[];
  /** Ids dos alimentos registrados mais recentemente (chips do "Adicionar") */
  recentFoodIds: number[];
  /** Refeições do usuário, na ordem dele */
  mealPlan: MealPlanEntry[];
};

const RECENT_LIMIT = 8;
/** Registros lidos para achar os recentes (alimentos repetidos contam uma vez). */
const RECENT_SCAN = 80;

const GOALS_SELECT = "kcal, protein_g, carbs_g, fat_g, valid_from";

/** Fallback se o usuário ainda não tem metas (ensureProfile cria as iniciais). */
const FALLBACK_GOALS: Nutrients = { kcal: 2300, protein: 150, carbs: 270, fat: 70 };

type FoodRow = Pick<
  Tables<"foods">,
  "id" | "name" | "kcal_100g" | "protein_100g" | "carbs_100g" | "fat_100g" | "default_grams" | "user_id"
>;

export async function getDiaryDay(day: string): Promise<DiaryDay> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);

  const [itemsResult, goalsResult, foodsResult, recentResult, profile] = await Promise.all([
    supabase
      .from("v_food_log_detail")
      .select("id, food_id, name, meal, grams, logged_at, kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .eq("eaten_on", day)
      .order("logged_at")
      .order("id"),
    supabase
      .from("daily_goals")
      .select(GOALS_SELECT)
      .eq("user_id", user.id)
      .order("valid_from", { ascending: false }),
    supabase
      .from("foods")
      .select("id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, default_grams, user_id"),
    supabase
      .from("food_logs")
      .select("food_id")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(RECENT_SCAN),
    getCurrentProfile(),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (goalsResult.error) throw goalsResult.error;
  if (foodsResult.error) throw foodsResult.error;
  if (recentResult.error) throw recentResult.error;

  const goals = goalsForDay(goalsResult.data, day);

  const items = itemsResult.data.flatMap((row): DiaryItem[] =>
    row.id === null || row.food_id === null || row.meal === null
      ? []
      : [
          {
            id: row.id,
            foodId: row.food_id,
            name: row.name ?? "",
            meal: row.meal,
            grams: Number(row.grams),
            loggedAt: row.logged_at ?? "",
            nutrients: {
              kcal: Number(row.kcal),
              protein: Number(row.protein_g),
              carbs: Number(row.carbs_g),
              fat: Number(row.fat_g),
            },
          },
        ],
  );

  const foods = foodsResult.data
    .map(toFood)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const recentFoodIds = [...new Set(recentResult.data.map((row) => row.food_id))].slice(0, RECENT_LIMIT);

  return { day, goals, items, foods, recentFoodIds, mealPlan: parseMealPlan(profile.meal_plan) ?? DEFAULT_MEAL_PLAN };
}

/** Totais consumidos e meta vigente de um dia (card de alimentação da aba Hoje). */
export async function getDayNutrition(day: string): Promise<{ totals: Nutrients; goals: Nutrients }> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const [totalsResult, goalsResult] = await Promise.all([
    supabase
      .from("v_daily_nutrition")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .eq("eaten_on", day)
      .maybeSingle(),
    supabase.from("daily_goals").select(GOALS_SELECT).eq("user_id", user.id).order("valid_from", { ascending: false }),
  ]);
  if (totalsResult.error) throw totalsResult.error;
  if (goalsResult.error) throw goalsResult.error;

  const row = totalsResult.data;
  return {
    totals: {
      kcal: Number(row?.kcal ?? 0),
      protein: Number(row?.protein_g ?? 0),
      carbs: Number(row?.carbs_g ?? 0),
      fat: Number(row?.fat_g ?? 0),
    },
    goals: goalsForDay(goalsResult.data, day),
  };
}

/**
 * Meta vigente no dia: a de valid_from mais recente até ele. Dias antes da
 * primeira meta usam a mais antiga. `rows` vem de valid_from desc.
 */
function goalsForDay(
  rows: Pick<Tables<"daily_goals">, "kcal" | "protein_g" | "carbs_g" | "fat_g" | "valid_from">[],
  day: string,
): Nutrients {
  const row = rows.find((goal) => goal.valid_from <= day) ?? rows.at(-1);
  return row ? { kcal: row.kcal, protein: row.protein_g, carbs: row.carbs_g, fat: row.fat_g } : FALLBACK_GOALS;
}

export function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    per100: {
      kcal: Number(row.kcal_100g),
      protein: Number(row.protein_100g),
      carbs: Number(row.carbs_100g),
      fat: Number(row.fat_100g),
    },
    defaultGrams: row.default_grams,
    own: row.user_id !== null,
  };
}
