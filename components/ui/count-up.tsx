"use client";

import { formatNumber } from "@/lib/format";
import { useTween } from "@/lib/use-tween";

type CountUpProps = {
  value: number;
  durationMs?: number;
  delayMs?: number;
  /** Casas decimais (padrão 0) */
  decimals?: number;
  className?: string;
};

/**
 * Número que conta de 0 até o valor ao aparecer, como nas telas do protótipo.
 * Com a aba preservada (Activity), a contagem roda de novo ao voltar para ela.
 */
export function CountUp({ value, durationMs = 1100, delayMs = 0, decimals = 0, className }: CountUpProps) {
  const progress = useTween(durationMs, delayMs);
  const factor = 10 ** decimals;
  return (
    <span className={className}>
      <span aria-hidden>{formatNumber(Math.round(value * progress * factor) / factor, decimals)}</span>
      {/* Leitores de tela leem o valor final, não a contagem */}
      <span className="sr-only">{formatNumber(value, decimals)}</span>
    </span>
  );
}
