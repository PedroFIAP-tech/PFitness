"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { vibrate } from "@/lib/haptics";

type HoldButtonProps = {
  label: string;
  holdingLabel?: string;
  /** Tempo segurando até disparar (ms) */
  duration?: number;
  /** Destaque lime (ex.: último exercício, quando finalizar é a ação principal) */
  emphasized?: boolean;
  onComplete: () => Promise<void> | void;
  className?: string;
};

/** "Segure para finalizar": a barra enche enquanto o dedo fica no botão; soltar cancela. */
export function HoldButton({
  label,
  holdingLabel = "Segurando…",
  duration = 1100,
  emphasized = false,
  onComplete,
  className,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const start = () => {
    if (frame.current !== null || done.current) return;
    const startedAt = performance.now();
    const step = (now: number) => {
      const next = Math.min(1, (now - startedAt) / duration);
      setProgress(next);
      if (next < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      frame.current = null;
      done.current = true;
      vibrate(30);
      void Promise.resolve(onComplete()).finally(() => {
        // Se a tela continuar (ex.: erro ao finalizar), volta ao estado inicial
        done.current = false;
        setProgress(0);
      });
    };
    frame.current = requestAnimationFrame(step);
  };

  const cancel = () => {
    if (frame.current === null) return;
    cancelAnimationFrame(frame.current);
    frame.current = null;
    setProgress(0);
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, pressed: boolean) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (pressed) start();
    else cancel();
  };

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => onKey(event, true)}
      onKeyUp={(event) => onKey(event, false)}
      className={cn(
        "relative h-14 touch-none overflow-hidden rounded-[18px] border bg-white/4 select-none [-webkit-touch-callout:none]",
        emphasized ? "border-lime/55" : "border-white/12",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-lime shadow-[0_0_30px_oklch(0.9_0.2_128/0.8)]"
        style={{ width: `${progress * 100}%` }}
      />
      <span
        className={cn(
          "relative font-display text-xs font-semibold tracking-label uppercase",
          progress > 0.45 ? "text-on-lime" : emphasized ? "text-lime" : "text-fg",
        )}
      >
        {progress > 0 ? holdingLabel : label}
      </span>
    </button>
  );
}
