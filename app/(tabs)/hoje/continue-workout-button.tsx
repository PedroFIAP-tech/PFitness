"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import { useNow } from "@/lib/use-now";

/** "Continuar · 14:32" com o tempo do treino correndo. */
export function ContinueWorkoutButton({ planId, startedAt }: { planId: number; startedAt: string }) {
  const isClient = useIsClient();
  const now = useNow(1000);
  const elapsed = (now - Date.parse(startedAt)) / 1000;

  return (
    <Link
      href={`/treino/${planId}`}
      className={cn(
        "flex h-15 w-full items-center justify-center gap-3 rounded-button border border-lime/60 bg-lime/12 font-display text-sm font-bold tracking-[0.14em] text-lime uppercase",
        "shadow-[0_0_30px_-6px_oklch(0.9_0.2_128/0.5)] transition-transform duration-150 active:scale-[.97]",
      )}
    >
      <span aria-hidden className="size-2 animate-blink rounded-full bg-lime" />
      Continuar{isClient && <span className="font-mono tabular-nums">· {formatDuration(elapsed)}</span>}
    </Link>
  );
}
