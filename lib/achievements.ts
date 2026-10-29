import "server-only";
import { createClient } from "@/lib/supabase/server";

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
  /** Desbloqueada e o usuário ainda não viu a medalha girar */
  isNew: boolean;
};

/**
 * Sincroniza as conquistas (grava as que bateram a meta) e devolve o catálogo
 * com o progresso do usuário: desbloqueadas primeiro (mais recentes antes),
 * depois as mais perto de sair.
 */
export async function syncAchievements(): Promise<Achievement[]> {
  const supabase = await createClient();
  const [progressResult, catalogResult] = await Promise.all([
    supabase.rpc("sync_achievements"),
    supabase.from("achievements").select("id, name, description, badge_code, badge_unit"),
  ]);
  if (progressResult.error) throw progressResult.error;
  if (catalogResult.error) throw catalogResult.error;

  const progress = new Map(progressResult.data.map((row) => [row.achievement_id, row]));
  return catalogResult.data
    .map((row): Achievement => {
      const state = progress.get(row.id);
      const unlockedAt = state?.unlocked_at ?? null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        badgeCode: row.badge_code,
        badgeUnit: row.badge_unit,
        progress: Number(state?.progress ?? 0),
        target: Number(state?.target ?? 0),
        unlockedAt,
        // Antes da migration de seen_at o campo não vem: nada conta como novo
        isNew: unlockedAt !== null && state?.seen_at === null,
      };
    })
    .sort((a, b) =>
      a.unlockedAt && b.unlockedAt
        ? b.unlockedAt.localeCompare(a.unlockedAt)
        : a.unlockedAt
          ? -1
          : b.unlockedAt
            ? 1
            : b.progress / (b.target || 1) - a.progress / (a.target || 1),
    );
}
