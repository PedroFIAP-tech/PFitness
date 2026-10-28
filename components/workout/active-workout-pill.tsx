"use client";

import Link from "next/link";
import { formatDuration, formatElapsed } from "@/lib/format";
import { readJSON, storageKeys } from "@/lib/local-store";
import { useIsClient } from "@/lib/use-is-client";
import { useNow } from "@/lib/use-now";
import type { RestTimer, WorkoutDraft } from "@/lib/workout-model";
import type { ActiveSession } from "@/lib/workout-session";

/**
 * Pílula flutuante acima da tab bar enquanto há um treino minimizado:
 * "Treino A · 14:32", descanso ou progresso, e "Voltar".
 */
export function ActiveWorkoutPill({ session }: { session: ActiveSession }) {
  const isClient = useIsClient();
  if (!isClient || session.planId === null) return null;
  return <Pill session={session} planId={session.planId} />;
}

function Pill({ session, planId }: { session: ActiveSession; planId: number }) {
  const now = useNow(1000);
  // A tela do treino grava o progresso no aparelho; é mais novo que o do servidor
  const draft = readJSON<WorkoutDraft>(storageKeys.workoutDraft(session.id));
  const rest = readJSON<RestTimer>(storageKeys.rest(session.id));
  const done = draft?.progress.done ?? session.setsDone;
  const total = draft?.progress.total ?? session.setsTotal;
  const restLeft = rest && rest.endAt > now ? (rest.endAt - now) / 1000 : null;
  const elapsed = (now - Date.parse(session.startedAt)) / 1000;

  const subtitle =
    restLeft !== null
      ? `Descanso ${formatDuration(Math.ceil(restLeft))} · ${done}/${total} séries`
      : `${draft?.progress.exerciseName ?? session.title} · ${done}/${total} séries`;

  return (
    <>
      {/* Espaço para a pílula não cobrir o fim do conteúdo */}
      <div aria-hidden className="h-16" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-20 mx-auto max-w-md px-3.5">
        <Link
          href={`/treino/${planId}`}
          aria-label={`Voltar ao treino ${session.planCode ?? ""}, iniciado ${formatElapsed(elapsed)}`}
          className="pointer-events-auto flex h-14 animate-slide-up items-center gap-3 rounded-[18px] border border-lime/45 bg-[rgb(16_20_14/0.86)] px-3.5 shadow-[0_0_24px_oklch(0.9_0.2_128/0.2),0_12px_30px_rgb(0_0_0/0.5)] backdrop-blur-[18px] transition-transform duration-150 active:scale-[.98]"
        >
          <span aria-hidden className="size-2.5 shrink-0 animate-blink rounded-full bg-lime shadow-[0_0_10px_var(--color-lime)]" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-display text-sm leading-none font-semibold tracking-[0.04em]">
              Treino {session.planCode} · {formatDuration(elapsed)}
            </span>
            <span className="truncate font-mono text-[11px] text-fg/60">{subtitle}</span>
          </span>
          <span className="shrink-0 font-display text-xs font-semibold tracking-[0.12em] text-lime uppercase">
            Voltar ›
          </span>
        </Link>
      </div>
    </>
  );
}
