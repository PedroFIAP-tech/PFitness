"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatKg } from "@/lib/format";
import type { SetState } from "@/lib/workout-model";

/** Distância do swipe para concluir (→) ou pular (←), como no protótipo. */
const SWIPE_THRESHOLD = 90;

type SetRowProps = {
  set: SetState;
  active: boolean;
  /** Muda a cada conclusão para reiniciar as partículas */
  burstId: number | null;
  onComplete: () => void;
  onSkip: () => void;
  onUndo: () => void;
  /** Tocar: série a fazer vira a ativa; série pulada volta a ser feita */
  onTap: () => void;
};

type Gesture = { x: number; y: number; lock: "x" | "y" | null };

export function SetRow({ set, active, burstId, onComplete, onSkip, onUndo, onTap }: SetRowProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const suppressTap = useRef(false);

  const done = set.status === "concluida";
  const skipped = set.status === "pulada";
  const number = String(set.setNumber).padStart(2, "0");
  const delta = set.last && set.status === "todo" ? set.weightKg - set.last.weightKg : 0;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-nodrag]")) return;
    gesture.current = { x: event.clientX, y: event.clientY, lock: null };
    suppressTap.current = false;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    const moveX = event.clientX - current.x;
    const moveY = event.clientY - current.y;
    if (!current.lock) {
      if (Math.abs(moveX) > 8 && Math.abs(moveX) > Math.abs(moveY)) {
        current.lock = "x";
        suppressTap.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      } else if (Math.abs(moveY) > 8) {
        current.lock = "y";
        suppressTap.current = true;
      }
    }
    if (current.lock === "x") setDx(Math.max(-160, Math.min(160, moveX)));
  };

  const onPointerEnd = () => {
    const current = gesture.current;
    gesture.current = null;
    if (current?.lock === "x") {
      if (dx > SWIPE_THRESHOLD && !done) onComplete();
      else if (dx < -SWIPE_THRESHOLD && set.status === "todo") onSkip();
    }
    setDragging(false);
    setDx(0);
  };

  const reveal = (direction: 1 | -1): CSSProperties => {
    const amount = Math.max(0, (direction * dx) / SWIPE_THRESHOLD);
    return {
      opacity: Math.min(1, amount),
      transform: amount > 1 ? "scale(1.08)" : "none",
    };
  };

  return (
    <li className={cn("relative h-16", (burstId !== null || dx !== 0) && "z-10")}>
      {/* Trilho revelado pelo swipe */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-between rounded-[18px] bg-white/[0.015] px-4.5 font-mono text-[11px] font-semibold tracking-label"
      >
        <span style={reveal(1)} className="text-lime transition-transform duration-200 [text-shadow:0_0_10px_oklch(0.9_0.2_128/0.6)]">
          ✓ CONCLUIR
        </span>
        <span style={reveal(-1)} className="text-danger transition-transform duration-200">
          PULAR ✕
        </span>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging
            ? "none"
            : "transform .4s cubic-bezier(.2,.8,.2,1), background-color .3s, border-color .3s",
        }}
        className={cn(
          "absolute inset-0 flex touch-pan-y items-center gap-3 rounded-[18px] border pr-2 pl-3.5 backdrop-blur-sm",
          done
            ? "border-lime/35 bg-lime/5"
            : active
              ? "border-lime/55 bg-white/[0.055] shadow-[0_0_0_3px_oklch(0.9_0.2_128/0.07),0_0_22px_oklch(0.9_0.2_128/0.14)]"
              : "border-white/7 bg-white/[0.025]",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 rounded-[17px] bg-linear-to-r from-lime/16 to-lime/3 transition-[width] duration-550 ease-snap"
          style={{ width: done ? "100%" : "0%" }}
        />

        <button
          type="button"
          onClick={() => {
            if (suppressTap.current) {
              suppressTap.current = false;
              return;
            }
            if (!done) onTap();
          }}
          aria-label={
            skipped
              ? `Série ${set.setNumber} pulada. Toque para retomar`
              : `Série ${set.setNumber}: ${formatKg(set.weightKg)} kg × ${set.reps}`
          }
          className="relative flex min-w-0 flex-1 items-center gap-3 self-stretch text-left"
        >
          <span className={cn("w-6 font-mono text-[13px] font-semibold", done || active ? "text-lime" : "text-fg/40")}>
            {number}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.25">
            <span
              className={cn(
                "flex items-baseline gap-1.5 font-mono text-xl leading-none font-semibold tracking-[-0.03em]",
                skipped ? "text-fg/35 line-through" : "text-[#EEF3EE]",
              )}
            >
              {formatKg(set.weightKg)}
              <span className="text-xs font-medium tracking-normal text-fg/50">kg ×</span>
              {set.reps}
              {delta !== 0 && (
                <span className={cn("text-[11px] tracking-normal", delta > 0 ? "text-lime" : "text-fg/50")}>
                  {delta > 0 ? "+" : ""}
                  {formatKg(delta)}
                </span>
              )}
            </span>
            <span className="truncate font-mono text-[11px] font-medium text-fg/45">
              {skipped
                ? "pulada · toque para retomar"
                : set.last
                  ? `última ${formatKg(set.last.weightKg)} × ${set.last.reps}`
                  : "sem histórico"}
            </span>
          </span>
          {set.isPr && (
            <span className="flex h-6 animate-pop items-center rounded-[7px] bg-amber px-2 font-mono text-[11px] font-bold tracking-[0.1em] text-[#1a1000] shadow-[0_0_14px_oklch(0.86_0.15_70/0.6)]">
              PR
            </span>
          )}
        </button>

        <button
          type="button"
          data-nodrag
          aria-label={done ? `Desfazer série ${set.setNumber}` : `Concluir série ${set.setNumber}`}
          aria-pressed={done}
          onClick={done ? onUndo : onComplete}
          className={cn(
            "relative grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] transition-[background-color,border-color,box-shadow,transform] duration-350 active:scale-[.86]",
            done
              ? "border-lime bg-lime shadow-[0_0_18px_oklch(0.9_0.2_128/0.7)]"
              : active
                ? "border-lime/70 bg-black/25"
                : "border-white/18 bg-black/25",
          )}
        >
          <svg viewBox="0 0 20 20" aria-hidden className="relative size-5">
            <path
              d="M4 10.5L8.5 15L16 5.5"
              pathLength={1}
              fill="none"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={1}
              className={done ? "stroke-on-lime" : "stroke-lime/90"}
              style={{ strokeDashoffset: done ? 0 : 1, transition: "stroke-dashoffset .4s .12s ease-out" }}
            />
          </svg>
          {burstId !== null && <Burst key={burstId} seed={burstId} />}
        </button>
      </div>
    </li>
  );
}

