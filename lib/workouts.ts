import "server-only";
import { getSessionUser } from "@/lib/auth";
import { formatDaysAgo } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

export type LibraryExercise = {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  /** Passo da roleta de kg */
  weightIncrement: number;
};

export type PlanExercise = {
  exercise: LibraryExercise;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
};

export type WorkoutPlan = {
  id: number;
  code: string;
  title: string;
  exercises: PlanExercise[];
};

export type PlanOverview = WorkoutPlan & {
  /** "hoje", "há 7 dias" ou "nunca feito" */
  lastDoneLabel: string;
  /** Maior carga da última sessão de cada exercício (null sem histórico) */
  lastLoadKg: Record<number, number | null>;
};

/** Ordem dos grupos no protótipo; grupos desconhecidos vão para o fim. */
const MUSCLE_GROUP_ORDER = ["Peito", "Costas", "Pernas", "Ombros", "Bíceps", "Tríceps", "Abdômen"];

const PLAN_CODES = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const PLAN_SELECT =
  "id, code, title, plan_exercises(position, target_sets, target_reps, rest_seconds, exercises(id, name, muscle_group, equipment, weight_increment))";

/** Fichas ativas com "última vez", última carga e a próxima da sequência (badge HOJE). */
export async function getPlansOverview(): Promise<{
  plans: PlanOverview[];
  nextPlanId: number | null;
}> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);

  const [plansResult, sessionsResult, lastSetsResult] = await Promise.all([
    supabase
      .from("workout_plans")
      .select(PLAN_SELECT)
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("position")
      .order("code")
      .order("position", { referencedTable: "plan_exercises" }),
    supabase
      .from("workout_sessions")
      .select("plan_id, finished_at")
      .eq("user_id", user.id)
      .eq("status", "concluido")
      .not("plan_id", "is", null)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false }),
    supabase.from("v_exercise_last").select("exercise_id, weight_kg").eq("user_id", user.id),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (lastSetsResult.error) throw lastSetsResult.error;

  // Sessões vêm da mais recente para a mais antiga: a primeira de cada ficha é a última feita
  const lastDoneAt = new Map<number, string>();
  for (const session of sessionsResult.data) {
    if (session.plan_id !== null && session.finished_at && !lastDoneAt.has(session.plan_id)) {
      lastDoneAt.set(session.plan_id, session.finished_at);
    }
  }

  const topLoad = new Map<number, number>();
  for (const set of lastSetsResult.data) {
    if (set.exercise_id === null || set.weight_kg === null) continue;
    topLoad.set(set.exercise_id, Math.max(topLoad.get(set.exercise_id) ?? 0, set.weight_kg));
  }

  const now = new Date();
  const plans = plansResult.data.map((row): PlanOverview => {
    const plan = toWorkoutPlan(row);
    const doneAt = lastDoneAt.get(plan.id);
    return {
      ...plan,
      lastDoneLabel: doneAt ? formatDaysAgo(new Date(doneAt), now) : "nunca feito",
      lastLoadKg: Object.fromEntries(
        plan.exercises.map(({ exercise }) => [exercise.id, topLoad.get(exercise.id) || null]),
      ),
    };
  });

  return { plans, nextPlanId: nextInSequence(plans, sessionsResult.data) };
}

/** A ficha seguinte (pela ordem) à da última sessão concluída; sem histórico, a primeira. */
function nextInSequence(plans: WorkoutPlan[], sessionsNewestFirst: { plan_id: number | null }[]) {
  if (plans.length === 0) return null;
  const lastSession = sessionsNewestFirst.find((session) =>
    plans.some((plan) => plan.id === session.plan_id),
  );
  if (!lastSession) return plans[0].id;
  const index = plans.findIndex((plan) => plan.id === lastSession.plan_id);
  return plans[(index + 1) % plans.length].id;
}

/** Id de ficha vindo da URL; null se não for um inteiro positivo. */
export function parsePlanId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Ficha do usuário para edição; null se não existir ou for de outro usuário. */
export async function getPlan(planId: number): Promise<WorkoutPlan | null> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const { data, error } = await supabase
    .from("workout_plans")
    .select(PLAN_SELECT)
    .eq("id", planId)
    .eq("user_id", user.id)
    .order("position", { referencedTable: "plan_exercises" })
    .maybeSingle();
  if (error) throw error;
  return data ? toWorkoutPlan(data) : null;
}

/** Letra que uma ficha nova vai receber (a mesma regra da função save_workout_plan). */
export async function getNextPlanCode(): Promise<string | null> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const { data, error } = await supabase.from("workout_plans").select("code").eq("user_id", user.id);
  if (error) throw error;
  const used = new Set(data.map((plan) => plan.code));
  return PLAN_CODES.find((code) => !used.has(code)) ?? null;
}

/** Exercícios globais e do usuário (RLS), ordenados por grupo muscular e nome. */
export async function getExerciseLibrary(): Promise<{
  exercises: LibraryExercise[];
  muscleGroups: string[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment, weight_increment");
  if (error) throw error;

  const exercises = data.map(toLibraryExercise).sort(
    (a, b) =>
      groupRank(a.muscleGroup) - groupRank(b.muscleGroup) ||
      a.muscleGroup.localeCompare(b.muscleGroup, "pt-BR") ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  const muscleGroups = [...new Set(exercises.map((exercise) => exercise.muscleGroup))];
  return { exercises, muscleGroups };
}

function groupRank(group: string) {
  const index = MUSCLE_GROUP_ORDER.indexOf(group);
  return index === -1 ? MUSCLE_GROUP_ORDER.length : index;
}

type ExerciseRow = {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string | null;
  weight_increment: number;
};

type PlanRow = {
  id: number;
  code: string;
  title: string;
  plan_exercises: {
    target_sets: number;
    target_reps: number;
    rest_seconds: number;
    exercises: ExerciseRow;
  }[];
};

export function toLibraryExercise(row: ExerciseRow): LibraryExercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    weightIncrement: row.weight_increment,
  };
}

function toWorkoutPlan(row: PlanRow): WorkoutPlan {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    exercises: row.plan_exercises.map((item) => ({
      exercise: toLibraryExercise(item.exercises),
      targetSets: item.target_sets,
      targetReps: item.target_reps,
      restSeconds: item.rest_seconds,
    })),
  };
}
