import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const tones = {
  muted: "text-fg/52",
  accent: "text-lime",
  amber: "text-amber",
};

type LabelProps = ComponentProps<"label"> & {
  tone?: keyof typeof tones;
};

/**
 * Label técnico: mono, caixa alta e espaçado ("SEG · 26 OUT", "EXERCÍCIOS").
 * Vira <label> quando recebe `htmlFor`; senão é um <span>.
 */
export function Label({ tone = "muted", htmlFor, className, ...props }: LabelProps) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <Tag
      htmlFor={htmlFor}
      className={cn(
        "font-mono text-label font-medium tracking-label uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
