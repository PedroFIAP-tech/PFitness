import "server-only";
import { getSessionUser } from "@/lib/auth";
import type { DiaryItem, Food, Nutrients } from "@/lib/diet-model";
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
};

const RECENT_LIMIT = 8;
/** Registros lidos para achar os recentes (alimentos repetidos contam uma vez). */
const RECENT_SCAN = 80;

/** Fallback se o usuário ainda não tem metas (ensureProfile cria as iniciais). */
const FALLBACK_GOALS: Nutrients = { kcal: 2300, protein: 150, carbs: 270, fat: 70 };

type FoodRow = Pick<
  Tables<"foods">,
  "id" | "name" | "kcal_100g" | "protein_100g" | "carbs_100g" | "fat_100g" | "default_grams" | "user_id"
>;

export async function getDiaryDay(day: string): Promise<DiaryDay> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);

  const [itemsResult, goalsResult, foodsResult, recentResult] = await Promise.all([
    supabase
      .from("v_food_log_detail")
      .select("id, food_id, name, meal, grams, logged_at, kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .eq("eaten_on", day)
      .order("logged_at")
      .order("id"),
    supabase
      .from("daily_goals")
      .select("kcal, protein_g, carbs_g, fat_g, valid_from")
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
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (goalsResult.error) throw goalsResult.error;
  if (foodsResult.error) throw foodsResult.error;
  if (recentResult.error) throw recentResult.error;

  // Meta vigente: a de valid_from mais recente até o dia. Dias antes da primeira meta usam a mais antiga.
  const goalsRow =
    goalsResult.data.find((row) => row.valid_from <= day) ?? goalsResult.data.at(-1);
  const goals = goalsRow
    ? { kcal: goalsRow.kcal, protein: goalsRow.protein_g, carbs: goalsRow.carbs_g, fat: goalsRow.fat_g }
    : FALLBACK_GOALS;

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

  return { day, goals, items, foods, recentFoodIds };
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
