import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Conteúdo de uma aba, com a animação de entrada do protótipo. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="flex animate-screen-in flex-col gap-3">{children}</div>;
}

type ScreenHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Elemento à direita do título (ex.: avatar, botão "+"). */
  action?: ReactNode;
};

export function ScreenHeader({ title, eyebrow, action }: ScreenHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 px-0.5 py-1">
      <div className="flex min-w-0 flex-col gap-2">
        {/* Espaço reservado mantém a altura quando não há eyebrow */}
        <Label>{eyebrow ?? " "}</Label>
        <h1 className="truncate font-display text-title font-semibold">{title}</h1>
      </div>
      {action}
    </header>
  );
}

/** Fallback do cabeçalho enquanto os dados do usuário chegam. */
export function ScreenHeaderSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 px-0.5 py-1">
      <span className="h-[10.5px] w-24 rounded-sm bg-white/6" />
      <span className="h-7.5 w-48 rounded-md bg-white/6" />
    </div>
  );
}
