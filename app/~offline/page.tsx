import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { buttonStyles } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Sem conexão" };

/** Fallback do service worker quando uma página não está no cache e não há rede. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <BrandMark />
      <div className="flex flex-col items-center gap-3">
        <Label tone="accent">Offline</Label>
        <h1 className="font-display text-title font-semibold">Sem conexão</h1>
        <p className="max-w-72 text-sm text-fg/60">
          Essa tela ainda não foi salva no aparelho. Quando a internet voltar, o PFitness recarrega
          sozinho.
        </p>
      </div>
      {/* Link comum: força uma navegação nova em vez de usar o roteador do cliente */}
      <a href="/hoje" className={buttonStyles({ size: "lg", className: "w-full" })}>
        Tentar de novo
      </a>
    </main>
  );
}
