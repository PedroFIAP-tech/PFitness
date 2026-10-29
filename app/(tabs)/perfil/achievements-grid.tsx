"use client";

import { useEffect, useRef, useState } from "react";
import { AchievementHexagon } from "@/components/achievements/achievement-hexagon";
import { AchievementSheet, progressLabel } from "@/components/achievements/achievement-sheet";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Achievement } from "@/lib/achievements";
import { formatShortDate } from "@/lib/date";
import { markAchievementsSeen } from "./actions";

/** Espera a tela entrar antes de abrir a conquista nova. */
const NEW_ACHIEVEMENT_DELAY_MS = 450;

/** Conquistas (tela 11): hexágonos desbloqueados e bloqueados com progresso. */
export function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const [sheet, setSheet] = useState<{ queue: Achievement[]; celebrate: boolean } | null>(null);
  const unlocked = achievements.filter((achievement) => achievement.unlockedAt).length;

  // Desbloqueada fora do resumo do treino (ex.: dieta): abre girando e deixa de ser nova
  const newKey = achievements
    .filter((achievement) => achievement.isNew)
    .map((achievement) => achievement.id)
    .join(",");
  const shownKey = useRef("");
  useEffect(() => {
    if (!newKey || shownKey.current === newKey) return;
    const timeout = setTimeout(() => {
      shownKey.current = newKey;
      setSheet({ queue: achievements.filter((achievement) => achievement.isNew), celebrate: true });
      void markAchievementsSeen(newKey.split(","));
    }, NEW_ACHIEVEMENT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [newKey, achievements]);

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <Label>Conquistas</Label>
        <span className="font-mono text-xs font-semibold text-lime">
          {unlocked}/{achievements.length}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
        {achievements.map((achievement) => (
          <li key={achievement.id}>
            <button
              type="button"
              onClick={() => setSheet({ queue: [achievement], celebrate: false })}
              aria-label={`${achievement.name}: ${achievement.unlockedAt ? "desbloqueada" : progressLabel(achievement)}`}
              className="flex w-full flex-col items-center gap-1.5 transition-transform duration-150 active:scale-[.94]"
            >
              <AchievementHexagon achievement={achievement} />
              <span className="line-clamp-1 text-center text-xs font-medium">{achievement.name}</span>
              <span className="font-mono text-[10px] text-fg/45">
                {achievement.unlockedAt ? formatShortDate(new Date(achievement.unlockedAt)) : progressLabel(achievement)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {sheet && (
        <AchievementSheet
          key={sheet.queue.map((achievement) => achievement.id).join(",")}
          queue={sheet.queue}
          celebrate={sheet.celebrate}
          onClose={() => setSheet(null)}
        />
      )}
    </Card>
  );
}
