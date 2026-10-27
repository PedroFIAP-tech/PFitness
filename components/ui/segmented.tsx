"use client";

import { cn } from "@/lib/cn";

type SegmentedProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

/** Seletor segmentado com indicador neon deslizante (ex.: Objetivo no Perfil). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ...props
}: SegmentedProps<T>) {
  const activeIndex = options.findIndex((option) => option.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn(
        "relative grid rounded-field border border-white/7 bg-black/35 p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-xl border border-lime/55 bg-lime/14 shadow-glow transition-[left] duration-400 ease-snap"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: `calc(4px + (100% - 8px) / ${options.length} * ${activeIndex})`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-12 text-[12.5px] font-semibold transition-colors duration-300",
              active ? "text-lime" : "text-fg/60",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
