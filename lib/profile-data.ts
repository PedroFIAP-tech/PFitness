import "server-only";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { shiftDay, todayInAppTimeZone } from "@/lib/date";
import { DEFAULT_MEAL_PLAN, parseMealPlan, type MealPlanEntry, type Nutrients } from "@/lib/diet-model";
import {
  ADAPTIVE,
  ageOn,
  suggestGoalAdjustment,
  type ActivityLevel,
  type Goal,
  type GoalSuggestion,
  type Sex,
} from "@/lib/nutrition-calc";
import { isActivityLevel, isSex, type GoalsSource, type Restriction } from "@/lib/profile-model";
import { createClient } from "@/lib/supabase/server";
import { levelFromXp, XP_PER_LEVEL } from "@/lib/xp";

/** "Ignorar" esconde a sugestão de meta por esta quantidade de dias. */
const SUGGESTION_SNOOZE_DAYS = 7;

export type Achievement = {
  id: string;
  name: string;
  description: string;
  badgeCode: string;
  badgeUnit: string;
  progress: number;
  target: number;
  /** ISO; null se ainda bloqueada */
  unlockedAt: string | null;
};

/** Dados do corpo usados no cálculo; null nos campos que o usuário ainda não preencheu. */
export type BodyProfile = {
  sex: Sex | null;
  birthDate: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: Goal;
  activityLevel: ActivityLevel | null;
  workoutsPerWeek: number | null;
};

export type ProfilePageData = {
  name: string;
  memberSince: string;
  xp: number;
  level: number;
  levelStart: number;
  body: BodyProfile;
  goals: Nutrients & { source: GoalsSource };
  suggestion: GoalSuggestion | null;
  achievements: Achievement[];
  today: string;
};

/** Tudo da aba Perfil, em paralelo. Também sincroniza as conquistas. */
export async function getProfilePageData(): Promise<ProfilePageData> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const today = todayInAppTimeZone();

  const [profile, weightsResult, goalsResult, xpResult, progressResult, catalogResult] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("weight_logs")
      .select("logged_on, weight_kg")
      .eq("user_id", user.id)
      .order("logged_on", { ascending: false })
      .limit(60),
    supabase
      .from("daily_goals")
      .select("kcal, protein_g, carbs_g, fat_g, source")
      .eq("user_id", user.id)
      .lte("valid_from", today)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("v_user_xp").select("xp").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("sync_achievements"),
    supabase.from("achievements").select("id, name, description, badge_code, badge_unit"),
  ]);
  for (const result of [weightsResult, goalsResult, xpResult, progressResult, catalogResult]) {
    if (result.error) throw result.error;
  }

  const weights = (weightsResult.data ?? []).map((row) => ({ day: row.logged_on, kg: Number(row.weight_kg) }));
  const goalsRow = goalsResult.data;
  const goals = {
    kcal: goalsRow?.kcal ?? 2300,
    protein: goalsRow?.protein_g ?? 150,
    carbs: goalsRow?.carbs_g ?? 270,
    fat: goalsRow?.fat_g ?? 70,
    source: (goalsRow?.source ?? "padrao") as GoalsSource,
  };

  const dismissedAt = profile.goal_suggestion_dismissed_at;
  const snoozed =
    dismissedAt !== null && todayInAppTimeZone(new Date(dismissedAt)) > shiftDay(today, -SUGGESTION_SNOOZE_DAYS);
  const suggestion = snoozed
    ? null
    : suggestGoalAdjustment({
        weights: weights.filter((point) => point.day > shiftDay(today, -ADAPTIVE.windowDays)),
        goal: profile.goal,
        currentKcal: goals.kcal,
        today,
      });

  const progress = new Map((progressResult.data ?? []).map((row) => [row.achievement_id, row]));
  const achievements = (catalogResult.data ?? [])
    .map((row): Achievement => {
      const state = progress.get(row.id);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        badgeCode: row.badge_code,
        badgeUnit: row.badge_unit,
        progress: Number(state?.progress ?? 0),
        target: Number(state?.target ?? 0),
        unlockedAt: state?.unlocked_at ?? null,
      };
    })
    // Desbloqueadas primeiro (mais recentes antes), depois as mais perto de sair
    .sort((a, b) =>
      a.unlockedAt && b.unlockedAt
        ? b.unlockedAt.localeCompare(a.unlockedAt)
        : a.unlockedAt
          ? -1
          : b.unlockedAt
            ? 1
            : b.progress / (b.target || 1) - a.progress / (a.target || 1),
    );

  const xp = Number(xpResult.data?.xp ?? 0);
  const level = levelFromXp(xp);

  return {
    name: profile.name,
    memberSince: profile.created_at,
    xp,
    level,
    levelStart: (level - 1) * XP_PER_LEVEL,
    body: toBodyProfile(profile, weights[0]?.kg ?? null, today),
    goals,
    suggestion,
    achievements,
    today,
  };
}

export type OnboardingDefaults = {
  body: BodyProfile;
  mealPlan: MealPlanEntry[];
  restrictions: Restriction[];
  /** Pré-preenchido pelas fichas com dia da semana (ou pela quantidade de fichas) */
  suggestedWorkoutsPerWeek: number;
  /** Já fez o onboarding: é um "Refazer" */
  redo: boolean;
};

/** Valores iniciais do onboarding (vazios no primeiro acesso, os atuais ao refazer). */
export async function getOnboardingDefaults(): Promise<OnboardingDefaults> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const [profile, weightResult, plansResult] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("weight_logs")
      .select("weight_kg")
      .eq("user_id", user.id)
      .order("logged_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("workout_plans").select("weekday").eq("user_id", user.id).eq("archived", false),
  ]);
  if (weightResult.error) throw weightResult.error;
  if (plansResult.error) throw plansResult.error;

  const plans = plansResult.data;
  const withWeekday = new Set(plans.flatMap((plan) => (plan.weekday === null ? [] : [plan.weekday]))).size;
  const suggestedWorkoutsPerWeek = Math.min(7, Math.max(1, withWeekday || plans.length || 3));

  return {
    body: toBodyProfile(profile, weightResult.data ? Number(weightResult.data.weight_kg) : null, todayInAppTimeZone()),
    mealPlan: parseMealPlan(profile.meal_plan) ?? DEFAULT_MEAL_PLAN,
    restrictions: profile.dietary_restrictions.filter((value): value is Restriction =>
      ["vegetariano", "sem_lactose", "sem_gluten"].includes(value),
    ),
    suggestedWorkoutsPerWeek,
    redo: profile.onboarded_at !== null,
  };
}

function toBodyProfile(
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  weightKg: number | null,
  today: string,
): BodyProfile {
  return {
    sex: isSex(profile.sex) ? profile.sex : null,
    birthDate: profile.birth_date,
    age: profile.birth_date ? ageOn(profile.birth_date, today) : null,
    heightCm: profile.height_cm,
    weightKg,
    goal: profile.goal,
    activityLevel: isActivityLevel(profile.activity_level) ? profile.activity_level : null,
    workoutsPerWeek: profile.workouts_per_week,
  };
}
