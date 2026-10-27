import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Screen, ScreenHeader, ScreenHeaderSkeleton } from "@/components/app-shell/screen";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { formatMonthYear } from "@/lib/date";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage() {
  return (
    <Screen>
      <Suspense fallback={<ScreenHeaderSkeleton />}>
        <PerfilHeader />
      </Suspense>

      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary" className="w-full">
          Sair da conta
        </Button>
      </form>
    </Screen>
  );
}

async function PerfilHeader() {
  const profile = await getCurrentProfile();
  return (
    <ScreenHeader
      eyebrow={`Membro desde ${formatMonthYear(new Date(profile.created_at))}`}
      title={profile.name}
    />
  );
}
