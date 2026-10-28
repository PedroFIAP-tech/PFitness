"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { IMPORT_DAILY_LIMIT, IMPORT_TEXT_MAX_LENGTH } from "@/lib/workout-import";

const PLACEHOLDER = `Segunda – Costas
 • Remada baixa — 3x12
 • Puxada alta — 3x12

Terça – Perna
 • Leg press — 3x12
 • Afundo — 3x10 cada perna`;

type PasteStepProps = {
  text: string;
  onText: (text: string) => void;
  reading: boolean;
  remaining: number;
  error: { message: string; retry: boolean } | null;
  onRead: () => void;
};

/** Passo 1: colar o texto e mandar para a IA. */
export function PasteStep({ text, onText, reading, remaining, error, onRead }: PasteStepProps) {
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

      <label className="flex flex-col gap-2 rounded-card border border-white/9 bg-white/[0.035] p-3.5 focus-within:border-lime/50">
        <span className="sr-only">Texto do treino</span>
        <textarea
          value={text}
          onChange={(event) => onText(event.target.value)}
          placeholder={PLACEHOLDER}
          disabled={reading}
          spellCheck={false}
          className="min-h-[45dvh] w-full resize-y bg-transparent text-base leading-relaxed outline-none placeholder:text-fg/30"
        />
        <span className={cn("self-end font-mono text-[11px] font-medium", tooLong ? "text-danger" : "text-fg/45")}>
          {formatNumber(length)} / {formatNumber(IMPORT_TEXT_MAX_LENGTH)}
        </span>
      </label>

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
            : `${remaining} de ${IMPORT_DAILY_LIMIT} importações restantes hoje`}
        </Label>
        <p className="text-xs text-fg/45">
          {reading ? "Isso leva alguns segundos." : "O texto é enviado à OpenAI só para esta leitura."}
        </p>
      </div>
    </div>
  );
}
