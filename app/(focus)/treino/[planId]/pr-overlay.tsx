"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Label } from "@/components/ui/label";
import { formatKg } from "@/lib/format";
import { useTween } from "@/lib/use-tween";

export type PrCelebration = {
  exerciseName: string;
  weightKg: number;
  reps: number;
  previousBest: number;
};

/** "NOVO PR" (tela 06). Toque em qualquer lugar fecha; o descanso começa depois. */
export function PrOverlay({ pr, onClose }: { pr: PrCelebration; onClose: () => void }) {
  const progress = useTween(1200, 150);
  // A carga sobe contando do recorde antigo até o novo
  const shownKg =
    progress >= 1
      ? pr.weightKg
      : Math.round((pr.previousBest + (pr.weightKg - pr.previousBest) * progress) * 2) / 2;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-label={`Novo recorde pessoal: ${pr.exerciseName}, ${formatKg(pr.weightKg)} kg`}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex animate-fade-in cursor-pointer flex-col items-center justify-center overflow-hidden bg-[rgb(3_5_6/0.9)] backdrop-blur-[10px]"
    >
      <div
        aria-hidden
        className="absolute top-[46%] left-1/2 size-[840px] -translate-x-1/2 -translate-y-1/2 animate-rays bg-[repeating-conic-gradient(oklch(0.9_0.2_128/0.13)_0deg_3deg,transparent_3deg_14deg)] [mask-image:radial-gradient(closest-side,#000_15%,transparent)]"
      />
      <div
        aria-hidden
        className="absolute top-[46%] left-1/2 size-60 -translate-x-1/2 -translate-y-1/2 animate-burst rounded-full bg-[radial-gradient(closest-side,oklch(0.97_0.12_128/0.95),oklch(0.9_0.2_128/0.3)_50%,transparent)]"
      />
      <div
        aria-hidden
        className="absolute top-[46%] left-1/2 size-50 -translate-x-1/2 -translate-y-1/2 animate-[ring-out_1.2s_0.1s_ease-out_both] rounded-full border-2 border-lime"
      />
      <div
        aria-hidden
        className="absolute top-[46%] left-1/2 size-50 -translate-x-1/2 -translate-y-1/2 animate-[ring-out_1.4s_0.35s_ease-out_both] rounded-full border border-amber"
      />

      <div className="relative flex animate-[pop_0.7s_0.12s_cubic-bezier(0.2,0.9,0.3,1.2)_both] flex-col items-center gap-3 px-6 text-center">
        <Label tone="accent" className="tracking-[0.2em]">
          Recorde pessoal
        </Label>
        <span className="font-display text-[70px] leading-[0.9] font-bold text-lime [text-shadow:0_0_34px_oklch(0.9_0.2_128/0.75)]">
          NOVO PR
        </span>
        <span className="text-[17px] font-medium">{pr.exerciseName}</span>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-mono text-[62px] leading-none font-semibold tracking-[-0.05em] tabular-nums">
            {formatKg(shownKg)}
          </span>
          <span className="font-mono text-lg font-medium text-fg/60">kg × {pr.reps}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 items-center rounded-lg border border-white/10 bg-white/6 px-2.5 font-mono text-xs font-medium text-fg/70">
            antes {formatKg(pr.previousBest)} kg
          </span>
          <span className="flex h-7 items-center rounded-lg bg-lime px-2.5 font-mono text-xs font-semibold text-on-lime">
            +{formatKg(pr.weightKg - pr.previousBest)} kg
          </span>
        </div>
        <span className="mt-3.5 font-mono text-[30px] leading-none font-semibold text-amber [text-shadow:0_0_18px_oklch(0.86_0.15_70/0.6)]">
          +{Math.round(50 * progress)} PTS
        </span>
      </div>

      <Label className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+24px)] animate-blink text-center tracking-[0.16em] text-fg/55">
        Toque para continuar
      </Label>
    </div>,
    document.body,
  );
}
