import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { formatNumber } from "@/lib/format";
import type { TodayWorkout } from "@/lib/home";
import { estimatePlanMinutes } from "@/lib/workout-rules";
import type { WorkoutPlan } from "@/lib/workouts";
import { ContinueWorkoutButton } from "./continue-workout-button";

const CHIP_COUNT = 3;

/** Card "Treino do dia": a ficha do badge HOJE, o treino em andamento ou o concluído hoje. */
export function WorkoutCard({ workout, division }: { workout: TodayWorkout; division: string }) {
  if (workout.state === "no-plans") return <FirstPlanCard />;

  const plan = workout.plan;
  const code = workout.state === "done" ? workout.summary.planCode : (plan?.code ?? null);
  const subtitle =
    workout.state === "done" ? workout.summary.title : workout.state === "active" ? workout.session.title : workout.plan.title;

  return (
    <Card variant="accent" className="shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_20px_50px_-20px_oklch(0.9_0.2_128/0.25)]">
      {code && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-4.5 -right-1.5 font-display text-[150px] leading-none font-bold text-lime/6"
        >
          {code}
        </span>
      )}
      <div className="relative flex items-center justify-between">
        <Label tone="accent" className="flex items-center gap-2">
          <span aria-hidden className="size-1.5 animate-blink rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)]" />
          Treino do dia
        </Label>
        {division.length > 1 && <Label>Divisão {division}</Label>}
      </div>

      <div className="relative mt-4 flex flex-col gap-1.5">
        <h2 className="font-display text-[32px] leading-none font-semibold">{code ? `Treino ${code}` : "Treino"}</h2>
        <span className="truncate text-base font-medium text-fg/72">{subtitle}</span>
      </div>

      {plan && <PlanDetails plan={plan} />}

      <div className="relative mt-4">
        {workout.state === "idle" &&
          (workout.plan.exercises.length > 0 ? (
            <StartWorkoutButton
              planId={workout.plan.id}
              planCode={workout.plan.code}
              active={workout.activeSession}
              size="lg"
              label="Começar treino"
              className="w-full"
            />
          ) : (
            <Link
              href={`/treinos/${workout.plan.id}/editar`}
              className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full" })}
            >
              Adicionar exercícios
            </Link>
          ))}
        {workout.state === "active" && workout.session.planId !== null && (
          <ContinueWorkoutButton planId={workout.session.planId} startedAt={workout.session.startedAt} />
        )}
        {workout.state === "done" && (
          <div className="flex h-15 animate-pop items-center gap-3 rounded-button border border-lime/45 bg-lime/10 px-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lime text-on-lime shadow-[0_0_16px_oklch(0.9_0.2_128/0.7)]">
              <CheckIcon className="size-4" strokeWidth={2.8} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-display text-[15px] leading-none font-semibold tracking-[0.04em]">Treino concluído</span>
              <span className="truncate font-mono text-xs font-medium text-fg/60">
                {Math.max(1, Math.round(workout.summary.durationSeconds / 60))} min ·{" "}
                {formatNumber(workout.summary.volumeKg)} kg · +{formatNumber(workout.summary.points.total)} pts
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function PlanDetails({ plan }: { plan: WorkoutPlan }) {
  const totalSets = plan.exercises.reduce((sum, item) => sum + item.targetSets, 0);
  const extra = plan.exercises.length - CHIP_COUNT;

  return (
    <>
      <dl className="relative mt-4 grid grid-cols-3 border-y border-white/8">
        <Stat label="Exercícios" value={String(plan.exercises.length)} />
        <Stat label="Séries" value={String(totalSets)} divider />
        <Stat label="Duração" value={`${estimatePlanMinutes(totalSets)}′`} divider />
      </dl>
      {plan.exercises.length > 0 && (
        <ul aria-label="Exercícios" className="relative mt-3.5 flex flex-wrap gap-1.5">
          {plan.exercises.slice(0, CHIP_COUNT).map(({ exercise }) => (
            <li
              key={exercise.id}
              className="flex h-6.5 max-w-full items-center truncate rounded-[13px] border border-white/7 bg-white/5 px-2.5 text-xs font-medium text-fg/75"
            >
              {exercise.name}
            </li>
          ))}
          {extra > 0 && (
            <li className="flex h-6.5 items-center rounded-[13px] border border-white/7 bg-white/5 px-2.5 text-xs font-medium text-fg/75">
              +{extra}
            </li>
          )}
        </ul>
      )}
    </>
  );
}

function Stat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={divider ? "flex flex-col gap-1.25 border-l border-white/8 py-2.5 pl-3" : "flex flex-col gap-1.25 py-2.5"}>
      <dt className="font-mono text-[9.5px] leading-none font-medium tracking-[0.14em] text-fg/50 uppercase">{label}</dt>
      <dd className="font-mono text-xl leading-none font-semibold">{value}</dd>
    </div>
  );
}

function FirstPlanCard() {
  return (
    <Card variant="accent" className="flex flex-col items-start gap-3">
      <Label tone="accent">Treino do dia</Label>
      <h2 className="font-display text-2xl font-semibold">Monte sua primeira ficha</h2>
      <p className="text-sm leading-relaxed text-fg/60">
        Escolha os exercícios e defina séries e repetições. A ficha da vez aparece aqui todo dia, pronta para
        começar.
      </p>
      <Link href="/treinos/nova" className={buttonStyles({ size: "lg", className: "mt-1 w-full" })}>
        Criar primeira ficha
      </Link>
    </Card>
  );
}
