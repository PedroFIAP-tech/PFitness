import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FocusHeader } from "@/components/app-shell/focus-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StatNumber } from "@/components/ui/stat-number";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { estimatePlanMinutes } from "@/lib/workout-rules";
import { getWorkoutForPlan, type ActiveSession } from "@/lib/workout-session";
import { parsePlanId, type WorkoutPlan } from "@/lib/workouts";
import { WorkoutScreen } from "./workout-screen";

export const metadata: Metadata = { title: "Treino" };

export default function TreinoPage({ params }: PageProps<"/treino/[planId]">) {
  return (
    <Suspense fallback={<FocusHeader backHref="/treinos" label="Treino" />}>
      <Workout params={params} />
    </Suspense>
  );
}

async function Workout({ params }: Pick<PageProps<"/treino/[planId]">, "params">) {
  const planId = parsePlanId((await params).planId);
  if (planId === null) notFound();
  const workout = await getWorkoutForPlan(planId);
  if (!workout) notFound();

  // Treino desta ficha em andamento: retoma. A chave remonta a tela num treino novo.
  if (workout.session) return <WorkoutScreen key={workout.session.sessionId} data={workout.session} />;
  return <StartScreen plan={workout.plan} active={workout.active} />;
}

/** Sem treino em andamento desta ficha: resumo da ficha e "Começar treino". */
function StartScreen({ plan, active }: { plan: WorkoutPlan; active: ActiveSession | null }) {
  const totalSets = plan.exercises.reduce((sum, item) => sum + item.targetSets, 0);

  return (
    <>
      <FocusHeader backHref="/treinos" label={`Treino ${plan.code}`} />
      <div className="flex flex-col gap-3 px-3.5 pt-2">
        <Card variant="accent">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-4.5 -right-1.5 font-display text-[150px] leading-none font-bold text-lime/6"
          >
            {plan.code}
          </span>
          <div className="relative flex flex-col gap-1.5">
            <Label tone="accent">Treino {plan.code}</Label>
            <h1 className="font-display text-[32px] leading-none font-semibold">{plan.title}</h1>
          </div>
          <dl className="relative mt-4 grid grid-cols-3 border-y border-line">
            {[
              ["Exercícios", plan.exercises.length],
              ["Séries", totalSets],
              ["Duração", `${estimatePlanMinutes(totalSets)}′`],
            ].map(([label, value], index) => (
              <div key={label} className={index ? "flex flex-col gap-1.25 border-l border-line py-2.5 pl-3" : "flex flex-col gap-1.25 py-2.5"}>
                <dt className="font-mono text-[9.5px] leading-none font-medium tracking-label text-fg/50 uppercase">
                  {label}
                </dt>
                <dd>
                  <StatNumber value={value} />
                </dd>
              </div>
            ))}
          </dl>
          {plan.exercises.length === 0 ? (
            <p className="relative mt-4 text-sm text-fg/60">
              Essa ficha ainda não tem exercícios. Edite a ficha antes de começar.
            </p>
          ) : (
            <StartWorkoutButton
              planId={plan.id}
              planCode={plan.code}
              active={active}
              size="lg"
              className="relative mt-4 w-full"
            />
          )}
        </Card>
      </div>
    </>
  );
}
