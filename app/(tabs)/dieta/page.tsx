import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen, ScreenHeaderSkeleton } from "@/components/app-shell/screen";
import { parseDay, todayInAppTimeZone } from "@/lib/date";
import { getDiaryDay } from "@/lib/diet";
import { DietScreen } from "./diet-screen";

export const metadata: Metadata = { title: "Alimentação" };

export default function DietaPage({ searchParams }: PageProps<"/dieta">) {
  return (
    <Screen>
      <Suspense fallback={<DietSkeleton />}>
        <DietContent searchParams={searchParams} />
      </Suspense>
    </Screen>
  );
}

async function DietContent({ searchParams }: Pick<PageProps<"/dieta">, "searchParams">) {
  const params = await searchParams;
  const today = todayInAppTimeZone();
  // ?dia=YYYY-MM-DD abre um dia passado; sem ele (ou com data futura/inválida), hoje
  const requested = parseDay(params.dia);
  const day = requested && requested < today ? requested : today;
  const diary = await getDiaryDay(day);

  return <DietScreen diary={diary} today={today} />;
}

function DietSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <ScreenHeaderSkeleton />
      <div className="h-14 rounded-[18px] border border-line bg-white/3" />
      <div className="h-62 rounded-card border border-line bg-white/3" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-30 rounded-card border border-line bg-white/3" />
      ))}
    </div>
  );
}
