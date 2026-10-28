import "server-only";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { dayToDate, shiftDay, todayInAppTimeZone } from "@/lib/date";
import { getDayNutrition } from "@/lib/diet";
import type { Nutrients } from "@/lib/diet-model";
import { createClient } from "@/lib/supabase/server";
import { getActiveSession, getWorkoutSummary, type ActiveSession, type WorkoutSummary } from "@/lib/workout-session";
import { levelFromXp } from "@/lib/xp";
import { getPlansOverview, type PlansOverview, type WorkoutPlan } from "@/lib/workouts";


const WEEK_DAYS = 7;
const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

export type WeekDay = {
  /** YYYY-MM-DD */
  day: string;
  /** "S", "T"… ou "HOJE" */
  label: string;
  dayOfMonth: number;
  isToday: boolean;
};

export type StreakDay = WeekDay & { activity: "workout" | "food" | "none" };

/** Estado do card "Treino do dia". `plan` é null se a ficha foi excluída. */
export type TodayWorkout =
  | { state: "no-plans" }
  | { state: "idle"; plan: WorkoutPlan; activeSession: ActiveSession | null }
  /** Todas as fichas têm dia e nenhuma é hoje: mostra a próxima */
  | { state: "rest"; plan: WorkoutPlan; weekday: number; activeSession: ActiveSession | null }
  | { state: "active"; session: ActiveSession; plan: WorkoutPlan | null }
  | { state: "done"; summary: WorkoutSummary; plan: WorkoutPlan | null };

export type HomeData = {
  name: string;
  streak: { current: number; record: number; week: StreakDay[] };
  workout: TodayWorkout;
  /** "ABCD": letras das fichas ativas */
  division: string;
  nutrition: { totals: Nutrients; goals: Nutrients };
  points: { week: (WeekDay & { points: number })[]; weekTotal: number; xp: number; level: number };
};

/** Tudo da aba Hoje, buscado em paralelo. */
export async function getHomeData(): Promise<HomeData> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const today = todayInAppTimeZone();
  const weekStart = shiftDay(today, -(WEEK_DAYS - 1));

  const [
    profile,
    { plans, nextPlanId, restDay },
    activeSession,
    lastFinishedResult,
    currentResult,
    recordResult,
    activityResult,
    pointsResult,
    xpResult,
    nutrition,
  ] = await Promise.all([
    getCurrentProfile(),
    getPlansOverview(),
    getActiveSession(),
    supabase
      .from("workout_sessions")
      .select("id, plan_id, finished_at")
      .eq("user_id", user.id)
      .eq("status", "concluido")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("current_streak", { p_user: user.id }),
    supabase.rpc("longest_streak", { p_user: user.id }),
    supabase.rpc("activity_days", { p_from: weekStart }),
    supabase.rpc("points_by_day", { p_from: weekStart }),
    supabase.from("v_user_xp").select("xp").eq("user_id", user.id).maybeSingle(),
    getDayNutrition(today),
  ]);
  if (lastFinishedResult.error) throw lastFinishedResult.error;
  if (currentResult.error) throw currentResult.error;
  if (recordResult.error) throw recordResult.error;
  if (activityResult.error) throw activityResult.error;
  if (pointsResult.error) throw pointsResult.error;
  if (xpResult.error) throw xpResult.error;

  const week = Array.from({ length: WEEK_DAYS }, (_, index) => weekDay(shiftDay(weekStart, index), today));

  const activity = new Map(activityResult.data.map((row) => [row.day, row]));
  const streakWeek = week.map((day): StreakDay => {
    const row = activity.get(day.day);
    return { ...day, activity: row?.workout ? "workout" : row?.food ? "food" : "none" };
  });

  const pointsByDay = new Map(pointsResult.data.map((row) => [row.day, row.points]));
  const pointsWeek = week.map((day) => ({ ...day, points: pointsByDay.get(day.day) ?? 0 }));

  const xp = Number(xpResult.data?.xp ?? 0);
  const current = currentResult.data;

  return {
    name: profile.name,
    streak: { current, record: Math.max(recordResult.data, current), week: streakWeek },
    workout: await todayWorkout({
      plans,
      nextPlanId,
      restDay,
      activeSession,
      lastFinished: lastFinishedResult.data,
      today,
    }),
    division: plans.map((plan) => plan.code).join(""),
    nutrition,
    points: {
      week: pointsWeek,
      weekTotal: pointsWeek.reduce((sum, day) => sum + day.points, 0),
      xp,
      level: levelFromXp(xp),
    },
  };
}

async function todayWorkout({
  plans,
  nextPlanId,
  restDay,
  activeSession,
  lastFinished,
  today,
}: {
  plans: WorkoutPlan[];
  nextPlanId: number | null;
  restDay: PlansOverview["restDay"];
  activeSession: ActiveSession | null;
  lastFinished: { id: number; plan_id: number | null; finished_at: string | null } | null;
  today: string;
}): Promise<TodayWorkout> {
  const planById = (id: number | null) => plans.find((plan) => plan.id === id) ?? null;

  // Em andamento vale mais que concluído: dá para treinar duas vezes no dia
  if (activeSession && activeSession.planId !== null) {
    return { state: "active", session: activeSession, plan: planById(activeSession.planId) };
  }

  if (lastFinished?.finished_at && todayInAppTimeZone(new Date(lastFinished.finished_at)) === today) {
    const summary = await getWorkoutSummary(lastFinished.id);
    if (summary) return { state: "done", summary, plan: planById(lastFinished.plan_id) };
  }

  const next = planById(nextPlanId);
  if (next) return { state: "idle", plan: next, activeSession };

  const upcoming = restDay && planById(restDay.planId);
  if (upcoming && restDay) return { state: "rest", plan: upcoming, weekday: restDay.weekday, activeSession };
  return { state: "no-plans" };
}

function weekDay(day: string, today: string): WeekDay {
  const date = dayToDate(day);
  const isToday = day === today;
  return {
    day,
    label: isToday ? "HOJE" : WEEKDAY_INITIALS[date.getUTCDay()],
    dayOfMonth: date.getUTCDate(),
    isToday,
  };
}
