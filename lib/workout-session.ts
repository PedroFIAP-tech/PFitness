import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LoggedSet, WorkoutExercise, WorkoutSessionData } from "@/lib/workout-model";
import { NEW_EXERCISE_DEFAULTS } from "@/lib/workout-rules";
import { getPlan, toLibraryExercise, type LibraryExercise, type WorkoutPlan } from "@/lib/workouts";

export type ActiveSession = {
  id: number;
  /** null se a ficha foi excluída durante o treino */
  planId: number | null;
  planCode: string | null;
  title: string;
  startedAt: string;
  setsDone: number;
  setsTotal: number;
};

/** O treino em andamento do usuário (há no máximo um, garantido por índice no banco). */
export const getActiveSession = cache(async (): Promise<ActiveSession | null> => {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      "id, plan_id, plan_title, started_at, workout_plans(code, plan_exercises(target_sets)), session_sets(status)",
    )
    .eq("user_id", user.id)
    .eq("status", "em_andamento")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const plannedSets = (data.workout_plans?.plan_exercises ?? []).reduce(
    (sum, item) => sum + item.target_sets,
    0,
  );
  return {
    id: data.id,
    planId: data.plan_id,
    planCode: data.workout_plans?.code ?? null,
    title: data.plan_title ?? "Treino",
    startedAt: data.started_at,
    setsDone: data.session_sets.filter((set) => set.status === "concluida").length,
    setsTotal: Math.max(plannedSets, data.session_sets.length),
  };
});

/**
 * Dados da tela /treino/[planId]. `session` só vem quando o treino em andamento
 * é desta ficha; sem ele a tela mostra o botão de começar.
 */
export async function getWorkoutForPlan(planId: number): Promise<{
  plan: WorkoutPlan;
  active: ActiveSession | null;
  session: WorkoutSessionData | null;
} | null> {
  const [plan, active] = await Promise.all([getPlan(planId), getActiveSession()]);
  if (!plan) return null;
  if (!active || active.planId !== planId) return { plan, active, session: null };
  return { plan, active, session: await loadSessionData(active, plan) };
}

async function loadSessionData(active: ActiveSession, plan: WorkoutPlan): Promise<WorkoutSessionData> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const planExerciseIds = plan.exercises.map((item) => item.exercise.id);

  const [setsResult, lastResult, bestsResult] = await Promise.all([
    supabase
      .from("session_sets")
      .select("exercise_id, set_number, weight_kg, reps, status, is_pr")
      .eq("session_id", active.id),
    supabase
      .from("v_exercise_last")
      .select("exercise_id, set_number, weight_kg, reps")
      .eq("user_id", user.id)
      .in("exercise_id", planExerciseIds),
    supabase.rpc("exercise_bests_before", { p_session_id: active.id }),
  ]);
  if (setsResult.error) throw setsResult.error;
  if (lastResult.error) throw lastResult.error;
  if (bestsResult.error) throw bestsResult.error;

  const loggedSets: LoggedSet[] = setsResult.data.map((set) => ({
    exerciseId: set.exercise_id,
    setNumber: set.set_number,
    weightKg: set.weight_kg,
    reps: set.reps,
    status: set.status,
    isPr: set.is_pr,
  }));

  // Exercícios com séries gravadas que saíram da ficha durante o treino continuam na tela
  const extraIds = [...new Set(loggedSets.map((set) => set.exerciseId))].filter(
    (id) => !planExerciseIds.includes(id),
  );
  const extras = extraIds.length ? await getExercises(extraIds) : [];

  const lastSets = new Map<number, WorkoutExercise["lastSets"]>();
  for (const row of lastResult.data) {
    if (row.exercise_id === null || row.set_number === null) continue;
    const list = lastSets.get(row.exercise_id) ?? [];
    list.push({ setNumber: row.set_number, weightKg: row.weight_kg ?? 0, reps: row.reps ?? 0 });
    lastSets.set(row.exercise_id, list);
  }
  for (const list of lastSets.values()) list.sort((a, b) => a.setNumber - b.setNumber);

  const bests = new Map(bestsResult.data.map((row) => [row.exercise_id, row.best_kg]));

  const toWorkoutExercise = (
    exercise: LibraryExercise,
    plan: { targetSets: number; targetReps: number; restSeconds: number; notes: string | null },
  ): WorkoutExercise => ({
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    equipment: exercise.equipment,
    weightIncrement: exercise.weightIncrement,
    ...plan,
    lastSets: lastSets.get(exercise.id) ?? [],
    historicBestKg: bests.get(exercise.id) || null,
  });

  // A mesma série é identificada por (exercício, nº): um exercício repetido na ficha aparece uma vez
  const seen = new Set<number>();
  const exercises = plan.exercises
    .filter(({ exercise }) => !seen.has(exercise.id) && seen.add(exercise.id))
    .map(({ exercise, targetSets, targetReps, restSeconds, notes }) =>
      toWorkoutExercise(exercise, { targetSets, targetReps, restSeconds, notes }),
    );
  for (const exercise of extras) {
    exercises.push(
      toWorkoutExercise(exercise, {
        targetSets: 0,
        targetReps: NEW_EXERCISE_DEFAULTS.targetReps,
        restSeconds: NEW_EXERCISE_DEFAULTS.restSeconds,
        notes: null,
      }),
    );
  }

  return {
    sessionId: active.id,
    planId: plan.id,
    planCode: plan.code,
    title: active.title,
    startedAt: active.startedAt,
    exercises,
    loggedSets,
  };
}

