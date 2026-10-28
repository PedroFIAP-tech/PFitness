"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/format";
import type { RestTimer } from "@/lib/workout-model";

const RING = "M120 20 a100 100 0 1 1 0 200 a100 100 0 1 1 0 -200";
const TICKS = "M120 6 a114 114 0 1 1 0 228 a114 114 0 1 1 0 -228";
const MINI_RING = "M13 2 a11 11 0 1 1 0 22 a11 11 0 1 1 0 -22";

function remainingSeconds(rest: RestTimer, now: number) {
  // `now` pode estar até um tique atrás do início do descanso: nunca passa do total
  return Math.min(rest.totalSeconds, Math.max(0, (rest.endAt - now) / 1000));
}

/** Quanto do anel ainda está aceso (stroke-dashoffset de 0 a 100). */
function ringOffset(rest: RestTimer, now: number) {
  return (100 - (remainingSeconds(rest, now) / rest.totalSeconds) * 100).toFixed(2);
}

type RestSheetProps = {
  rest: RestTimer;
  now: number;
  next: { exercise: string; detail: string };
  onMinimize: () => void;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
};

/** Descanso em tela cheia (tela 05). Tocar fora minimiza, não cancela. */
export function RestSheet({ rest, now, next, onMinimize, onAdjust, onSkip }: RestSheetProps) {
  const remaining = remainingSeconds(rest, now);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMinimize();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onMinimize]);

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div aria-hidden onClick={onMinimize} className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[6px]" />
      <section
        role="dialog"
        aria-label="Descanso"
        className="absolute inset-x-2.5 bottom-[calc(env(safe-area-inset-bottom)+10px)] mx-auto flex max-w-[calc(28rem-20px)] animate-sheet-up flex-col items-center gap-3 rounded-[30px] border border-white/10 bg-[rgb(13_16_19/0.94)] px-4 pt-3.5 pb-4 shadow-[0_-20px_60px_rgb(0_0_0/0.6),0_0_0_1px_oklch(0.9_0.2_128/0.08)]"
      >
        <div className="flex w-full items-center justify-between">
          <Label className="text-fg/55">Descanso</Label>
          <button
            type="button"
            onClick={onMinimize}
            className="-mr-2 flex h-12 items-center gap-1 px-2 text-xs font-medium text-fg/70"
          >
            Minimizar
            <ChevronDownIcon className="size-4" />
          </button>
        </div>

        <div className="relative size-59">
          {remaining <= 5 && (
            <span aria-hidden className="absolute inset-4 animate-pulse-ring rounded-full border-2 border-lime" />
          )}
          <svg viewBox="0 0 240 240" aria-hidden className="size-59 overflow-visible">
            <path d={TICKS} pathLength={100} fill="none" strokeWidth={7} strokeDasharray=".3 1.7" className="stroke-fg/20" />
            <path d={RING} fill="none" strokeWidth={12} className="stroke-white/6" />
            <path
              d={RING}
              pathLength={100}
              fill="none"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={100}
              className="stroke-lime drop-shadow-[0_0_8px_oklch(0.9_0.2_128/0.7)]"
              style={{ strokeDashoffset: ringOffset(rest, now), transition: "stroke-dashoffset .3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span
              role="timer"
              aria-live="off"
              className="font-mono text-[56px] leading-none font-semibold tracking-[-0.05em] [text-shadow:0_0_24px_oklch(0.9_0.2_128/0.35)]"
            >
              {formatDuration(Math.ceil(remaining))}
            </span>
            <Label className="text-fg/50">de {formatDuration(rest.totalSeconds)}</Label>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.25 text-center">
          <Label tone="accent">A seguir</Label>
          <span className="font-display text-base font-semibold">{next.exercise}</span>
          <span className="font-mono text-[13px] font-medium text-fg/65">{next.detail}</span>
        </div>

        <div className="mt-1 grid w-full grid-cols-[1fr_1.4fr_1fr] gap-2.5">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="h-14.5 rounded-button border border-white/10 bg-white/5 font-mono text-base font-semibold transition-transform duration-150 active:scale-[.93] active:bg-white/10"
          >
            −15s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="h-14.5 rounded-button bg-lime font-display text-sm font-bold tracking-button text-on-lime shadow-[0_0_30px_-6px_oklch(0.9_0.2_128/0.8)] transition-transform duration-150 active:scale-[.95]"
          >
            PULAR
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="h-14.5 rounded-button border border-white/10 bg-white/5 font-mono text-base font-semibold transition-transform duration-150 active:scale-[.93] active:bg-white/10"
          >
            +15s
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/** Descanso minimizado, no topo da tela do treino. */
export function RestPill({ rest, now, onExpand }: { rest: RestTimer; now: number; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Expandir descanso"
      className="flex h-12 animate-item-in items-center gap-3 rounded-[14px] border border-lime/45 bg-lime/8 px-3.5 transition-transform duration-150 active:scale-[.98]"
    >
      <svg viewBox="0 0 26 26" aria-hidden className="size-6.5">
        <path d={MINI_RING} fill="none" strokeWidth={3} className="stroke-white/10" />
        <path
          d={MINI_RING}
          pathLength={100}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={100}
          className="stroke-lime"
          style={{ strokeDashoffset: ringOffset(rest, now), transition: "stroke-dashoffset .3s linear" }}
        />
      </svg>
      <Label className="text-fg/60">Descanso</Label>
      <span className="flex-1 text-left font-mono text-lg leading-none font-semibold text-lime">
        {formatDuration(Math.ceil(remainingSeconds(rest, now)))}
      </span>
      <span className="text-xs font-medium text-fg/60">expandir</span>
    </button>
  );
}
