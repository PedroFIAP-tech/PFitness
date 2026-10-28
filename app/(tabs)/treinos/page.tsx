import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Screen, ScreenHeader } from "@/components/app-shell/screen";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { iconButtonStyles } from "@/components/ui/icon-button";
import { PlusIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { plural } from "@/lib/format";
import { getActiveSession } from "@/lib/workout-session";
import { getPlansOverview } from "@/lib/workouts";
import { PlanList } from "./plan-list";

export const metadata: Metadata = { title: "Treinos" };

export default function TreinosPage({ searchParams }: PageProps<"/treinos">) {
  return (
    <Screen>
      <Suspense fallback={<TreinosSkeleton />}>
        <TreinosContent searchParams={searchParams} />
      </Suspense>
    </Screen>
  );
}

async function TreinosContent({ searchParams }: Pick<PageProps<"/treinos">, "searchParams">) {
  const [{ plans, nextPlanId }, activeSession, params] = await Promise.all([
    getPlansOverview(),
    getActiveSession(),
    searchParams,
  ]);
  const savedPlanId = Number(params.ficha) || null;
  const deletedCode = typeof params.excluida === "string" ? params.excluida : null;
  const importedCount = Number(params.importadas) || null;
  const notice = savedPlanId
    ? "Ficha salva"
    : deletedCode
      ? `Ficha ${deletedCode} excluída`
      : importedCount
        ? `${plural(importedCount, "ficha importada", "fichas importadas")}`
        : null;

  const eyebrow = plans.length
    ? `${plural(plans.length, "ficha", "fichas")} · divisão ${plans.map((plan) => plan.code).join("")}`
    : "Nenhuma ficha";

  return (
    <>
      <ScreenHeader eyebrow={eyebrow} title="Treinos" action={<NewPlanButton />} />
      {plans.length === 0 ? (
        <EmptyState />
      ) : (
        <PlanList
          key={savedPlanId ?? notice ?? "fichas"}
          plans={plans}
          nextPlanId={nextPlanId}
          activeSession={activeSession}
          savedPlanId={savedPlanId}
          notice={notice}
        />
      )}
    </>
  );
}

function NewPlanButton() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/treinos/importar"
        className="flex h-12 items-center rounded-[14px] border border-white/9 bg-white/4 px-3.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-fg/80 uppercase transition-transform duration-150 active:scale-95"
      >
        Importar texto
      </Link>
      <Link href="/treinos/nova" aria-label="Criar nova ficha" className={iconButtonStyles({ variant: "accent" })}>
        <PlusIcon className="size-5" />
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-start gap-3 p-5">
      <Label tone="accent">Comece por aqui</Label>
      <h2 className="font-display text-xl font-semibold">Monte sua primeira ficha</h2>
      <p className="text-sm leading-relaxed text-fg/60">
        Escolha os exercícios e defina séries e repetições, ou cole o treino que você recebeu (do
        WhatsApp, do personal) e a gente monta as fichas.
      </p>
      <Link href="/treinos/nova" className={buttonStyles({ size: "md", className: "mt-2 w-full" })}>
        Criar primeira ficha
      </Link>
      <Link href="/treinos/importar" className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}>
        Importar texto
      </Link>
    </Card>
  );
}

function TreinosSkeleton() {
  return (
    <>
      <ScreenHeader title="Treinos" action={<NewPlanButton />} />
      {[0, 1, 2].map((index) => (
        <div key={index} aria-hidden className="h-20.5 rounded-card border border-line bg-card" />
      ))}
    </>
  );
}
