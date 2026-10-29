"use client";

import { ScreenHeader } from "@/components/app-shell/screen";
import { useToast } from "@/components/ui/toast";
import { GOAL_LABEL } from "@/lib/nutrition-calc";
import type { ProgressData } from "@/lib/progress";
import { ConsistencyCard } from "./consistency-card";
import { LoadCard } from "./load-card";
import { MonthStats } from "./month-stats";
import { MuscleVolumeCard } from "./muscle-volume-card";
import { WeightCard } from "./weight-card";

/** Aba Progresso (tela 10). */
export function ProgressScreen({ data }: { data: ProgressData }) {
  const [toast, showToast] = useToast();
  return (
    <>
      <ScreenHeader eyebrow={`Objetivo · ${GOAL_LABEL[data.goal]}`} title="Progresso" />
      <MonthStats days={data.days} today={data.today} />
      <WeightCard weights={data.weights} today={data.today} onToast={showToast} />
      <LoadCard loads={data.loads} today={data.today} />
      <MuscleVolumeCard groups={data.muscleVolume} />
      <ConsistencyCard days={data.days} today={data.today} streak={data.streak} />
      {toast}
    </>
  );
}
