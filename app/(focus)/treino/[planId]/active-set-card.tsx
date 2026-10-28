"use client";

import { CornerBrackets } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { WheelPicker } from "@/components/ui/wheel-picker";
import { cn } from "@/lib/cn";
import { formatKg } from "@/lib/format";
import type { SetState } from "@/lib/workout-model";

const KG_LIMITS = { min: 0, max: 500 };
const REPS_LIMITS = { min: 1, max: 100 };

type ActiveSetCardProps = {
  set: SetState;
  totalSets: number;
  weightStep: number;
  /** Melhor carga atual (null sem histórico: não há PR a bater) */
  bestKg: number | null;
  onChange: (patch: Pick<SetState, "weightKg"> | Pick<SetState, "reps">) => void;
  onComplete: () => void;
};

export function ActiveSetCard({ set, totalSets, weightStep, bestKg, onChange, onComplete }: ActiveSetCardProps) {
  const comparison = compareWithLast(set);
  const aboveBest = bestKg !== null && set.weightKg > bestKg;

  return (
    <section
      aria-label={`Série ${set.setNumber} de ${totalSets}`}
      className="relative overflow-hidden rounded-hero border border-lime/25 bg-[linear-gradient(180deg,rgb(255_255_255/0.055),rgb(255_255_255/0.015))] p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_24px_50px_-24px_oklch(0.9_0.2_128/0.35)]"
    >
      {/* Varredura de luz e cantoneiras do protótipo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[30%] animate-scan bg-linear-to-b from-transparent via-lime/5 to-transparent"
      />
      <CornerBrackets />

      <div className="relative flex items-center justify-between px-1.5 pt-0.5">
        <span className="font-mono text-label leading-none font-semibold tracking-label text-lime uppercase">
          Série {set.setNumber} de {totalSets}
        </span>
        <span className={cn("font-mono text-[11px] leading-none font-medium", comparison.better ? "text-lime" : "text-fg/55")}>
          {comparison.label}
        </span>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2.5">
        <WheelPicker
          label="KG"
          hint={`±${formatKg(weightStep)}`}
          value={set.weightKg}
          step={weightStep}
          {...KG_LIMITS}
          format={formatKg}
          onChange={(weightKg) => onChange({ weightKg })}
        />
        <WheelPicker
          label="REPS"
          hint="±1"
          value={set.reps}
          step={1}
          {...REPS_LIMITS}
          format={String}
          onChange={(reps) => onChange({ reps })}
        />
      </div>

      {aboveBest && (
        <div className="relative mt-2.5 flex h-7.5 animate-glow-pulse items-center justify-center gap-2 rounded-[10px] border border-amber/35 bg-amber/8 font-mono text-[11px] font-semibold tracking-[0.12em] text-amber">
          ▲ ACIMA DO SEU PR · {formatKg(bestKg)} KG
        </div>
      )}

      <button
        type="button"
        onClick={onComplete}
        className="relative mt-3 flex h-16 w-full items-center justify-center gap-3 rounded-button bg-lime font-display text-[15px] font-bold tracking-button text-on-lime uppercase shadow-button transition-[transform,box-shadow] duration-150 active:scale-[.97] active:shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_0_70px_6px_oklch(0.9_0.2_128/0.9)]"
      >
        <CheckIcon className="size-5" />
        Concluir série
      </button>
    </section>
  );
}

/** "+5 kg vs última", "-1 reps vs última", "igual à última". */
function compareWithLast(set: SetState) {
  if (!set.last) return { label: "primeira vez", better: false };
  const kg = set.weightKg - set.last.weightKg;
  const reps = set.reps - set.last.reps;
  if (kg !== 0) return { label: `${kg > 0 ? "+" : ""}${formatKg(kg)} kg vs última`, better: kg > 0 };
  if (reps !== 0) return { label: `${reps > 0 ? "+" : ""}${reps} reps vs última`, better: reps > 0 };
  return { label: "igual à última", better: false };
}
