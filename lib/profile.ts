import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables, TablesInsert } from "@/types/database";
import { todayInAppTimeZone } from "./date";

export type Profile = Tables<"profiles">;
export type GoalType = Enums<"goal_type">;

export const GOAL_LABELS: Record<GoalType, string> = {
  ganhar_massa: "Ganhar massa",
  perder_gordura: "Perder gordura",
  manter: "Manter",
};

/**
 * Metas iniciais: objetivo "manter" do protótipo (profiles.goal nasce como 'manter').
 * O onboarding vai trocar por metas calculadas a partir de peso e altura.
 */
const DEFAULT_DAILY_GOALS = {
  kcal: 2300,
  protein_g: 150,
  carbs_g: 270,
  fat_g: 70,
} satisfies Omit<TablesInsert<"daily_goals">, "user_id">;

const UNIQUE_VIOLATION = "23505";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: unknown };
};

/**
 * Garante que o usuário tem perfil e metas diárias, criando o que faltar.
 * Idempotente: roda no login, no callback de email e como rede de segurança
 * ao carregar o perfil.
 */
export async function ensureProfile(
  supabase: SupabaseClient<Database>,
  user: AuthUser,
): Promise<Profile> {
  const [profileResult, goalsResult] = await Promise.all([
    supabase.from("profiles").select().eq("id", user.id).maybeSingle(),
    supabase.from("daily_goals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (goalsResult.error) throw goalsResult.error;

  const profile = profileResult.data ?? (await createProfile(supabase, user));

  if (goalsResult.count === 0) {
    const { error } = await supabase
      .from("daily_goals")
      .upsert(
        { user_id: user.id, valid_from: todayInAppTimeZone(), ...DEFAULT_DAILY_GOALS },
        { onConflict: "user_id,valid_from", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  return profile;
}

async function createProfile(supabase: SupabaseClient<Database>, user: AuthUser) {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: user.id, name: displayName(user) })
    .select()
    .single();
  if (!error) return data;
  if (error.code !== UNIQUE_VIOLATION) throw error;

  // Outra requisição criou o perfil ao mesmo tempo
  const existing = await supabase.from("profiles").select().eq("id", user.id).single();
  if (existing.error) throw existing.error;
  return existing.data;
}

function displayName(user: AuthUser) {
  const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  return name || user.email?.split("@")[0] || "Atleta";
}
