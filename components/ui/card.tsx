import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentProps<"div"> & {
  /** `accent`: destaque neon com cantoneiras (ex.: card do treino do dia). */
  variant?: "default" | "accent";
};

export function Card({ variant = "default", className, children, ...props }: CardProps) {
  const accent = variant === "accent";

  return (
    <div
      className={cn(
        "relative overflow-hidden border",
        accent
          ? "rounded-hero border-lime/25 bg-card-accent p-4.5 shadow-card-accent"
          : "rounded-card border-line bg-card p-4 shadow-card",
        className,
      )}
      {...props}
    >
      {accent && <CornerBrackets />}
      {children}
    </div>
  );
}

/** Cantoneiras lime nos quatro cantos (o pai precisa ser `relative`). */
export function CornerBrackets() {
  const bracket = "pointer-events-none absolute size-2.5 border-lime/80";
  return (
    <>
      <span aria-hidden className={cn(bracket, "top-2 left-2 border-t-[1.5px] border-l-[1.5px]")} />
      <span aria-hidden className={cn(bracket, "top-2 right-2 border-t-[1.5px] border-r-[1.5px]")} />
      <span aria-hidden className={cn(bracket, "bottom-2 left-2 border-b-[1.5px] border-l-[1.5px]")} />
      <span aria-hidden className={cn(bracket, "right-2 bottom-2 border-r-[1.5px] border-b-[1.5px]")} />
    </>
  );
}
