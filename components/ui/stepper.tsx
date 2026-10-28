import { cn } from "@/lib/cn";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Quanto cada toque soma ou tira (padrão 1) */
  step?: number;
  /** Formata o valor exibido (ex.: separador de milhar) */
  format?: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
};

/** − valor + com rótulo técnico (séries, reps alvo). */
export function Stepper({ label, value, min, max, step: stepSize = 1, format = String, onChange, className }: StepperProps) {
  const step = (direction: number) => onChange(Math.min(max, Math.max(min, value + direction * stepSize)));
  const button =
    "h-full w-12 shrink-0 font-mono text-xl font-medium text-fg/80 transition-colors active:text-lime disabled:text-fg/20";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex h-12 items-center rounded-[14px] border border-white/7 bg-black/35", className)}
    >
      <button
        type="button"
        aria-label={`Diminuir ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => step(-1)}
        className={button}
      >
        −
      </button>
      <span className="flex flex-1 flex-col items-center gap-0.75">
        <span aria-live="polite" className="font-mono text-lg leading-none font-semibold tabular-nums">
          {format(value)}
        </span>
        <span className="font-mono text-[8.5px] leading-none font-medium tracking-label text-fg/45 uppercase">
          {label}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => step(1)}
        className={button}
      >
        +
      </button>
    </div>
  );
}
