import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { macroStatus, type Nutrients } from "@/lib/diet-model";
import { formatNumber } from "@/lib/format";

/** Cores dos macros, as mesmas do sheet de quantidade. */
export const MACROS = [
  { key: "protein", name: "Proteína", bar: "bg-lime shadow-[0_0_10px_oklch(0.9_0.2_128/0.55)]", text: "text-lime" },
  { key: "carbs", name: "Carbo", bar: "bg-cyan shadow-[0_0_10px_oklch(0.86_0.14_215/0.55)]", text: "text-cyan" },
  { key: "fat", name: "Gordura", bar: "bg-amber shadow-[0_0_10px_oklch(0.86_0.15_70/0.55)]", text: "text-amber" },
] as const satisfies { key: keyof Nutrients; name: string; bar: string; text: string }[];

export const percentOf = (value: number, goal: number) => (goal > 0 ? Math.min(100, (value / goal) * 100) : 0);

/** Card do dia (tela 08): kcal consumidas, barra segmentada e macros. */
export function DaySummary({ totals, goals }: { totals: Nutrients; goals: Nutrients }) {
  const over = totals.kcal > goals.kcal;

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50">CONSUMIDO</span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-[42px] leading-none font-semibold tracking-[-0.05em] tabular-nums">
              {formatNumber(totals.kcal)}
            </span>
            <span className="font-mono text-[13px] font-medium text-fg/50">/ {formatNumber(goals.kcal)} kcal</span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50">
            {over ? "ACIMA" : "RESTAM"}
          </span>
          <span className={cn("font-mono text-xl leading-none font-semibold tabular-nums", over ? "text-amber" : "text-lime")}>
            {formatNumber(Math.abs(goals.kcal - totals.kcal))}
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Calorias do dia"
        aria-valuenow={Math.round(totals.kcal)}
        aria-valuemax={goals.kcal}
        className="relative h-3 overflow-hidden rounded-md bg-white/6"
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 origin-left animate-bar-x rounded-md transition-[width] duration-800 ease-snap",
            over ? "bg-amber shadow-[0_0_14px_oklch(0.86_0.15_70/0.7)]" : "bg-lime shadow-[0_0_14px_oklch(0.9_0.2_128/0.7)]",
          )}
          style={{ width: `${percentOf(totals.kcal, goals.kcal).toFixed(1)}%` }}
        />
        <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_10px,#0a0d10_10px_12px)]" />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/7 pt-3.5">
        {MACROS.map((macro, index) => (
          <div key={macro.key} className="flex flex-col gap-1.75">
            <div className="flex items-baseline gap-2">
              <span aria-hidden className={cn("size-2 rounded-full", macro.bar)} />
              <span className="flex-1 text-[13px] font-medium">{macro.name}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">{formatNumber(totals[macro.key])}</span>
              <span className="font-mono text-xs font-medium text-fg/50">/ {goals[macro.key]} g</span>
            </div>
            <div className="relative h-1.5 rounded-[3px] bg-white/6">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 origin-left animate-bar-x rounded-[3px] transition-[width] duration-800 ease-snap",
                  macro.bar,
                )}
                style={{
                  width: `${percentOf(totals[macro.key], goals[macro.key]).toFixed(1)}%`,
                  animationDelay: `${0.1 + index * 0.1}s`,
                }}
              />
            </div>
            <span className="font-mono text-[11px] text-fg/45">{macroStatus(totals[macro.key], goals[macro.key])}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
