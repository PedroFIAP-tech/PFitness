import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { XP_PER_LEVEL, type HomeData } from "@/lib/home";

/** Pontos dos últimos 7 dias, nível e XP até o próximo nível. */
export function PointsCard({ week, weekTotal, xp, level }: HomeData["points"]) {
  const max = Math.max(...week.map((day) => day.points));
  const levelStart = (level - 1) * XP_PER_LEVEL;
  const progress = ((xp - levelStart) / XP_PER_LEVEL) * 100;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>Pontos · 7 dias</Label>
        <span className="flex h-6 items-center rounded-[7px] border border-lime/40 bg-lime/8 px-2.25 font-mono text-[11px] font-semibold tracking-[0.08em] text-lime">
          NÍVEL {level}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <CountUp
          value={weekTotal}
          className="font-mono text-[40px] leading-none font-semibold tracking-[-0.04em] text-lime tabular-nums [text-shadow:0_0_20px_oklch(0.9_0.2_128/0.45)]"
        />
        <span className="font-mono text-[13px] font-medium text-fg/55">pts</span>
      </div>

      <ol aria-label="Pontos por dia" className="mt-3.5 grid h-24 grid-cols-7 items-end gap-2">
        {week.map((day, index) => (
          <li
            key={day.day}
            aria-label={`${day.isToday ? "Hoje" : `Dia ${day.dayOfMonth}`}: ${formatNumber(day.points)} pontos`}
            className="flex h-full flex-col items-center justify-end gap-1.5"
          >
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full origin-bottom animate-bar-y rounded-[6px_6px_3px_3px] transition-[height] duration-600 ease-snap",
                  day.isToday ? "bg-lime shadow-[0_0_16px_oklch(0.9_0.2_128/0.55)]" : "bg-lime/26",
                  day.points === 0 && "bg-white/8 shadow-none",
                )}
                style={{
                  height: `${Math.max(5, max > 0 ? (day.points / max) * 100 : 0).toFixed(1)}%`,
                  animationDelay: `${index * 0.05}s`,
                }}
              />
            </div>
            <span className={cn("font-mono text-[10px] leading-none font-medium", day.isToday ? "text-lime" : "text-fg/45")}>
              {day.label}
            </span>
          </li>
        ))}
      </ol>

      {weekTotal === 0 && (
        <p className="mt-3 text-center font-mono text-[11px] text-fg/50">Série +10 · alimento +5 · treino +100</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-fg/65">Rumo ao nível {level + 1}</span>
          <span className="font-mono font-medium text-fg/65">
            {formatNumber(xp)} / {formatNumber(levelStart + XP_PER_LEVEL)} XP
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`XP para o nível ${level + 1}`}
          aria-valuenow={xp - levelStart}
          aria-valuemax={XP_PER_LEVEL}
          className="relative h-2 overflow-hidden rounded-sm bg-white/6"
        >
          <div
            className="absolute inset-y-0 left-0 origin-left animate-bar-x rounded-sm bg-lime shadow-[0_0_12px_oklch(0.9_0.2_128/0.7)] [animation-delay:0.2s]"
            style={{ width: `${progress.toFixed(1)}%` }}
          />
          <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_18px,#05070a_18px_20px)]" />
        </div>
      </div>
    </Card>
  );
}
