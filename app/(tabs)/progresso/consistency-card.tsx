"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { CALENDAR_WEEKS, buildCalendar, calendarInfo, type TrainingDay } from "@/lib/progress-model";

/** Cores dos níveis 0–4 (legenda e células). */
const LEVEL_STYLE = [
  "bg-white/5",
  "bg-lime/20",
  "bg-lime/42",
  "bg-lime/68 shadow-[0_0_5px_oklch(0.9_0.2_128/0.4)]",
  "bg-lime shadow-[0_0_9px_oklch(0.9_0.2_128/0.7)]",
];
const WEEKDAY_LABELS = ["S", "", "Q", "", "S", "", "D"];

type ConsistencyCardProps = {
  days: TrainingDay[];
  today: string;
  streak: { current: number; record: number };
};

/** Consistência (tela 10): totais e calendário de 18 semanas com o volume de cada dia. */
export function ConsistencyCard({ days, today, streak }: ConsistencyCardProps) {
  const calendar = buildCalendar(days, today);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selected = calendar.cells.find((cell) => cell.day === selectedDay) ?? null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>Consistência</Label>
        <span className="font-mono text-[11px] font-medium text-fg/55">{CALENDAR_WEEKS} semanas</span>
      </div>

      <dl className="mt-3 flex gap-4.5">
        <Total label="treinos" value={calendar.trainedDays} accent />
        <Total label="streak atual" value={streak.current} />
        <Total label="recorde" value={streak.record} />
      </dl>

      <div aria-hidden className="mt-4 mb-1.5 ml-4.5 grid grid-cols-18 gap-1 font-mono text-[10px] font-medium text-fg/45">
        {calendar.months.map((month) => (
          <span key={`${month.label}-${month.column}`} style={{ gridColumn: `${month.column + 1} / span 3` }}>
            {month.label}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <div aria-hidden className="grid w-3.5 grid-rows-7 gap-1 font-mono text-[9px] font-medium text-fg/40">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index} className="flex items-center">
              {label}
            </span>
          ))}
        </div>
        <div role="grid" aria-label="Dias de treino" className="grid flex-1 auto-cols-fr grid-flow-col grid-rows-7 gap-1">
          {calendar.cells.map((cell) => (
            <button
              key={cell.day}
              type="button"
              disabled={cell.level < 0}
              aria-label={calendarInfo(cell)}
              aria-pressed={cell.day === selectedDay}
              onClick={() => setSelectedDay(cell.day === selectedDay ? null : cell.day)}
              className={cn(
                "aspect-square rounded-[3px] outline-1 outline-offset-1 transition-transform duration-150 active:scale-75",
                cell.level < 0 ? "opacity-0" : LEVEL_STYLE[cell.level],
                // Só alimentação: contorno fraco, como na faixa da Hoje
                cell.level === 0 && cell.food && "ring-1 ring-lime/30 ring-inset",
                cell.day === selectedDay ? "outline outline-white" : cell.isToday ? "outline outline-lime" : "outline-transparent",
                cell.isToday && cell.level === 0 && cell.day !== selectedDay && "animate-glow-pulse",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2.5">
        <span aria-live="polite" className="font-mono text-xs font-medium text-fg/70">
          {selected ? calendarInfo(selected) : "Toque em um dia para ver detalhes"}
        </span>
        <span aria-hidden className="flex shrink-0 items-center gap-0.75 font-mono text-[10px] font-medium text-fg/40">
          menos
          {LEVEL_STYLE.map((style) => (
            <span key={style} className={cn("size-2.25 rounded-[2px]", style)} />
          ))}
          mais
        </span>
      </div>
    </Card>
  );
}

function Total({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-1.25">
      <dt className="text-[11px] text-fg/55">{label}</dt>
      <dd>
        <CountUp value={value} className={cn("font-mono text-[26px] leading-none font-semibold tabular-nums", accent && "text-lime")} />
      </dd>
    </div>
  );
}
