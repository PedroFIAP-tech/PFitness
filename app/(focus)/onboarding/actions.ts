"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { ageOn } from "@/lib/nutrition-calc";
import { parseDay, todayInAppTimeZone } from "@/lib/date";
import { MEAL_NAMES, type MealPlanEntry } from "@/lib/diet-model";
import {
  BODY_LIMITS,
  GOAL_LIMITS,
  MEALS_PER_DAY,
  RESTRICTION_OPTIONS,
  isActivityLevel,
  isGoal,
  isSex,
  type Restriction,
} from "@/lib/profile-model";
import type { ActivityLevel, Goal, Sex } from "@/lib/nutrition-calc";
import { createClient } from "@/lib/supabase/server";

export type OnboardingInput = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  workoutsPerWeek: number;
  mealPlan: MealPlanEntry[];
  restrictions: Restriction[];
  goals: { kcal: number; protein: number; carbs: number; fat: number };
  /** "personalizado" se o usuário ajustou as metas calculadas */
  goalsSource: "calculado" | "personalizado";
  /** Refazer pelo Perfil: volta para lá */
  redo: boolean;
};

/** Sucesso devolve para onde ir; quem chama navega (veja OnboardingFlow). */
export async function saveOnboarding(input: OnboardingInput): Promise<{ error: string } | { next: string }> {
  await getSessionUser();
  const problem = validate(input);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_onboarding", {
    p_sex: input.sex,
    p_birth_date: input.birthDate,
    p_height_cm: input.heightCm,
    p_weight_kg: input.weightKg,
    p_goal: input.goal,
    p_activity_level: input.activityLevel,
    p_workouts_per_week: input.workoutsPerWeek,
    p_meal_plan: input.mealPlan,
    p_restrictions: input.restrictions,
    p_kcal: input.goals.kcal,
    p_protein_g: input.goals.protein,
    p_carbs_g: input.goals.carbs,
    p_fat_g: input.goals.fat,
    p_goals_source: input.goalsSource,
  });
  if (error) {
    // PGRST202 aqui significa que a migration ainda não foi aplicada
    console.error("saveOnboarding", error);
    return {
      error:
        error.code === "22023" || error.code === "23514"
          ? "Algum dado está fora do limite. Confira e tente de novo."
          : "Não foi possível salvar. Tente de novo.",
    };
  }

  revalidatePath("/", "layout");
  return { next: input.redo ? "/perfil?metas=atualizadas" : "/hoje" };
}

function validate(input: OnboardingInput): string | null {
  const inRange = (value: unknown, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  const birthDate = parseDay(input.birthDate);
  const age = birthDate ? ageOn(birthDate, todayInAppTimeZone()) : -1;

  if (!isSex(input.sex)) return "Escolha o sexo.";
  if (!birthDate || age < BODY_LIMITS.age.min || age > BODY_LIMITS.age.max) return "Confira a data de nascimento.";
  if (!Number.isInteger(input.heightCm) || !inRange(input.heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max)) {
    return "Confira a altura.";
  }
  if (!inRange(input.weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max)) return "Confira o peso.";
  if (!isGoal(input.goal)) return "Escolha o objetivo.";
  if (!isActivityLevel(input.activityLevel)) return "Escolha a rotina.";
  if (!Number.isInteger(input.workoutsPerWeek) || !inRange(input.workoutsPerWeek, 1, 7)) return "Escolha os treinos por semana.";

  const meals = Array.isArray(input.mealPlan) ? input.mealPlan : [];
  if (
    meals.length < MEALS_PER_DAY.min ||
    meals.length > MEALS_PER_DAY.max ||
    new Set(meals.map((entry) => entry.meal)).size !== meals.length ||
    !meals.every((entry) => entry.meal in MEAL_NAMES && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))
  ) {
    return `Escolha de ${MEALS_PER_DAY.min} a ${MEALS_PER_DAY.max} refeições com horário.`;
  }
  const allowed = RESTRICTION_OPTIONS.map((option) => option.value as string);
  if (!Array.isArray(input.restrictions) || !input.restrictions.every((value) => allowed.includes(value))) {
    return "Restrição inválida.";
  }

  const { goals } = input;
  if (
    !Number.isInteger(goals?.kcal) ||
    !inRange(goals.kcal, GOAL_LIMITS.kcal.min, GOAL_LIMITS.kcal.max) ||
    !inRange(goals.protein, GOAL_LIMITS.protein.min, GOAL_LIMITS.protein.max) ||
    !inRange(goals.carbs, GOAL_LIMITS.carbs.min, GOAL_LIMITS.carbs.max) ||
    !inRange(goals.fat, GOAL_LIMITS.fat.min, GOAL_LIMITS.fat.max) ||
    ![goals.protein, goals.carbs, goals.fat].every(Number.isInteger)
  ) {
    return "Metas fora do limite.";
  }
  if (input.goalsSource !== "calculado" && input.goalsSource !== "personalizado") return "Dados inválidos.";
  return null;
}