/** Partículas, anel e "+10" saindo do check (protótipo: mkBurst). */
function Burst({ seed }: { seed: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 14 }, (_, index) => {
        const angle = (index / 14) * Math.PI * 2 + seed * 0.5;
        const radius = 30 + (index % 3) * 12;
        const size = index % 3 === 0 ? 6 : 4;
        return (
          <span
            key={index}
            className={cn(
              "absolute top-1/2 left-1/2 animate-particle shadow-[0_0_8px_var(--color-lime)]",
              index % 5 === 0 ? "bg-white" : "bg-lime",
              index % 4 === 0 ? "rounded-[1px]" : "rounded-full",
            )}
            style={
              {
                width: size,
                height: size,
                margin: `-${size / 2}px 0 0 -${size / 2}px`,
                "--dx": `${(Math.cos(angle) * radius).toFixed(1)}px`,
                "--dy": `${(Math.sin(angle) * radius).toFixed(1)}px`,
              } as CSSProperties
            }
          />
        );
      })}
      <span className="absolute -inset-0.5 animate-[ring-out_0.6s_ease-out_forwards] rounded-full border-2 border-lime" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 animate-float-up font-mono text-xs font-semibold whitespace-nowrap text-lime [text-shadow:0_0_10px_oklch(0.9_0.2_128/0.8)]">
        +10
      </span>
    </span>
  );
}
