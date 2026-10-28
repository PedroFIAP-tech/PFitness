"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { ActiveSession } from "@/lib/workout-session";
import type { PlanOverview } from "@/lib/workouts";
import { PlanCard } from "./plan-card";

type PlanListProps = {
  plans: PlanOverview[];
  nextPlanId: number | null;
  activeSession: ActiveSession | null;
  /** Ficha recém-salva (?ficha=): abre o card e avisa. */
  savedPlanId: number | null;
  /** Código da ficha recém-excluída (?excluida=). */
  deletedCode: string | null;
};

/** A página remonta esta lista (via `key`) quando chega de um salvar/excluir. */
export function PlanList({ plans, nextPlanId, activeSession, savedPlanId, deletedCode }: PlanListProps) {
  const [openIds, setOpenIds] = useState(
    () => new Set([savedPlanId ?? nextPlanId].filter((id): id is number => id !== null)),
  );
  const [toast] = useToast(
    savedPlanId ? "Ficha salva" : deletedCode ? `Ficha ${deletedCode} excluída` : undefined,
  );

  // O aviso já foi exibido: limpa a URL para não repetir num reload
  useEffect(() => {
    if (savedPlanId || deletedCode) window.history.replaceState(null, "", "/treinos");
  }, [savedPlanId, deletedCode]);

  const toggle = (planId: number) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (!next.delete(planId)) next.add(planId);
      return next;
    });

  return (
    <>
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isNext={plan.id === nextPlanId}
          activeSession={activeSession}
          open={openIds.has(plan.id)}
          onToggle={() => toggle(plan.id)}
        />
      ))}
      <Link
        href="/treinos/nova"
        className="flex h-14 items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-white/14 text-sm font-medium text-fg/70 transition-[color,border-color,transform] duration-200 hover:border-lime/50 hover:text-lime active:scale-[.98]"
      >
        <PlusIcon className="size-4" />
        Criar nova ficha
      </Link>
      {toast}
    </>
  );
}
