"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveSession, type ActiveSession } from "@/lib/workout-session";

export type StartWorkoutResult = { error: string } | { conflict: ActiveSession } | undefined;
export type FinishWorkoutResult = { error: string } | { summaryUrl: string };

/**
 * Inicia (ou retoma) o treino da ficha e abre a tela. Se houver um treino de outra
 * ficha em andamento, devolve o conflito para o app perguntar; com
 * `discardSessionId`, descarta aquele treino antes, na mesma transação.
 */
export async function startWorkout(planId: number, discardSessionId?: number): Promise<StartWorkoutResult> {
  await getSessionUser();
  if (!isId(planId) || (discardSessionId !== undefined && !isId(discardSessionId))) {
    return { error: "Ficha inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_workout", {
    p_plan_id: planId,
    ...(discardSessionId !== undefined && { p_discard_session_id: discardSessionId }),
  });

  if (error?.code === "PF010") {
    const active = await getActiveSession();
    if (active) return { conflict: active };
  }
  if (error) return { error: errorMessage(error) };

  // A pílula do treino e o "Continuar" das fichas dependem da sessão ativa
  revalidatePath("/", "layout");
  redirect(`/treino/${planId}`);
}

/** Finaliza o treino. O app já enviou a fila de séries antes de chamar. */
export async function finishWorkout(sessionId: number): Promise<FinishWorkoutResult> {
  await getSessionUser();
  if (!isId(sessionId)) return { error: "Treino inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_workout", { p_session_id: sessionId }).single();
  if (error) return { error: errorMessage(error) };

  revalidatePath("/", "layout");
  return { summaryUrl: `/treino/resumo/${sessionId}?de=${data.streak_before}` };
}

/** Descarta o treino em andamento: apaga sessão, séries e pontos. */
export async function discardWorkout(sessionId: number): Promise<{ error: string } | undefined> {
  await getSessionUser();
  if (!isId(sessionId)) return { error: "Treino inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_workout", { p_session_id: sessionId });
  if (error) return { error: errorMessage(error) };

  revalidatePath("/", "layout");
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

// Códigos definidos em supabase/migrations/20261027130000_workout_session.sql
function errorMessage(error: PostgrestError) {
  switch (error.code) {
    case "PF002":
      return "Essa ficha não existe mais.";
    case "PF010":
      return "Já existe um treino em andamento.";
    case "PF011":
    case "PF012":
      return "Esse treino não está mais em andamento.";
    case "PF013":
      return "Conclua pelo menos uma série para finalizar, ou descarte o treino.";
    default:
      console.error("workout action", error);
      return "Não foi possível concluir. Tente de novo.";
  }
}
