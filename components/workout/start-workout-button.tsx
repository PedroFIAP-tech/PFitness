"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { startWorkout } from "@/app/(focus)/treino/actions";
import { Button, buttonStyles, type ButtonSize } from "@/components/ui/button";
import { PlayIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatElapsed } from "@/lib/format";
import { clearWorkoutStorage } from "@/lib/local-store";
import { useNow } from "@/lib/use-now";
import type { ActiveSession } from "@/lib/workout-session";
import { dropSessionOps } from "@/lib/workout-sync";

type StartWorkoutButtonProps = {
  planId: number;
  planCode: string;
  /** Treino em andamento (de qualquer ficha), se houver */
  active: ActiveSession | null;
  size?: ButtonSize;
  /** Texto do botão (padrão "Iniciar") */
  label?: string;
  className?: string;
};

/**
 * Iniciar/Continuar treino. Se houver um treino de outra ficha em andamento,
 * pergunta se quer continuar aquele ou descartá-lo e começar este.
 */
export function StartWorkoutButton({
  planId,
  planCode,
  active,
  size = "sm",
  label = "Iniciar",
  className,
}: StartWorkoutButtonProps) {
  const [conflict, setConflict] = useState<ActiveSession | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, showToast] = useToast();

  const start = (discard?: ActiveSession) =>
    startTransition(async () => {
      if (discard) {
        dropSessionOps(discard.id);
        clearWorkoutStorage(discard.id);
      }
      const result = await startWorkout(planId, discard?.id);
      if (result && "conflict" in result) setConflict(result.conflict);
      else if (result?.error) showToast(result.error, "error");
    });

  if (active?.planId === planId) {
    return (
      <Link href={`/treino/${planId}`} className={buttonStyles({ size, className })}>
        <span aria-hidden className="size-2 animate-blink rounded-full bg-on-lime" />
        Continuar
      </Link>
    );
  }

  return (
    <>
      <Button
        size={size}
        loading={pending && !conflict}
        onClick={() => (active ? setConflict(active) : start())}
        className={className}
      >
        {!pending && <PlayIcon className="h-3.25 w-2.75" />}
        {label}
      </Button>

      <Sheet
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title={conflict?.planCode ? `Treino ${conflict.planCode} em andamento` : "Treino em andamento"}
      >
        {conflict && (
          <ConflictBody
            conflict={conflict}
            planCode={planCode}
            pending={pending}
            onDiscard={() => start(conflict)}
          />
        )}
      </Sheet>
      {toast}
    </>
  );
}

function ConflictBody({
  conflict,
  planCode,
  pending,
  onDiscard,
}: {
  conflict: ActiveSession;
  planCode: string;
  pending: boolean;
  onDiscard: () => void;
}) {
  const now = useNow(30_000);
  const elapsed = formatElapsed((now - Date.parse(conflict.startedAt)) / 1000);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-fg/65">
        Você começou {conflict.title} {elapsed} e fez {conflict.setsDone} de {conflict.setsTotal} séries.
        Só dá para ter um treino em andamento.
      </p>
      <div className="flex flex-col gap-2">
        {conflict.planId !== null && (
          <Link href={`/treino/${conflict.planId}`} className={buttonStyles({ size: "md" })}>
            Continuar treino {conflict.planCode}
          </Link>
        )}
        <Button variant="danger" loading={pending} onClick={onDiscard}>
          Descartar e iniciar treino {planCode}
        </Button>
      </div>
    </div>
  );
}
