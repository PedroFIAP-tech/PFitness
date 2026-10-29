import "server-only";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { shiftDay, todayInAppTimeZone } from "@/lib/date";
import type { Goal, WeightPoint } from "@/lib/nutrition-calc";
import {
  CALENDAR_WEEKS,
  weekStart,
  type LoadExercise,
  type TrainingDay,
} from "@/lib/progress-model";
import { createClient } from "@/lib/supabase/server";

/** Volume por grupo muscular: últimas 4 semanas (28 dias contando hoje). */
const MUSCLE_VOLUME_DAYS = 28;

export type ProgressData = {
  today: string;
  goal: Goal;
  /** Pesagens do último ano, em ordem de data */
  weights: WeightPoint[];
  /** Exercícios com histórico de carga no último ano */
  loads: LoadExercise[];
  /** Dias das últimas 18 semanas (calendário e resumo do mês) */
  days: TrainingDay[];
  muscleVolume: { muscleGroup: string; volumeKg: number; sets: number }[];
  streak: { current: number; record: number };
};

/** Tudo da aba Progresso, em paralelo. */
export async function getProgressData(): Promise<ProgressData> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const today = todayInAppTimeZone();
  // 18 semanas cobrem também o mês corrente (resumo do mês)
  const calendarStart = shiftDay(weekStart(today), -7 * (CALENDAR_WEEKS - 1));

  const [profile, weightsResult, loadsResult, daysResult, muscleResult, currentResult, recordResult] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("weight_logs")
      .select("logged_on, weight_kg")
      .eq("user_id", user.id)
      .gt("logged_on", shiftDay(today, -366))
      .order("logged_on"),
    supabase.rpc("load_progress", { p_from: shiftDay(today, -365) }),
    supabase.rpc("training_calendar", { p_from: calendarStart }),
    supabase.rpc("muscle_volume", { p_from: shiftDay(today, -(MUSCLE_VOLUME_DAYS - 1)) }),
    supabase.rpc("current_streak", { p_user: user.id }),
    supabase.rpc("longest_streak", { p_user: user.id }),
  ]);
  for (const result of [weightsResult, loadsResult, daysResult, muscleResult, currentResult, recordResult]) {
    if (result.error) throw result.error;
  }

  const loads = new Map<number, LoadExercise>();
  for (const row of loadsResult.data ?? []) {
    const exercise = loads.get(row.exercise_id) ?? { id: row.exercise_id, name: row.name, weeks: [] };
    exercise.weeks.push({
      weekStart: row.week_start,
      maxKg: Number(row.max_kg),
      e1rm: Number(row.best_e1rm),
      sets: row.sets,
    });
    loads.set(row.exercise_id, exercise);
  }

  const current = currentResult.data ?? 0;
  return {
    today,
    goal: profile.goal,
    weights: (weightsResult.data ?? []).map((row) => ({ day: row.logged_on, kg: Number(row.weight_kg) })),
    loads: [...loads.values()],
    days: (daysResult.data ?? []).map((row) => ({
      day: row.day,
      volumeKg: Number(row.volume_kg),
      sessions: row.sessions,
      durationS: row.duration_s,
      plans: row.plans,
      food: row.food,
    })),
    muscleVolume: (muscleResult.data ?? []).map((row) => ({
      muscleGroup: row.muscle_group,
      volumeKg: Number(row.volume_kg),
      sets: row.sets,
    })),
    streak: { current, record: Math.max(recordResult.data ?? 0, current) },
  };
}
