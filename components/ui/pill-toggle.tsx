"use client";

import { cn } from "@/lib/cn";

type PillToggleProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

/**
 * Seletor compacto para cabeçalho de card (ex.: 1M/3M/6M/1A). Visual de 30px,
 * com área de toque estendida para 48px.
 */
export function PillToggle<T extends string>({ options, value, onChange, className, ...props }: PillToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn("flex shrink-0 gap-0.5 rounded-[10px] border border-white/6 bg-black/35 p-0.75", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative h-7.5 min-w-10 rounded-[7px] border px-2 font-mono text-[11px] font-semibold transition-colors duration-200 before:absolute before:-inset-x-0.5 before:-inset-y-2.5",
            option.value === value ? "border-lime/50 bg-lime/14 text-lime" : "border-transparent text-fg/60",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
