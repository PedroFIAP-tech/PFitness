"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import type { Goal } from "@/lib/nutrition-calc";
import { BODY_LIMITS, GOAL_LIMITS, isGoal } from "@/lib/profile-model";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string } | undefined;

/** Peso de hoje (−/+ do Perfil). */
export async function logWeight(weightKg: number): Promise<Result> {
  await getSessionUser();
  if (typeof weightKg !== "number" || !(weightKg >= BODY_LIMITS.weightKg.min && weightKg <= BODY_LIMITS.weightKg.max)) {
    return { error: "Peso fora do limite." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_weight", { p_weight_kg: Math.round(weightKg * 10) / 10 });
  if (error) {
    console.error("logWeight", error);
    return { error: "Não foi possível registrar o peso." };
  }
  // Perfil e Progresso mostram o peso
  revalidatePath("/", "layout");
}

/** Troca o objetivo (as metas só mudam se o usuário aplicar o recálculo). */
export async function updateGoal(goal: Goal): Promise<Result> {
  const user = await getSessionUser();
  if (!isGoal(goal)) return { error: "Objetivo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ goal }).eq("id", user.id);
  if (error) {
    console.error("updateGoal", error);
    return { error: "Não foi possível trocar o objetivo." };
  }
  revalidatePath("/", "layout");
}

/** Grava as metas de hoje (o histórico dos dias anteriores fica). */
export async function saveGoals(
  goals: { kcal: number; protein: number; carbs: number; fat: number },
  source: "calculado" | "personalizado",
): Promise<Result> {
  await getSessionUser();
  const ok = (value: unknown, limits: { min: number; max: number }) =>
    Number.isInteger(value) && (value as number) >= limits.min && (value as number) <= limits.max;
  if (
    !ok(goals?.kcal, GOAL_LIMITS.kcal) ||
    !ok(goals.protein, GOAL_LIMITS.protein) ||
    !ok(goals.carbs, GOAL_LIMITS.carbs) ||
    !ok(goals.fat, GOAL_LIMITS.fat) ||
    (source !== "calculado" && source !== "personalizado")
  ) {
    return { error: "Metas fora do limite." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_daily_goals", {
    p_kcal: goals.kcal,
    p_protein_g: goals.protein,
    p_carbs_g: goals.carbs,
    p_fat_g: goals.fat,
    p_source: source,
  });
  if (error) {
    console.error("saveGoals", error);
    return { error: "Não foi possível salvar as metas." };
  }
  revalidatePath("/", "layout");
}

/** "Ignorar" a sugestão de meta: some por 7 dias. */
export async function dismissGoalSuggestion(): Promise<Result> {
  const user = await getSessionUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ goal_suggestion_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    console.error("dismissGoalSuggestion", error);
    return { error: "Não foi possível ignorar a sugestão." };
  }
  revalidatePath("/perfil");
}
