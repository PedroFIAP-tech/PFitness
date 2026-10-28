import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Screen, ScreenHeader, ScreenHeaderSkeleton } from "@/components/app-shell/screen";
import { getCurrentProfile } from "@/lib/auth";
import { formatDayLabel } from "@/lib/date";
import { initials } from "@/lib/format";
import { getHomeData } from "@/lib/home";
import { NutritionCard } from "./nutrition-card";
import { PointsCard } from "./points-card";
import { StreakCard } from "./streak-card";
import { WorkoutCard } from "./workout-card";

export const metadata: Metadata = { title: "Hoje" };

export default function HojePage() {
  return (
    <Screen>
      <Suspense fallback={<HojeSkeleton />}>
        <HojeContent />
      </Suspense>
    </Screen>
  );
}

async function HojeContent() {
  // Primeiro acesso: o onboarding calcula as metas antes de mostrar a Hoje
  const profile = await getCurrentProfile();
  if (!profile.onboarded_at) redirect("/onboarding");

  const data = await getHomeData();

  return (
    <>
      <ScreenHeader
        eyebrow={formatDayLabel()}
        title={`Fala, ${data.name.split(" ")[0]}`}
        action={
          <Link
            href="/perfil"
            aria-label="Abrir perfil"
            className="grid size-12 shrink-0 place-items-center rounded-full border border-lime/40 bg-white/4 font-display text-[15px] font-semibold shadow-glow-sm transition-transform duration-150 active:scale-[.92]"
          >
            {initials(data.name)}
          </Link>
        }
      />
      <StreakCard {...data.streak} />
      <WorkoutCard workout={data.workout} division={data.division} />
      <NutritionCard {...data.nutrition} />
      <PointsCard {...data.points} />
    </>
  );
}

function HojeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <ScreenHeaderSkeleton />
      <div className="h-37 rounded-card border border-line bg-white/3" />
      <div className="h-80 rounded-hero border border-lime/15 bg-lime/3" />
      <div className="h-79 rounded-card border border-line bg-white/3" />
      <div className="h-72 rounded-card border border-line bg-white/3" />
    </div>
  );
}
