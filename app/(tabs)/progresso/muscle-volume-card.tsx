import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatVolume } from "@/lib/progress-model";
import { plural } from "@/lib/format";

type MuscleVolume = { muscleGroup: string; volumeKg: number; sets: number };

/** Volume (kg × reps) por grupo muscular nas últimas 4 semanas, em barras horizontais. */
export function MuscleVolumeCard({ groups }: { groups: MuscleVolume[] }) {
  const max = Math.max(0, ...groups.map((group) => group.volumeKg));
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>Volume por grupo</Label>
        <span className="font-mono text-[11px] font-medium text-fg/55">4 semanas</span>
      </div>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-fg/60">Sem treinos concluídos nas últimas 4 semanas.</p>
      ) : (
        <ul className="mt-3.5 flex flex-col gap-3">
          {groups.map((group, index) => (
            <li key={group.muscleGroup} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium">{group.muscleGroup}</span>
                <span className="font-mono text-xs text-fg/60">
                  {group.volumeKg > 0 ? `${formatVolume(group.volumeKg)} · ` : ""}
                  {plural(group.sets, "série", "séries")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-[4px] bg-white/6">
                <div
                  className={
                    index === 0
                      ? "h-full origin-left animate-bar-x rounded-[4px] bg-lime shadow-[0_0_10px_oklch(0.9_0.2_128/0.55)]"
                      : "h-full origin-left animate-bar-x rounded-[4px] bg-lime/45"
                  }
                  style={{
                    width: `${max > 0 ? Math.max(2, (group.volumeKg / max) * 100).toFixed(1) : 2}%`,
                    animationDelay: `${index * 0.06}s`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