async function getExercises(ids: number[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment, weight_increment")
    .in("id", ids);
  if (error) throw error;
  return data.map(toLibraryExercise);
}

export type WorkoutSummary = {
  sessionId: number;
  planCode: string | null;
  title: string;
  durationSeconds: number;
  volumeKg: number;
  setsDone: number;
  setsTotal: number;
  prs: { exerciseName: string; weightKg: number; reps: number; gainKg: number }[];
  points: { sets: number; setPoints: number; prs: number; prPoints: number; finishPoints: number; total: number };
  streak: number;
};

/** Resumo de um treino concluído do usuário; null se não existir ou não estiver concluído. */
export async function getWorkoutSummary(sessionId: number): Promise<WorkoutSummary | null> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .select(
      "id, plan_title, started_at, finished_at, workout_plans(code, plan_exercises(exercise_id, target_sets)), session_sets(id, exercise_id, set_number, weight_kg, reps, status, is_pr, completed_at, exercises(name))",
    )
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("status", "concluido")
    .maybeSingle();
  if (error) throw error;
  if (!session?.finished_at) return null;

  const setIds = session.session_sets.map((set) => set.id);
  const [bestsResult, setPointsResult, finishPointsResult, streakResult] = await Promise.all([
    supabase.rpc("exercise_bests_before", { p_session_id: sessionId }),
    setIds.length
      ? supabase
          .from("point_events")
          .select("kind, points")
          .eq("user_id", user.id)
          .in("kind", ["serie", "pr"])
          .in("ref_id", setIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("point_events")
      .select("points")
      .eq("user_id", user.id)
      .eq("kind", "treino_concluido")
      .eq("ref_id", sessionId),
    supabase.rpc("current_streak", { p_user: user.id }),
  ]);
  if (bestsResult.error) throw bestsResult.error;
  if (setPointsResult.error) throw setPointsResult.error;
  if (finishPointsResult.error) throw finishPointsResult.error;
  if (streakResult.error) throw streakResult.error;

  const done = session.session_sets
    .filter((set) => set.status === "concluida")
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at));

  // Ganho de cada PR: sobre a melhor carga até aquele momento (histórico + séries anteriores)
  const runningBest = new Map(bestsResult.data.map((row) => [row.exercise_id, row.best_kg]));
  const prs: WorkoutSummary["prs"] = [];
  for (const set of done) {
    const before = runningBest.get(set.exercise_id) ?? 0;
    if (set.is_pr) {
      prs.push({
        exerciseName: set.exercises.name,
        weightKg: set.weight_kg,
        reps: set.reps,
        gainKg: set.weight_kg - before,
      });
    }
    if (set.reps > 0) runningBest.set(set.exercise_id, Math.max(before, set.weight_kg));
  }

  // Total planejado: séries alvo da ficha (ou as gravadas, se passaram do alvo)
  const recorded = new Map<number, number>();
  for (const set of session.session_sets) {
    recorded.set(set.exercise_id, Math.max(recorded.get(set.exercise_id) ?? 0, set.set_number));
  }
  for (const item of session.workout_plans?.plan_exercises ?? []) {
    recorded.set(item.exercise_id, Math.max(recorded.get(item.exercise_id) ?? 0, item.target_sets));
  }
  const setsTotal = [...recorded.values()].reduce((sum, count) => sum + count, 0);

  const sumPoints = (kind: string) =>
    setPointsResult.data.filter((event) => event.kind === kind).reduce((sum, event) => sum + event.points, 0);
  const countPoints = (kind: string) => setPointsResult.data.filter((event) => event.kind === kind).length;
  const setPoints = sumPoints("serie");
  const prPoints = sumPoints("pr");
  const finishPoints = finishPointsResult.data.reduce((sum, event) => sum + event.points, 0);

  return {
    sessionId,
    planCode: session.workout_plans?.code ?? null,
    title: session.plan_title ?? "Treino",
    durationSeconds: Math.max(
      0,
      Math.round((Date.parse(session.finished_at) - Date.parse(session.started_at)) / 1000),
    ),
    volumeKg: done.reduce((sum, set) => sum + set.weight_kg * set.reps, 0),
    setsDone: done.length,
    setsTotal,
    prs,
    points: {
      sets: countPoints("serie"),
      setPoints,
      prs: countPoints("pr"),
      prPoints,
      finishPoints,
      total: setPoints + prPoints + finishPoints,
    },
    streak: streakResult.data,
  };
}
