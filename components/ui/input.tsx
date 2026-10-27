import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Campo de texto. Fonte de 16px para o iOS não dar zoom ao focar. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-13 w-full rounded-field border border-white/9 bg-white/5 px-4 text-base text-fg outline-none",
        "transition-[border-color,box-shadow] duration-150 placeholder:text-fg/40",
        "focus:border-lime/50 focus:shadow-field-focus aria-invalid:border-danger/60",
        className,
      )}
      {...props}
    />
  );
}
