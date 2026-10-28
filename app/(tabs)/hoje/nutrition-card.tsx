import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { ChevronRightIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import type { Nutrients } from "@/lib/diet-model";
import { formatNumber } from "@/lib/format";

const GAUGE_ARC = "M30 146 A110 110 0 0 1 250 146";
const GAUGE_TICKS = "M16 146 A124 124 0 0 1 264 146";
const RING = "M32 5 a27 27 0 1 1 0 54 a27 27 0 1 1 0 -54";

const MACRO_RINGS = [
  { key: "protein", name: "Proteína", stroke: "stroke-lime", text: "text-lime", glow: "oklch(0.9 0.2 128 / .55)" },
  { key: "carbs", name: "Carbo", stroke: "stroke-cyan", text: "text-cyan", glow: "oklch(0.86 0.14 215 / .55)" },
  { key: "fat", name: "Gordura", stroke: "stroke-amber", text: "text-amber", glow: "oklch(0.86 0.15 70 / .55)" },
] as const satisfies { key: keyof Nutrients; name: string; stroke: string; text: string; glow: string }[];

/** Quanto do traço fica apagado (stroke-dashoffset com pathLength=100). */
const dashOffset = (value: number, goal: number) => (100 - (goal > 0 ? Math.min(100, (value / goal) * 100) : 0)).toFixed(2);

/** Alimentação de hoje: gauge de kcal e anéis dos macros. */
export function NutritionCard({ totals, goals }: { totals: Nutrients; goals: Nutrients }) {
  const over = totals.kcal > goals.kcal;
  const left = Math.round(Math.abs(goals.kcal - totals.kcal));

  return (
    <Card className="pb-4.5">
      <div className="flex items-center justify-between">
        <Label>Alimentação · hoje</Label>
        <Link href="/dieta" className="-my-2 -mr-1 flex h-12 items-center gap-1 pl-2.5 text-xs font-medium text-lime">
          Ver refeições
          <ChevronRightIcon className="size-3.5" />
        </Link>
      </div>

      <div className="relative mt-1 h-37.5">
        <svg
          viewBox="0 0 280 156"
          aria-hidden
          className="absolute top-0 left-1/2 h-39 w-70 -translate-x-1/2 overflow-visible"
        >
          <path d={GAUGE_TICKS} pathLength={100} fill="none" strokeWidth={7} strokeDasharray=".25 4.75" className="stroke-fg/22" />
          <path d={GAUGE_ARC} fill="none" strokeWidth={14} strokeLinecap="round" className="stroke-white/7" />
          <path
            d={GAUGE_ARC}
            pathLength={100}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={100}
            className={cn(
              "animate-ring transition-[stroke-dashoffset] duration-900 ease-snap",
              over
                ? "stroke-amber drop-shadow-[0_0_7px_oklch(0.86_0.15_70/0.6)]"
                : "stroke-lime drop-shadow-[0_0_7px_oklch(0.9_0.2_128/0.6)]",
            )}
            style={{ strokeDashoffset: dashOffset(totals.kcal, goals.kcal) }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0.5 flex flex-col items-center gap-1.5">
          <CountUp value={totals.kcal} className="font-mono text-[44px] leading-none font-semibold tracking-[-0.04em] tabular-nums" />
          <Label>de {formatNumber(goals.kcal)} kcal</Label>
          <span className={cn("text-[13px] font-medium", over ? "text-amber" : "text-lime")}>
            {formatNumber(left)} {over ? "acima da meta" : "restantes"}
          </span>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2">
        {MACRO_RINGS.map((macro, index) => (
          <li
            key={macro.key}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.025] px-1 py-3"
          >
            <div className="relative size-16">
              <svg viewBox="0 0 64 64" aria-hidden className="size-16 overflow-visible">
                <path d={RING} fill="none" strokeWidth={6} className="stroke-white/7" />
                <path
                  d={RING}
                  pathLength={100}
                  fill="none"
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeDasharray={100}
                  className={cn("animate-ring transition-[stroke-dashoffset] duration-900 ease-snap", macro.stroke)}
                  style={{
                    strokeDashoffset: dashOffset(totals[macro.key], goals[macro.key]),
                    animationDelay: `${0.15 + index * 0.12}s`,
                    filter: `drop-shadow(0 0 5px ${macro.glow})`,
                  }}
                />
              </svg>
              <CountUp
                value={totals[macro.key]}
                delayMs={150 + index * 120}
                className="absolute inset-0 grid place-items-center font-mono text-base font-semibold tracking-[-0.03em] tabular-nums"
              />
            </div>
            <div className="flex flex-col items-center gap-0.75">
              <span className={cn("text-xs font-semibold", macro.text)}>{macro.name}</span>
              <span className="font-mono text-[11px] font-medium text-fg/50">/ {goals[macro.key]} g</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
