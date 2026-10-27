import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-lime font-bold text-on-lime shadow-button active:shadow-button-pressed",
  secondary: "border border-white/10 bg-white/6 font-semibold text-fg active:bg-white/10",
  ghost: "font-semibold text-lime active:bg-lime/8",
};

// Todos os tamanhos respeitam o alvo de toque mínimo de 48px
const sizes = {
  sm: "h-12 rounded-field px-4 text-[12.5px] tracking-[0.12em]",
  md: "h-13.5 rounded-[17px] px-5 text-[13px] tracking-label",
  lg: "h-15 rounded-button px-6 text-[15px] tracking-button",
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** Classes do botão, para aplicar o mesmo visual em <Link> e <a>. */
export function buttonStyles({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-3 font-display uppercase select-none",
    "transition-[transform,box-shadow,background-color] duration-150 active:scale-[.97]",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> &
  Omit<ButtonStyleOptions, "className"> & {
    /** Desabilita e mostra um spinner (ex.: enquanto a Server Action roda). */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
