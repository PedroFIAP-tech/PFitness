import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ChipProps = ComponentProps<"button"> & { active?: boolean };

/**
 * Filtro selecionável (ex.: grupo muscular na biblioteca).
 * Visual de 34px como no protótipo, dentro de uma área de toque de 48px.
 */
export function Chip({ active = false, className, children, type = "button", ...props }: ChipProps) {
  return (
    <button type={type} aria-pressed={active} className={cn("flex h-12 shrink-0 items-center", className)} {...props}>
      <span
        className={cn(
          "flex h-8.5 items-center rounded-[11px] border px-3.25 text-[13px] font-medium transition-colors duration-200",
          active ? "border-lime/60 bg-lime/14 text-lime" : "border-white/8 bg-white/4 text-fg/75",
        )}
      >
        {children}
      </span>
    </button>
  );
}
