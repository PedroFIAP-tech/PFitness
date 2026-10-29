"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import type { Achievement } from "@/lib/achievements";
import { formatShortDate } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import { AchievementMedal } from "./achievement-medal";

export const progressLabel = (achievement: Achievement) =>
  `${formatNumber(Math.min(achievement.progress, achievement.target), 1)}/${formatNumber(achievement.target)}`;

/**
 * Detalhe da conquista com a medalha 3D. Com `celebrate` (conquista nova), a
 * medalha entra girando e, se forem várias, "Próxima" passa para a seguinte.
 */
export function AchievementSheet({
  queue,
  start = 0,
  celebrate = false,
  onClose,
}: {
  queue: Achievement[];
  start?: number;
  celebrate?: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const achievement = queue[index];
  if (!achievement) return null;
  const many = queue.length > 1;

  return (
    <Sheet
      open
      onClose={onClose}
      title={achievement.name}
      eyebrow={celebrate ? `Conquista nova${many ? ` · ${index + 1} de ${queue.length}` : ""}` : undefined}
      action={
        index < queue.length - 1 && (
          <button type="button" onClick={() => setIndex(index + 1)} className="flex h-12 shrink-0 items-center">
            <span className="flex h-9 items-center rounded-xl border border-lime/50 bg-lime/10 px-3.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-lime transition-transform duration-150 active:scale-95">
              PRÓXIMA
            </span>
          </button>
        )
      }
      stepKey={many ? achievement.id : undefined}
    >
      <div className="flex flex-col items-center gap-4 pb-2 text-center">
        <AchievementMedal key={achievement.id} achievement={achievement} celebrate={celebrate} />
        <p className="text-sm leading-relaxed text-fg/70">{achievement.description}</p>
        {achievement.unlockedAt ? (
          <span className="font-mono text-xs font-semibold tracking-[0.1em] text-lime">
            DESBLOQUEADA EM {formatShortDate(new Date(achievement.unlockedAt)).toUpperCase()}
          </span>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <div
              role="progressbar"
              aria-valuenow={Math.min(achievement.progress, achievement.target)}
              aria-valuemax={achievement.target}
              className="h-2 overflow-hidden rounded-sm bg-white/6"
            >
              <div
                className="h-full origin-left animate-bar-x rounded-sm bg-lime shadow-[0_0_10px_oklch(0.9_0.2_128/0.6)]"
                style={{
                  width: `${Math.min(100, (achievement.progress / (achievement.target || 1)) * 100).toFixed(1)}%`,
                }}
              />
            </div>
            <span className="font-mono text-xs text-fg/55">{progressLabel(achievement)}</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
