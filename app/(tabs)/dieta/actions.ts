"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { parseDay } from "@/lib/date";
import { toFood } from "@/lib/diet";
import { MEAL_NAMES, newFoodProblem, type Food, type MealType, type NewFoodValues } from "@/lib/diet-model";
import { createClient } from "@/lib/supabase/server";

export type DietActionResult = { error: string } | undefined;

// O banco aceita de 1 a 2000 g (log_food/update_food_log)
const isValidGrams = (grams: unknown) =>
  typeof grams === "number" && Number.isFinite(grams) && grams >= 1 && grams <= 2000;

export async function addFood(input: {
  foodId: number;
  meal: MealType;
  grams: number;
  day: string;
}): Promise<DietActionResult> {
  await getSessionUser();
  const day = parseDay(input.day);
  if (!Number.isSafeInteger(input.foodId) || !(input.meal in MEAL_NAMES) || !isValidGrams(input.grams) || !day) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_food", {
    p_food_id: input.foodId,
    p_meal: input.meal,
    p_grams: input.grams,
    p_eaten_on: day,
  });
  if (error) return { error: foodErrorMessage(error, "addFood") };

  revalidatePath("/", "layout");
}

export async function updateFoodLog(logId: number, grams: number): Promise<DietActionResult> {
  await getSessionUser();
  if (!Number.isSafeInteger(logId) || !isValidGrams(grams)) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_food_log", { p_log_id: logId, p_grams: grams });
  if (error) return { error: foodErrorMessage(error, "updateFoodLog") };

  revalidatePath("/", "layout");
}

export async function removeFoodLog(logId: number): Promise<DietActionResult> {
  await getSessionUser();
  if (!Number.isSafeInteger(logId)) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_food_log", { p_log_id: logId });
  if (error) return { error: foodErrorMessage(error, "removeFoodLog") };

  revalidatePath("/", "layout");
}

export async function createFood(input: NewFoodValues): Promise<{ food: Food } | { error: string }> {
  const user = await getSessionUser();
  const problem = newFoodProblem(input);
  if (problem) return { error: problem };
  const name = input.name.trim().replace(/\s+/g, " ");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .insert({
      user_id: user.id,
      name,
      kcal_100g: input.kcal,
      protein_100g: input.protein,
      carbs_100g: input.carbs,
      fat_100g: input.fat,
      source: null,
    })
    .select("id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, default_grams, user_id")
    .single();
  if (error) {
    console.error("createFood", error);
    return { error: "Não foi possível criar o alimento. Tente de novo." };
  }

  revalidatePath("/dieta");
  return { food: toFood(data) };
}

// Códigos definidos em supabase/migrations/20261028120000_food_log.sql
function foodErrorMessage(error: PostgrestError, action: string) {
  switch (error.code) {
    case "PF020":
      return "Esse alimento não está mais disponível.";
    case "PF021":
      return "Só dá para mudar o registro de hoje e de ontem.";
    case "PF022":
      return "Esse registro não existe mais.";
    case "22023":
      return "Quantidade fora do limite.";
    default:
      // PGRST202 aqui significa que a migration das funções ainda não foi aplicada
      console.error(action, error);
      return "Não foi possível salvar. Tente de novo.";
  }
}
