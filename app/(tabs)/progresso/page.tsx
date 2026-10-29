import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen, ScreenHeaderSkeleton } from "@/components/app-shell/screen";
import { getProgressData } from "@/lib/progress";
import { ProgressScreen } from "./progress-screen";

export const metadata: Metadata = { title: "Progresso" };

export default function ProgressoPage() {
  return (
    <Screen>
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </Screen>
  );
}

async function ProgressContent() {
  const data = await getProgressData();
  return <ProgressScreen data={data} />;
}

function ProgressSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <ScreenHeaderSkeleton />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-18 rounded-[18px] border border-white/8 bg-white/[0.035]" />
        ))}
      </div>
      <div className="h-80 rounded-card border border-line bg-white/3" />
      <div className="h-72 rounded-card border border-line bg-white/3" />
      <div className="h-80 rounded-card border border-line bg-white/3" />
    </div>
  );
}
