import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

const sizes = {
  sm: "text-base tracking-[-0.03em]", // anéis de macro
  md: "text-xl tracking-[-0.02em]", // grade de stats (EXERCÍCIOS · SÉRIES)
  lg: "text-[40px] tracking-[-0.03em]", // streak
  xl: "text-[44px] tracking-[-0.04em]", // kcal do dia
};

const tones = {
  default: "text-fg",
  lime: "text-lime",
  amber: "text-amber",
  cyan: "text-cyan",
};

type StatNumberProps = Omit<ComponentProps<"span">, "children"> & {
  /** Números saem formatados em pt-BR; strings (ex.: "52:14") vão como estão. */
  value: number | string;
  unit?: string;
  /** Casas decimais máximas para números. */
  decimals?: number;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  glow?: boolean;
};

export function StatNumber({
  value,
  unit,
  decimals = 0,
  size = "md",
  tone = "default",
  glow = false,
  className,
  ...props
}: StatNumberProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono leading-none font-semibold tabular-nums",
        sizes[size],
        tones[tone],
        glow && "text-glow",
        className,
      )}
      {...props}
    >
      {typeof value === "number" ? formatNumber(value, decimals) : value}
      {unit && (
        <span className="text-xs font-medium tracking-normal text-fg/50 [text-shadow:none]">
          {unit}
        </span>
      )}
    </span>
  );
}
