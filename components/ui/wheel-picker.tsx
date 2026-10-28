"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

/** Altura de cada linha da roleta (px), como no protótipo. */
const ROW = 44;

type WheelPickerProps = {
  label: string;
  /** Texto do passo no canto (ex.: "±2,5") */
  hint: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
};

type Drag = { startY: number; startValue: number; moved: boolean };

/**
 * Roleta vertical: arrastar ↕ muda o valor em passos; tocar no número de cima
 * ou de baixo anda um passo. Setas do teclado também funcionam.
 */
export function WheelPicker({ label, hint, value, step, min, max, format, onChange, className }: WheelPickerProps) {
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Primeiro quadro de um toque: o número pula para onde foi tocado e depois desliza ao centro
  const [instant, setInstant] = useState(false);

  const clampValue = (next: number) => Math.min(max, Math.max(min, Math.round(next * 100) / 100));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startValue: value, moved: false };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dy = event.clientY - current.startY;
    if (Math.abs(dy) > 4) current.moved = true;
    const next = clampValue(current.startValue + Math.round(-dy / ROW) * step);
    if (next !== value) onChange(next);
    // Entre um passo e outro, os números acompanham o dedo
    setOffset(Math.max(-ROW, Math.min(ROW, dy + ((next - current.startValue) / step) * ROW)));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (current && !current.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const fromCenter = event.clientY - (rect.top + rect.height / 2);
      const direction = fromCenter < -ROW / 2 ? -1 : fromCenter > ROW / 2 ? 1 : 0;
      const next = clampValue(current.startValue + direction * step);
      if (direction !== 0 && next !== current.startValue) {
        onChange(next);
        setInstant(true);
        setOffset(direction * ROW);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setInstant(false);
            setOffset(0);
          }),
        );
        return;
      }
    }
    setOffset(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    onChange(clampValue(value + direction * step));
  };

  const animated = !dragging && !instant;

  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={format(value)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-44 cursor-ns-resize touch-none overflow-hidden rounded-[18px] border border-white/6 bg-black/40 outline-none select-none focus-visible:border-lime/50",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-2 top-1/2 h-13.5 -translate-y-1/2 rounded-[13px] border bg-lime/7 transition-[border-color,box-shadow] duration-200",
          dragging ? "border-lime/80 shadow-[0_0_24px_oklch(0.9_0.2_128/0.35)]" : "border-lime/28",
        )}
      />
      {[-2, -1, 0, 1, 2].map((position) => {
        const itemValue = Math.round((value + position * step) * 100) / 100;
        const outOfRange = itemValue < min || itemValue > max;
        const y = position * ROW + offset;
        const distance = Math.min(Math.abs(y) / ROW, 2.2);
        return (
          <div
            key={position}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 -mt-5.5 flex h-11 items-center justify-center font-mono text-[40px] leading-none font-semibold tracking-[-0.05em]",
              distance < 0.5 ? "text-[#F3F7F2]" : "text-fg/60",
            )}
            style={{
              transform: `translateY(${y.toFixed(1)}px) scale(${(1 - distance * 0.27).toFixed(3)})`,
              opacity: outOfRange ? 0 : Math.max(0.1, 1 - distance * 0.45),
              transition: animated ? "transform .3s cubic-bezier(.2,.8,.2,1), opacity .3s" : "none",
            }}
          >
            {outOfRange ? "" : format(itemValue)}
          </div>
        );
      })}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(5_7_10/0.95),transparent_32%,transparent_68%,rgb(5_7_10/0.95))]"
      />
      <span className="absolute top-2.5 left-3 font-mono text-label leading-none font-semibold tracking-label text-fg/60">
        {label}
      </span>
      <span className="absolute top-2.5 right-3 font-mono text-[10px] leading-none font-medium text-fg/40">
        {hint}
      </span>
      <span className="absolute inset-x-0 bottom-2.25 text-center font-mono text-[9.5px] leading-none font-medium tracking-label text-fg/38">
        ARRASTE ↕
      </span>
    </div>
  );
}
