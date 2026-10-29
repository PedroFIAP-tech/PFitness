import type { ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { formatMinutes, formatVolume, monthLabel, monthStats, type TrainingDay } from "@/lib/progress-model";

/** Este mês: treinos, volume total, duração média e tempo total. */
export function MonthStats({ days, today }: { days: TrainingDay[]; today: string }) {
  const stats = monthStats(days, today);
  return (
    <section aria-label="Este mês" className="flex flex-col gap-2">
      <Label className="px-0.5">Este mês · {monthLabel(today)}</Label>
      <dl className="grid grid-cols-2 gap-2">
        <Tile label="Treinos" accent>
          <CountUp value={stats.sessions} />
        </Tile>
        <Tile label="Volume total">{formatVolume(stats.volumeKg)}</Tile>
        <Tile label="Duração média">{stats.averageS === null ? "—" : formatMinutes(stats.averageS)}</Tile>
        <Tile label="Tempo total">{formatMinutes(stats.totalS)}</Tile>
      </dl>
    </section>
  );
}

function Tile({ label, accent = false, children }: { label: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-[18px] border p-3.5", accent ? "border-lime/25 bg-lime/5" : "border-white/8 bg-white/[0.035]")}>
      <dt className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50 uppercase">{label}</dt>
      <dd className={cn("font-mono text-[22px] leading-none font-semibold tracking-[-0.03em] tabular-nums", accent && "text-lime")}>{children}</dd>
    </div>
  );
}
