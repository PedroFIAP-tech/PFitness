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
  const [{ plans, nextPlanId }, params] = await Promise.all([getPlansOverview(), searchParams]);
  const savedPlanId = Number(params.ficha) || null;
  const deletedCode = typeof params.excluida === "string" ? params.excluida : null;

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
          key={savedPlanId ?? deletedCode ?? "fichas"}
          plans={plans}
          nextPlanId={nextPlanId}
          savedPlanId={savedPlanId}
          deletedCode={deletedCode}
        />
      )}
    </>
  );
}

function NewPlanButton() {
  return (
    <Link href="/treinos/nova" aria-label="Criar nova ficha" className={iconButtonStyles({ variant: "accent" })}>
      <PlusIcon className="size-5" />
    </Link>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-start gap-3 p-5">
      <Label tone="accent">Comece por aqui</Label>
      <h2 className="font-display text-xl font-semibold">Monte sua primeira ficha</h2>
      <p className="text-sm leading-relaxed text-fg/60">
        Escolha os exercícios e defina séries e repetições. A próxima ficha da sequência ganha o selo
        HOJE.
      </p>
      <Link href="/treinos/nova" className={buttonStyles({ size: "md", className: "mt-2 w-full" })}>
        Criar primeira ficha
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
