"use client";

import Link from "next/link";
import { useId } from "react";
import { buttonStyles } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { cn } from "@/lib/cn";
import { formatNumber, plural } from "@/lib/format";
import type { ActiveSession } from "@/lib/workout-session";
import type { PlanOverview } from "@/lib/workouts";

type PlanCardProps = {
  plan: PlanOverview;
  isNext: boolean;
  activeSession: ActiveSession | null;
  open: boolean;
  onToggle: () => void;
};

export function PlanCard({ plan, isNext, activeSession, open, onToggle }: PlanCardProps) {
  const bodyId = useId();
  const totalSets = plan.exercises.reduce((sum, item) => sum + item.targetSets, 0);
  const meta = [
    plural(plan.exercises.length, "exercício", "exercícios"),
    plural(totalSets, "série", "séries"),
    plan.lastDoneLabel,
  ].join(" · ");

  return (
    <article
      className={cn(
        "rounded-card border bg-card shadow-card transition-colors duration-300",
        open ? "border-lime/25" : "border-line",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3.5 p-3.5 text-left"
      >
        <span
          className={cn(
            "grid size-13.5 shrink-0 place-items-center rounded-[15px] border font-display text-[26px] font-bold transition-all duration-300",
            open ? "border-lime/55 bg-lime/12 shadow-glow" : "border-white/10 bg-white/4",
            open || isNext ? "text-lime" : "text-fg",
          )}
        >
          {plan.code}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-lg leading-[1.1] font-semibold">{plan.title}</span>
            {isNext && (
              <span className="flex h-5 shrink-0 items-center rounded-md bg-lime px-1.75 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-on-lime">
                HOJE
              </span>
            )}
          </span>
          <span className="font-mono text-[11.5px] font-medium text-fg/50">{meta}</span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4.5 shrink-0 text-fg/60 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Expansão: a altura anima via grid-rows e o conteúdo entra com fade + subida */}
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-400 ease-snap",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            inert={!open}
            className={cn(
              "flex flex-col px-3.5 pb-3.5 transition-[opacity,translate] duration-350 ease-snap",
              open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            )}
          >
            {plan.exercises.length === 0 ? (
              <p className="border-t border-white/6 py-3 text-[13px] text-fg/50">Nenhum exercício ainda.</p>
            ) : (
              <ol>
                {plan.exercises.map(({ exercise, targetSets, targetReps }, index) => {
                  const lastLoad = plan.lastLoadKg[exercise.id];
                  return (
                    <li
                      key={`${exercise.id}-${index}`}
                      className="flex min-h-11.5 items-center gap-3 border-t border-white/6"
                    >
                      <span className="w-5.5 font-mono text-[11px] font-medium text-fg/40">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
                        <span className="truncate text-sm font-medium">{exercise.name}</span>
                        <span className="text-[11px] text-fg/45">{exercise.muscleGroup}</span>
                      </span>
                      <span className="font-mono text-[13px] font-semibold text-lime">
                        {targetSets}×{targetReps}
                      </span>
                      <span className="w-14 text-right font-mono text-xs font-medium text-fg/60">
                        {lastLoad ? `${formatNumber(lastLoad, 1)} kg` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-2.5 grid grid-cols-[1fr_1.5fr] gap-2">
              <Link
                href={`/treinos/${plan.id}/editar`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Editar
              </Link>
              {plan.exercises.length > 0 ? (
                <StartWorkoutButton planId={plan.id} planCode={plan.code} active={activeSession} />
              ) : (
                <span className={buttonStyles({ size: "sm", className: "pointer-events-none opacity-40" })}>
                  Iniciar
                </span>
              )}

            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
