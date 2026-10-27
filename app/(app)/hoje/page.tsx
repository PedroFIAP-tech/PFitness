import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Screen, ScreenHeader, ScreenHeaderSkeleton } from "@/components/app-shell/screen";
import { getCurrentProfile } from "@/lib/auth";
import { formatDayLabel } from "@/lib/date";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "Hoje" };

export default function HojePage() {
  return (
    <Screen>
      <Suspense fallback={<ScreenHeaderSkeleton />}>
        <HojeHeader />
      </Suspense>
    </Screen>
  );
}

async function HojeHeader() {
  const profile = await getCurrentProfile();
  const firstName = profile.name.split(" ")[0];

  return (
    <ScreenHeader
      eyebrow={formatDayLabel()}
      title={`Fala, ${firstName}`}
      action={
        <Link
          href="/perfil"
          aria-label="Abrir perfil"
          className="grid size-12 shrink-0 place-items-center rounded-full border border-lime/40 bg-white/4 font-display text-[15px] font-semibold shadow-glow-sm transition-transform duration-150 active:scale-[.92]"
        >
          {initials(profile.name)}
        </Link>
      }
    />
  );
}
