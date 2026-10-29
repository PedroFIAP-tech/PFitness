"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { PlusIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { PillToggle } from "@/components/ui/pill-toggle";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { formatKg, formatNumber } from "@/lib/format";
import {
  LOAD_WEEKS,
  buildLoadSeries,
  formatShortDay,
  rankLoadExercises,
  recentWeekStarts,
  type LoadExercise,
  type LoadMetric,
} from "@/lib/progress-model";

const CHIP_COUNT = 4;

const METRICS = [
  { value: "max", label: "kg máx." },
  { value: "e1rm", label: "1RM est." },
] as const;

/** Evolução de carga (tela 10): maior carga ou 1RM estimado por semana, 12 semanas. */
export function LoadCard({ loads, today }: { loads: LoadExercise[]; today: string }) {
  const weeks = recentWeekStarts(today, LOAD_WEEKS);
  const ranked = rankLoadExercises(loads, weeks);
  const [selectedId, setSelectedId] = useState<number | null>(ranked[0]?.id ?? null);
  const [metric, setMetric] = useState<LoadMetric>("max");
  const [picking, setPicking] = useState(false);
  const [barIndex, setBarIndex] = useState<number | null>(null);

  if (loads.length === 0) {
    return (
      <Card>
        <Label>Evolução de carga</Label>
        <p className="mt-3 text-sm text-fg/60">Conclua treinos com carga para ver a evolução semana a semana.</p>
      </Card>
    );
  }

  const exercise = loads.find((item) => item.id === selectedId) ?? ranked[0];
  // Os 4 mais frequentes; um escolhido no "+" entra no lugar do último
  const chips = ranked.slice(0, CHIP_COUNT).some((item) => item.id === exercise.id)
    ? ranked.slice(0, CHIP_COUNT)
    : [...ranked.slice(0, CHIP_COUNT - 1), exercise];
  const series = buildLoadSeries(exercise, weeks, metric);
  const selectedBar = barIndex !== null ? series.bars[barIndex] : null;
  const shownValue = selectedBar?.value ?? series.latest;

  const choose = (id: number) => {
    setSelectedId(id);
    setBarIndex(null);
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <Label>Evolução de carga</Label>
        <PillToggle
          aria-label="Métrica"
          options={METRICS}
          value={metric}
          onChange={(next) => {
            setMetric(next);
            setBarIndex(null);
          }}
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {chips.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === exercise.id}
            onClick={() => choose(item.id)}
            className="flex h-12 shrink-0 items-center"
          >
            <span
              className={cn(
                "flex h-8.5 items-center rounded-[11px] border px-3.25 text-[13px] font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 active:scale-95",
                item.id === exercise.id ? "border-lime/60 bg-lime/14 text-lime" : "border-white/8 bg-white/4 text-fg/75",
              )}
            >
              {item.name}
            </span>
          </button>
        ))}
        <button type="button" aria-label="Escolher outro exercício" onClick={() => setPicking(true)} className="flex h-12 shrink-0 items-center">
          <span className="grid size-8.5 place-items-center rounded-[11px] border border-white/8 bg-white/4 text-fg/75">
            <PlusIcon className="size-4" />
          </span>
        </button>
      </div>

      <div className="mt-3.5 flex items-baseline gap-2.5">
        <span className="flex items-baseline gap-1.25">
          {shownValue === null ? (
            <span className="font-mono text-4xl leading-none font-semibold text-fg/40">—</span>
          ) : selectedBar ? (
            <span className="font-mono text-4xl leading-none font-semibold tracking-[-0.05em] tabular-nums">{formatKg(shownValue)}</span>
          ) : (
            <CountUp
              key={`${exercise.id}-${metric}`}
              value={shownValue}
              decimals={1}
              className="font-mono text-4xl leading-none font-semibold tracking-[-0.05em] tabular-nums"
            />
          )}
          <span className="font-mono text-[13px] font-medium text-fg/50">{metric === "max" ? "kg máx." : "kg 1RM"}</span>
        </span>
        {selectedBar ? (
          <span className="ml-auto font-mono text-xs text-fg/55">sem. de {formatShortDay(selectedBar.weekStart)}</span>
        ) : (
          series.delta !== null && (
            <>
              <span className="ml-auto font-mono text-sm font-semibold text-lime">
                {series.delta > 0 ? "+" : series.delta < 0 ? "−" : ""}
                {formatNumber(Math.abs(series.delta), 1)} kg
              </span>
              <span className="text-[11px] text-fg/50">{LOAD_WEEKS} sem.</span>
            </>
          )
        )}
      </div>

      <ol aria-label={`${exercise.name}, ${metric === "max" ? "carga máxima" : "1RM estimado"} por semana`} className="mt-3.5 flex h-32 items-end gap-1.25">
        {series.bars.map((bar, index) => (
          <li key={`${exercise.id}-${metric}-${bar.weekStart}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.25">
            <span className="h-2.5 font-mono text-[9.5px] leading-none font-semibold whitespace-nowrap text-lime">{bar.label}</span>
            <button
              type="button"
              disabled={bar.value === null}
              aria-label={`Semana de ${formatShortDay(bar.weekStart)}: ${bar.value === null ? "sem treino" : `${formatKg(bar.value)} kg`}`}
              aria-pressed={barIndex === index}
              onClick={() => setBarIndex(barIndex === index ? null : index)}
              className={cn(
                "w-full origin-bottom animate-bar-y rounded-[5px_5px_2px_2px] transition-[height,background-color] duration-500 ease-snap",
                bar.tone === "current"
                  ? "bg-lime shadow-[0_0_14px_oklch(0.9_0.2_128/0.6)]"
                  : bar.tone === "max"
                    ? "bg-lime/60"
                    : "bg-lime/22",
                bar.value === null && "bg-white/5 shadow-none",
                barIndex === index && "outline outline-1 outline-offset-1 outline-white",
              )}
              style={{ height: bar.value === null ? "3%" : `${bar.height.toFixed(1)}%`, animationDelay: `${index * 0.04}s` }}
            />
          </li>
        ))}
      </ol>
      <div aria-hidden className="mt-2 flex justify-between font-mono text-[10px] font-medium text-fg/40">
        <span>sem 1</span>
        <span>sem 6</span>
        <span>esta sem.</span>
      </div>
      {series.latest === null && (
        <p className="mt-2 text-xs text-fg/55">Sem treinos de {exercise.name} nas últimas {LOAD_WEEKS} semanas.</p>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Exercícios com histórico" size="tall">
        <ul className="flex flex-col gap-1.5">
          {[...loads]
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .map((item) => {
              const best = Math.max(...item.weeks.map((week) => (metric === "max" ? week.maxKg : week.e1rm)));
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === exercise.id}
                    onClick={() => {
                      choose(item.id);
                      setPicking(false);
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3.5 text-left transition-[border-color,transform] duration-150 active:scale-[.98]",
                      item.id === exercise.id ? "border-lime/40 bg-lime/6" : "border-white/7 bg-white/[0.025]",
                    )}
                  >
                    <span className="flex-1 text-[15px] font-medium">{item.name}</span>
                    <span className="font-mono text-xs text-fg/55">melhor {formatKg(best)} kg</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </Sheet>
    </Card>
  );
}
