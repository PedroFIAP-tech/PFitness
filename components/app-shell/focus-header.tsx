import Link from "next/link";
import type { ReactNode } from "react";
import { iconButtonStyles } from "@/components/ui/icon-button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";

type FocusHeaderProps = {
  backHref: string;
  label: string;
  /** Ação à direita (ex.: Salvar). Sem ação, um espaço mantém o label centralizado. */
  action?: ReactNode;
};

/** Barra fixa no topo das telas cheias: voltar, label técnico e ação. */
export function FocusHeader({ backHref, label, action }: FocusHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 bg-bg/85 px-3.5 pt-[calc(env(safe-area-inset-top)+14px)] pb-2.5 backdrop-blur-xl">
      <Link href={backHref} aria-label="Voltar" className={iconButtonStyles()}>
        <ChevronLeftIcon className="size-5" />
      </Link>
      <Label className="flex-1 text-center text-fg/60">{label}</Label>
      {action ?? <span aria-hidden className="size-12 shrink-0" />}
    </header>
  );
}
