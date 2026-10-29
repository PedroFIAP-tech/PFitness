"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { markAchievementsSeen } from "@/app/(tabs)/perfil/actions";
import { AchievementHexagon } from "@/components/achievements/achievement-hexagon";
import { AchievementSheet } from "@/components/achievements/achievement-sheet";
import { buttonStyles } from "@/components/ui/button";
import { ChevronRightIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { formatDuration, formatKg, formatNumber, plural } from "@/lib/format";
import { useTween } from "@/lib/use-tween";
import type { WorkoutSummary } from "@/lib/workout-session";

const HEXAGON = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";
/** A conquista nova abre depois das animações do resumo (stats, PRs e pontos). */
const NEW_ACHIEVEMENT_DELAY_MS = 1800;

/** Resumo do treino concluído (tela 07). */
export function SummaryView({ summary, streakBefore }: { summary: WorkoutSummary; streakBefore: number }) {
  const points = useTween(1200, 500);
  const streakProgress = useTween(700, 1100);
  const streak = Math.round(streakBefore + (summary.streak - streakBefore) * streakProgress);
  const streakUp = summary.streak > streakBefore && streakProgress >= 1;
  // Guardadas na entrada: depois de marcadas como vistas, o servidor já não as manda
  const [newAchievements] = useState(summary.newAchievements);
  const [openAchievement, setOpenAchievement] = useState<number | null>(null);

  useEffect(() => {
    if (newAchievements.length === 0) return;
    const timeout = setTimeout(() => {
      setOpenAchievement(0);
      void markAchievementsSeen(newAchievements.map((achievement) => achievement.id));
    }, NEW_ACHIEVEMENT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [newAchievements]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Raios, explosão de luz e anel atrás do selo */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+190px)] left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 animate-[rays_40s_linear_infinite] bg-[repeating-conic-gradient(oklch(0.9_0.2_128/0.08)_0deg_3deg,transparent_3deg_15deg)] [mask-image:radial-gradient(closest-side,#000_10%,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+190px)] left-1/2 size-50 -translate-x-1/2 -translate-y-1/2 animate-[burst_1.3s_cubic-bezier(0.1,0.7,0.3,1)_both] rounded-full bg-[radial-gradient(closest-side,oklch(0.95_0.14_128/0.8),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+190px)] left-1/2 size-42.5 -translate-x-1/2 -translate-y-1/2 animate-[ring-out_1.4s_0.2s_ease-out_both] rounded-full border-2 border-lime"
      />

      <main className="relative flex flex-col items-center gap-3.5 px-4 pt-[calc(env(safe-area-inset-top)+44px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="relative h-33.5 w-29.5 animate-[pop_0.8s_0.1s_cubic-bezier(0.2,0.9,0.3,1.2)_both] drop-shadow-[0_0_26px_oklch(0.9_0.2_128/0.55)]">
          <div
            className="absolute inset-0 bg-[linear-gradient(160deg,var(--color-lime),oklch(0.9_0.2_128/0.15)_50%,oklch(0.9_0.2_128/0.9))]"
            style={{ clipPath: HEXAGON }}
          />
          <div
            className="absolute inset-0.75 flex flex-col items-center justify-center gap-0.5 overflow-hidden bg-[radial-gradient(circle_at_50%_30%,oklch(0.9_0.2_128/0.3),#0a0d10_72%)]"
            style={{ clipPath: HEXAGON }}
          >
            <span className="font-display text-[50px] leading-none font-bold text-lime">{summary.planCode ?? "✓"}</span>
            <span className="font-mono text-[8.5px] leading-none font-semibold tracking-[0.18em] text-lime/75">
              COMPLETO
            </span>
            <span className="absolute inset-y-0 left-0 w-[30%] animate-shine bg-linear-to-r from-transparent via-white/35 to-transparent" />
          </div>
        </div>

        <Label tone="accent" className="mt-3 tracking-[0.2em]">
          Treino concluído
        </Label>
        <h1 className="text-center font-display text-[28px] leading-none font-semibold">{summary.title}</h1>

        <dl className="mt-2.5 grid w-full grid-cols-2 gap-2">
          <SummaryStat label="Volume total" value={formatNumber(summary.volumeKg)} unit="kg" />
          <SummaryStat label="Duração" value={formatDuration(summary.durationSeconds)} />
          <SummaryStat label="Séries" value={String(summary.setsDone)} unit={`/${summary.setsTotal}`} />
          <SummaryStat label="PRs batidos" value={String(summary.prs.length)} amber />
        </dl>

        {summary.prs.length > 0 && (
          <ul className="flex w-full flex-col gap-1.5">
            {summary.prs.map((pr, index) => (
              <li
                key={index}
                className="flex h-13.5 animate-[screen-in_0.5s_0.6s_both] items-center gap-3 rounded-2xl border border-amber/25 bg-white/3 px-3.5"
              >
                <span className="flex h-5.5 items-center rounded-md bg-amber px-1.75 font-mono text-[10.5px] font-bold text-[#1a1000]">
                  PR
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{pr.exerciseName}</span>
                <span className="font-mono text-[13px] font-semibold">
                  {formatKg(pr.weightKg)} kg × {pr.reps}
                </span>
                <span className="font-mono text-xs font-semibold text-lime">+{formatKg(pr.gainKg)} kg</span>
              </li>
            ))}
          </ul>
        )}

        {newAchievements.length > 0 && (
          <section className="flex w-full animate-[screen-in_0.5s_0.7s_both] flex-col gap-2.5 rounded-card border border-lime/30 bg-[linear-gradient(160deg,oklch(0.9_0.2_128/0.1),rgb(255_255_255/0.02)_60%)] p-4">
            <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-lime">
              {newAchievements.length > 1 ? "CONQUISTAS NOVAS" : "CONQUISTA NOVA"}
            </span>
            <ul className="flex flex-col gap-1">
              {newAchievements.map((achievement, index) => (
                <li key={achievement.id}>
                  <button
                    type="button"
                    onClick={() => setOpenAchievement(index)}
                    className="flex w-full items-center gap-3.5 py-1 text-left transition-transform duration-150 active:scale-[.98]"
                  >
                    <AchievementHexagon achievement={achievement} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-display text-[17px] leading-tight font-semibold">
                        {achievement.name}
                      </span>
                      <span className="line-clamp-2 text-xs leading-snug text-fg/60">{achievement.description}</span>
                    </span>
                    <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-fg/40" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex w-full flex-col gap-3 rounded-card border border-lime/30 bg-[linear-gradient(160deg,oklch(0.9_0.2_128/0.1),rgb(255_255_255/0.02)_60%)] p-4">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/55">
                PONTOS GANHOS
              </span>
              <span className="font-mono text-[42px] leading-none font-semibold tracking-[-0.05em] text-lime tabular-nums [text-shadow:0_0_22px_oklch(0.9_0.2_128/0.5)]">
                +{Math.round(summary.points.total * points)}
              </span>
            </div>
            <div
              aria-label={`Sequência de ${summary.streak} dias`}
              className="flex h-11 items-center gap-2 rounded-[14px] border border-amber/30 bg-amber/8 px-3"
            >
              <span aria-hidden className="relative h-5.5 w-4.5">
                <span className="absolute top-1.25 left-0.5 size-3.5 origin-[50%_60%] animate-flame rounded-[50%_0_50%_50%] bg-[linear-gradient(45deg,#FFD66B,#FF7A2A)] shadow-[0_0_12px_rgb(255_140_40/0.7)]" />
              </span>
              <span
                key={streakUp ? "up" : "counting"}
                className={cn(
                  "inline-block font-mono text-[22px] leading-none font-semibold text-amber tabular-nums",
                  streakUp && "animate-bump",
                )}
              >
                {streak}
              </span>
              <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-fg/60">
                {streak === 1 ? "DIA" : "DIAS"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.75 border-t border-white/8 pt-3 font-mono text-[12.5px] font-medium text-fg/70">
            <PointsLine label={`${plural(summary.points.sets, "série", "séries")} × 10`} points={summary.points.setPoints} />
            {summary.points.prs > 0 && (
              <PointsLine label={`${summary.points.prs} PR × 50`} points={summary.points.prPoints} />
            )}
            <PointsLine label="Treino concluído" points={summary.points.finishPoints} />
          </div>
        </section>

        <Link href="/hoje" replace className={buttonStyles({ size: "lg", className: "mt-1 w-full" })}>
          Voltar ao início
        </Link>
      </main>

      {openAchievement !== null && (
        <AchievementSheet
          key={openAchievement}
          queue={newAchievements}
          start={openAchievement}
          celebrate
          onClose={() => setOpenAchievement(null)}
        />
      )}
    </div>
  );
}

function SummaryStat({ label, value, unit, amber = false }: { label: string; value: string; unit?: string; amber?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[18px] border p-3.5",
        amber ? "border-amber/30 bg-amber/7" : "border-white/8 bg-white/[0.035]",
      )}
    >
      <dt className={cn("font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] uppercase", amber ? "text-amber" : "text-fg/50")}>
        {label}
      </dt>
      <dd className={cn("font-mono text-[26px] leading-none font-semibold tracking-[-0.04em] tabular-nums", amber && "text-amber")}>
        {value}
        {unit && <span className="text-[13px] font-medium tracking-normal text-fg/50"> {unit}</span>}
      </dd>
    </div>
  );
}

function PointsLine({ label, points }: { label: ReactNode; points: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>+{points}</span>
    </div>
  );
}
