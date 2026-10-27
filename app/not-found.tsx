import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { buttonStyles } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <BrandMark />
      <div className="flex flex-col items-center gap-3">
        <Label tone="accent">Erro 404</Label>
        <h1 className="font-display text-title font-semibold">Não encontrado</h1>
        <p className="text-sm text-fg/60">Essa página não existe ou não é sua.</p>
      </div>
      <Link href="/hoje" className={buttonStyles({ size: "lg", className: "w-full" })}>
        Voltar ao início
      </Link>
    </main>
  );
}
