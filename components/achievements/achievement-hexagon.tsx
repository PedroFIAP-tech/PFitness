import { cn } from "@/lib/cn";
import type { Achievement } from "@/lib/achievements";

export const HEXAGON = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";

export const HEXAGON_SIZE = { md: "h-18 w-16", lg: "h-28 w-24" } as const;

/**
 * Selo da conquista (hexágono): borda em gradiente lime, miolo radial e brilho
 * quando desbloqueada; `white/10` e texto apagado quando bloqueada.
 * `side="back"` é o verso da medalha 3D: o mesmo hexágono com o nome.
 */
export function AchievementHexagon({
  achievement,
  size = "md",
  side = "front",
}: {
  achievement: Achievement;
  size?: keyof typeof HEXAGON_SIZE;
  side?: "front" | "back";
}) {
  const on = achievement.unlockedAt !== null;
  return (
    <div className={cn("relative", HEXAGON_SIZE[size], on && "drop-shadow-[0_0_12px_oklch(0.9_0.2_128/0.45)]")}>
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
        {side === "back" ? (
          <span
            className={cn(
              "line-clamp-3 px-3 text-center font-display text-[15px] leading-tight font-bold",
              on ? "text-lime" : "text-fg/35",
            )}
          >
            {achievement.name}
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
