"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/workout-rules";

export type SavePlanInput = {
  /** null cria uma ficha nova */
  planId: number | null;
  title: string;
  exercises: {
    exerciseId: number;
    targetSets: number;
    targetReps: number;
    restSeconds: number;
  }[];
};

export type ActionResult = { error: string } | undefined;

const UNIQUE_VIOLATION = "23505";

export async function savePlan(input: SavePlanInput): Promise<ActionResult> {
  await getSessionUser();
  if (!isValidSaveInput(input)) return { error: "Dados da ficha inválidos." };

  const supabase = await createClient();
  const args = {
    p_title: input.title.trim(),
    p_exercises: input.exercises.map((item) => ({
      exercise_id: item.exerciseId,
      target_sets: item.targetSets,
      target_reps: item.targetReps,
      rest_seconds: item.restSeconds,
    })),
    ...(input.planId !== null && { p_plan_id: input.planId }),
  };

  let result = await supabase.rpc("save_workout_plan", args);
  // Duas fichas novas criadas ao mesmo tempo podem disputar a mesma letra
  if (result.error?.code === UNIQUE_VIOLATION && input.planId === null) {
    result = await supabase.rpc("save_workout_plan", args);
  }
  if (result.error) return { error: saveErrorMessage(result.error) };

  revalidatePath("/treinos");
  redirect(`/treinos?ficha=${result.data}`);
}

export async function deletePlan(planId: number): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!Number.isSafeInteger(planId)) return { error: "Ficha inválida." };

  const supabase = await createClient();
  // plan_exercises cai em cascata; sessões já feitas ficam com plan_id null e o plan_title salvo
  const { data, error } = await supabase
    .from("workout_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", user.id)
    .select("code")
    .maybeSingle();
  if (error) {
    console.error("deletePlan", error);
    return { error: "Não foi possível excluir. Tente de novo." };
  }
  if (!data) return { error: "Essa ficha não existe mais." };

  revalidatePath("/treinos");
  redirect(`/treinos?excluida=${data.code}`);
}

function isValidSaveInput(input: SavePlanInput) {
  const inRange = (value: unknown, min: number, max: number) =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

  return (
    (input.planId === null || Number.isSafeInteger(input.planId)) &&
    typeof input.title === "string" &&
    input.title.trim().length <= PLAN_LIMITS.titleMaxLength &&
    Array.isArray(input.exercises) &&
    input.exercises.length <= PLAN_LIMITS.maxExercises &&
    input.exercises.every(
      (item) =>
        Number.isSafeInteger(item.exerciseId) &&
        inRange(item.targetSets, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max) &&
        inRange(item.targetReps, PLAN_LIMITS.reps.min, PLAN_LIMITS.reps.max) &&
        inRange(item.restSeconds, 0, PLAN_LIMITS.maxRestSeconds),
    )
  );
}

// Códigos definidos em supabase/migrations/20261027120000_save_workout_plan.sql
function saveErrorMessage(error: PostgrestError) {
  switch (error.code) {
    case "PF001":
      return "Você já tem 26 fichas. Exclua uma para criar outra.";
    case "PF002":
      return "Essa ficha não existe mais.";
    case "PF003":
      return "Um dos exercícios não está mais disponível.";
    case "23514":
      return "Séries ou repetições fora do limite.";
    default:
      // PGRST202 aqui significa que a migration da função ainda não foi aplicada
      console.error("savePlan", error);
      return "Não foi possível salvar. Tente de novo.";
  }
}
