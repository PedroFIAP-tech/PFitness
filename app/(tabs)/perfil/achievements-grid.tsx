"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import type { Achievement } from "@/lib/profile-data";

const HEXAGON = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";

const progressLabel = (achievement: Achievement) =>
  `${formatNumber(Math.min(achievement.progress, achievement.target), 1)}/${formatNumber(achievement.target)}`;

/** Conquistas (tela 11): hexágonos desbloqueados e bloqueados com progresso. */
export function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = achievements.find((achievement) => achievement.id === openId) ?? null;
  const unlocked = achievements.filter((achievement) => achievement.unlockedAt).length;

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
              onClick={() => setOpenId(achievement.id)}
              aria-label={`${achievement.name}: ${achievement.unlockedAt ? "desbloqueada" : progressLabel(achievement)}`}
              className="flex w-full flex-col items-center gap-1.5 transition-transform duration-150 active:scale-[.94]"
            >
              <Hexagon achievement={achievement} />
              <span className="line-clamp-1 text-center text-xs font-medium">{achievement.name}</span>
              <span className="font-mono text-[10px] text-fg/45">
                {achievement.unlockedAt ? formatShortDate(new Date(achievement.unlockedAt)) : progressLabel(achievement)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open !== null} onClose={() => setOpenId(null)} title={open?.name ?? ""}>
        {open && (
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <Hexagon achievement={open} size="lg" />
            <p className="text-sm leading-relaxed text-fg/70">{open.description}</p>
            {open.unlockedAt ? (
              <span className="font-mono text-xs font-semibold tracking-[0.1em] text-lime">
                DESBLOQUEADA EM {formatShortDate(new Date(open.unlockedAt)).toUpperCase()}
              </span>
            ) : (
              <div className="flex w-full flex-col gap-2">
                <div
                  role="progressbar"
                  aria-valuenow={Math.min(open.progress, open.target)}
                  aria-valuemax={open.target}
                  className="h-2 overflow-hidden rounded-sm bg-white/6"
                >
                  <div
                    className="h-full origin-left animate-bar-x rounded-sm bg-lime shadow-[0_0_10px_oklch(0.9_0.2_128/0.6)]"
                    style={{ width: `${Math.min(100, (open.progress / (open.target || 1)) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-fg/55">{progressLabel(open)}</span>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function Hexagon({ achievement, size = "md" }: { achievement: Achievement; size?: "md" | "lg" }) {
  const on = achievement.unlockedAt !== null;
  return (
    <div
      className={cn(
        "relative",
        size === "lg" ? "h-28 w-24" : "h-18 w-16",
        on && "drop-shadow-[0_0_12px_oklch(0.9_0.2_128/0.45)]",
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          on
            ? "bg-[linear-gradient(160deg,var(--color-lime),oklch(0.9_0.2_128/0.2)_55%,oklch(0.9_0.2_128/0.85))]"
            : "bg-white/10",
        )}
        style={{ clipPath: HEXAGON }}
      />
      <div
        className={cn(
          "absolute inset-0.75 flex flex-col items-center justify-center gap-0.5",
          on ? "bg-[radial-gradient(circle_at_50%_30%,oklch(0.9_0.2_128/0.28),#0a0d10_72%)]" : "bg-[#0c0f12]",
        )}
        style={{ clipPath: HEXAGON }}
      >
        <span
          className={cn(
            "font-display leading-none font-bold",
            size === "lg" ? "text-[32px]" : "text-xl",
            on ? "text-lime" : "text-fg/35",
          )}
        >
          {achievement.badgeCode}
        </span>
        <span
          className={cn(
            "font-mono leading-none font-semibold tracking-[0.12em]",
            size === "lg" ? "text-[9px]" : "text-[7px]",
            on ? "text-lime/75" : "text-fg/30",
          )}
        >
          {achievement.badgeUnit}
        </span>
      </div>
    </div>
  );
}
