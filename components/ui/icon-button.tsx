import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  neutral: "border border-white/9 bg-white/4 text-fg/80 active:bg-white/10",
  accent: "border border-lime/50 bg-lime/10 text-lime shadow-glow",
  // Fundo some até ser pressionado; usado em ações secundárias dentro de cards
  quiet: "bg-white/4 text-fg/60 active:bg-danger/20",
};

type IconButtonStyleOptions = {
  variant?: keyof typeof variants;
  className?: string;
};

/** Classes do botão quadrado de 48px, para usar também em <Link>. */
export function iconButtonStyles({ variant = "neutral", className }: IconButtonStyleOptions = {}) {
  return cn(
    "grid size-12 shrink-0 place-items-center rounded-[14px] transition-[transform,background-color] duration-150 active:scale-90",
    "disabled:pointer-events-none disabled:opacity-30",
    variants[variant],
    className,
  );
}

type IconButtonProps = ComponentProps<"button"> &
  IconButtonStyleOptions & {
    /** Obrigatório: o botão só tem ícone. */
    "aria-label": string;
  };

export function IconButton({ variant, className, type = "button", ...props }: IconButtonProps) {
  return <button type={type} className={iconButtonStyles({ variant, className })} {...props} />;
}
