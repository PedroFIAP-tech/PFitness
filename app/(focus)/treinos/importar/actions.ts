"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiError, parseWorkoutText } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  IMPORT_DAILY_LIMIT,
  IMPORT_TEXT_MAX_LENGTH,
  NEW_EXERCISE_NAME_MAX_LENGTH,
  matchImport,
  type ImportPlan,
} from "@/lib/workout-import";
import { PLAN_LIMITS } from "@/lib/workout-rules";
import { getExerciseLibrary } from "@/lib/workouts";

export type ReadResult =
  | { plans: ImportPlan[]; remaining: number }
  | { error: string; /** Vale tentar de novo com o mesmo texto */ retry: boolean; remaining?: number };

/** Manda o texto para a IA e casa o resultado com a biblioteca. Cada chamada conta no limite do dia. */
export async function readWorkoutText(text: string): Promise<ReadResult> {
  await getSessionUser();
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return { error: "Cole o texto do treino.", retry: false };
  if (trimmed.length > IMPORT_TEXT_MAX_LENGTH) {
    return { error: `O texto passa de ${IMPORT_TEXT_MAX_LENGTH.toLocaleString("pt-BR")} caracteres.`, retry: false };
  }
  // Sem a chave nem gasta uma leitura do dia
  if (!process.env.OPENAI_API_KEY?.trim() && (process.env.AI_PROVIDER?.trim() || "openai") === "openai") {
    return { error: "A importação por IA não está configurada neste servidor.", retry: false };
  }

  const supabase = await createClient();
  const claim = await supabase.rpc("claim_ai_usage", { p_kind: "workout_import", p_daily_limit: IMPORT_DAILY_LIMIT });
  if (claim.error) {
    if (claim.error.code === "PF030") {
      return {
        error: `Você já usou as ${IMPORT_DAILY_LIMIT} importações de hoje. Amanhã tem mais!`,
        retry: false,
        remaining: 0,
      };
    }
    console.error("claim_ai_usage", claim.error);
    return { error: "Não foi possível começar a leitura. Tente de novo.", retry: true };
  }
  const remaining = claim.data;

  const { exercises } = await getExerciseLibrary();
  try {
    const parsed = await parseWorkoutText(
      trimmed,
      exercises.map((exercise) => ({ name: exercise.name, equipment: exercise.equipment })),
    );
    const plans = matchImport(parsed, exercises);
    if (plans.length === 0) {
      return { error: "Não encontrei exercícios nesse texto. Confira se colou o treino certo.", retry: false, remaining };
    }
    return { plans, remaining };
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    console.error("parseWorkoutText", error.code, error.message, error.cause);
    switch (error.code) {
      case "not_configured":
        return { error: "A importação por IA não está configurada neste servidor.", retry: false, remaining };
      case "model_unavailable":
        return {
          error: `A chave da OpenAI não tem acesso ao modelo ${process.env.AI_MODEL?.trim() || "gpt-6-luna"}. Confira o modelo em AI_MODEL ou o acesso da conta.`,
          retry: false,
          remaining,
        };
      case "invalid_response":
        return { error: "Não consegui ler esse treino. Tente de novo.", retry: true, remaining };
      case "rate_limited":
      case "unavailable":
        return { error: "O serviço de IA não respondeu. Tente de novo em instantes.", retry: true, remaining };
    }
  }
}

export type ImportSubmitPlan = {
  title: string;
  weekday: number | null;
  exercises: {
    /** null quando é exercício novo */
    exerciseId: number | null;
    newExercise: { name: string; muscleGroup: string; equipment: string | null } | null;
    sets: number;
    reps: number;
    notes: string | null;
  }[];
};

/** Cria os exercícios novos e as fichas numa transação (import_workout_plans). */
export async function importPlans(plans: ImportSubmitPlan[], replace: boolean): Promise<{ error: string } | undefined> {
  await getSessionUser();
  if (!isValidSubmit(plans) || typeof replace !== "boolean") return { error: "Dados das fichas inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_workout_plans", {
    p_plans: plans.map((plan) => ({
      title: plan.title.trim(),
      weekday: plan.weekday,
      exercises: plan.exercises.map((item) => ({
        exercise_id: item.exerciseId,
        new_exercise: item.newExercise && {
          name: item.newExercise.name.trim(),
          muscle_group: item.newExercise.muscleGroup,
          equipment: item.newExercise.equipment,
        },
        target_sets: item.sets,
        target_reps: item.reps,
        notes: item.notes?.trim() || null,
      })),
    })),
    p_replace: replace,
  });
  if (error) return { error: importErrorMessage(error) };

  revalidatePath("/", "layout");
  redirect(`/treinos?importadas=${data.length}`);
}

function isValidSubmit(plans: ImportSubmitPlan[]) {
  const inRange = (value: unknown, min: number, max: number) =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
  const shortText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max;

  return (
    Array.isArray(plans) &&
    plans.length >= 1 &&
    plans.length <= 26 &&
    plans.every(
      (plan) =>
        shortText(plan.title, PLAN_LIMITS.titleMaxLength) &&
        (plan.weekday === null || inRange(plan.weekday, 0, 6)) &&
        Array.isArray(plan.exercises) &&
        plan.exercises.length >= 1 &&
        plan.exercises.length <= PLAN_LIMITS.maxExercises &&
        plan.exercises.every(
          (item) =>
            (item.exerciseId === null) !== (item.newExercise === null) &&
            (item.exerciseId === null || Number.isSafeInteger(item.exerciseId)) &&
            (item.newExercise === null ||
              (shortText(item.newExercise.name, NEW_EXERCISE_NAME_MAX_LENGTH) &&
                item.newExercise.name.trim().length > 0 &&
                shortText(item.newExercise.muscleGroup, 40) &&
                (item.newExercise.equipment === null || shortText(item.newExercise.equipment, 40)))) &&
            inRange(item.sets, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max) &&
            inRange(item.reps, PLAN_LIMITS.reps.min, PLAN_LIMITS.reps.max) &&
            (item.notes === null || shortText(item.notes, PLAN_LIMITS.notesMaxLength)),
        ),
    )
  );
}

// Códigos definidos em supabase/migrations/20261028160000_workout_import.sql
function importErrorMessage(error: PostgrestError) {
  switch (error.code) {
    case "PF014":
      return "Finalize ou descarte o treino atual antes de substituir as fichas.";
    case "PF001":
      return "Não há letras livres para tantas fichas (máximo de 26). Use “Substituir” ou exclua algumas.";
    case "PF003":
      return "Um dos exercícios não está mais disponível. Troque-o e tente de novo.";
    case "23514":
    case "22023":
      return "Algum valor das fichas está fora do limite.";
    default:
      // PGRST202 aqui significa que a migration ainda não foi aplicada
      console.error("importPlans", error);
      return "Não foi possível salvar as fichas. Tente de novo.";
  }
}
