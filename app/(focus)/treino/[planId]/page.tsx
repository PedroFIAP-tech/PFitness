import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FocusHeader } from "@/components/app-shell/focus-header";
import { getPlan, parsePlanId } from "@/lib/workouts";

export const metadata: Metadata = { title: "Treino" };

// Tela do treino em andamento: por enquanto só confirma a ficha escolhida
export default function TreinoPage({ params }: PageProps<"/treino/[planId]">) {
  return (
    <Suspense fallback={<FocusHeader backHref="/treinos" label="Treino" />}>
      <WorkoutPlaceholder params={params} />
    </Suspense>
  );
}

async function WorkoutPlaceholder({ params }: Pick<PageProps<"/treino/[planId]">, "params">) {
  const planId = parsePlanId((await params).planId);
  if (planId === null) notFound();
  const plan = await getPlan(planId);
  if (!plan) notFound();

  return (
    <>
      <FocusHeader backHref="/treinos" label={`Treino ${plan.code}`} />
      <div className="flex flex-col gap-2 px-3.5 pt-4">
        <h1 className="font-display text-title font-semibold">{plan.title}</h1>
        <p className="text-sm text-fg/60">A execução do treino chega na próxima etapa.</p>
      </div>
    </>
  );
}
