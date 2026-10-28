import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Screen } from "@/components/app-shell/screen";
import { Button } from "@/components/ui/button";
import { getProfilePageData } from "@/lib/profile-data";
import { ProfileScreen } from "./profile-screen";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage({ searchParams }: PageProps<"/perfil">) {
  return (
    <Screen>
      <Suspense fallback={<PerfilSkeleton />}>
        <PerfilContent searchParams={searchParams} />
      </Suspense>

      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full text-fg/60">
          Sair da conta
        </Button>
      </form>
    </Screen>
  );
}

async function PerfilContent({ searchParams }: Pick<PageProps<"/perfil">, "searchParams">) {
  const [data, params] = await Promise.all([getProfilePageData(), searchParams]);
  // ?metas=atualizadas: voltou do "Refazer onboarding"
  const notice = params.metas === "atualizadas" ? "Metas atualizadas" : null;
  // A aba fica preservada entre visitas: a key remonta a tela para o aviso aparecer
  return <ProfileScreen key={notice ?? "perfil"} data={data} notice={notice} />;
}

function PerfilSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="flex items-center gap-4 py-1">
        <span className="size-20 rounded-full bg-white/6" />
        <div className="flex flex-col gap-2">
          <span className="h-6 w-40 rounded-md bg-white/6" />
          <span className="h-3 w-32 rounded-sm bg-white/6" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-28 rounded-[18px] border border-white/8 bg-white/[0.035]" />
        ))}
      </div>
      <div className="h-30 rounded-card border border-line bg-white/3" />
      <div className="h-62 rounded-card border border-line bg-white/3" />
      <div className="h-80 rounded-card border border-line bg-white/3" />
    </div>
  );
}
