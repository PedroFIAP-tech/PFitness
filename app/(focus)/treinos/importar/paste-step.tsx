"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { IMPORT_TEXT_MAX_LENGTH } from "@/lib/workout-import";

const PLACEHOLDER = `Segunda – Costas
 • Remada baixa — 3x12
 • Puxada alta — 3x12

Terça – Perna
 • Leg press — 3x12
 • Afundo — 3x10 cada perna`;

/** Mensagens da leitura, uma a cada ~2,4 s (a leitura leva uns 7 s). */
const READING_STEPS = [
  "Lendo os dias…",
  "Separando os exercícios…",
  "Conferindo séries e repetições…",
  "Procurando na sua biblioteca…",
  "Montando as fichas…",
];
const STEP_MS = 2400;

type PasteStepProps = {
  text: string;
  onText: (text: string) => void;
  reading: boolean;
  remaining: number;
  dailyLimit: number;
  error: { message: string; retry: boolean } | null;
  onRead: () => void;
};

/** Passo 1: colar o texto e mandar para a IA. */
export function PasteStep({ text, onText, reading, remaining, dailyLimit, error, onRead }: PasteStepProps) {
  const length = text.trim().length;
  const tooLong = length > IMPORT_TEXT_MAX_LENGTH;

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="font-display text-2xl font-semibold">Cole seu treino</h1>
        <p className="text-sm leading-relaxed text-fg/60">
          Do WhatsApp, do personal, de onde for. A IA separa as fichas e os exercícios, e você revisa antes de
          salvar.
        </p>
      </div>

      {reading ? (
        <ReadingCard />
      ) : (
        <label className="flex flex-col gap-2 rounded-card border border-white/9 bg-white/[0.035] p-3.5 focus-within:border-lime/50">
          <span className="sr-only">Texto do treino</span>
          <textarea
            value={text}
            onChange={(event) => onText(event.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="min-h-[45dvh] w-full resize-y bg-transparent text-base leading-relaxed outline-none placeholder:text-fg/30"
          />
          <span className={cn("self-end font-mono text-[11px] font-medium", tooLong ? "text-danger" : "text-fg/45")}>
            {formatNumber(length)} / {formatNumber(IMPORT_TEXT_MAX_LENGTH)}
          </span>
        </label>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-2.5 rounded-2xl border border-danger/35 bg-danger/8 p-3.5">
          <p className="text-sm text-danger">{error.message}</p>
          {error.retry && remaining > 0 && (
            <Button variant="secondary" size="sm" onClick={onRead} disabled={reading}>
              Tentar de novo
            </Button>
          )}
        </div>
      )}

      <Button size="lg" loading={reading} disabled={length === 0 || tooLong || remaining === 0} onClick={onRead}>
        {reading ? "Lendo treino…" : "Ler treino"}
      </Button>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <Label className={remaining === 0 ? "text-amber" : undefined}>
          {remaining === 0
            ? "Importações de hoje esgotadas"
            : `${remaining} de ${dailyLimit} importações restantes hoje`}
        </Label>
        <p className="text-xs text-fg/45">
          O texto é enviado à OpenAI só para esta leitura.
        </p>
      </div>
    </div>
  );
}

/** Enquanto a IA lê: varredura neon e mensagens que avançam, para a espera passar. */
function ReadingCard() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(
      () => setStep((current) => Math.min(current + 1, READING_STEPS.length - 1)),
      STEP_MS,
    );
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-[45dvh] flex-col items-center justify-center gap-5 overflow-hidden rounded-card border border-lime/30 bg-lime/4 p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan bg-linear-to-b from-transparent via-lime/12 to-transparent"
      />
      <ol aria-hidden className="flex gap-1.5">
        {READING_STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "h-1.5 w-7 rounded-full transition-colors duration-500",
              index <= step ? "bg-lime shadow-[0_0_8px_oklch(0.9_0.2_128/0.6)]" : "bg-white/10",
            )}
          />
        ))}
      </ol>
      <p key={step} role="status" aria-live="polite" className="animate-item-in font-display text-lg font-semibold">
        {READING_STEPS[step]}
      </p>
      <p className="text-xs text-fg/50">Leva uns segundos. Você revisa tudo antes de salvar.</p>
    </div>
  );
}
