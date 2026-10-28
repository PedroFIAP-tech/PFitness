"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/use-is-client";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Texto pequeno acima do título (ex.: "ADICIONAR AO"). */
  eyebrow?: ReactNode;
  /** Botão antes do título (ex.: voltar). */
  leading?: ReactNode;
  /** Ação no canto do cabeçalho (ex.: "Concluído"). */
  action?: ReactNode;
  /** Conteúdo fixo abaixo do título (busca, filtros). */
  header?: ReactNode;
  children: ReactNode;
  /** `tall`: 84% da tela, com rolagem interna (biblioteca). `auto`: altura do conteúdo. */
  size?: "tall" | "auto";
  /** Muda a cada passo do sheet: o conteúdo entra com animação e a rolagem volta ao topo. */
  stepKey?: string;
};

/** Bottom sheet do protótipo: fundo desfocado, alça e subida com mola. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  leading,
  action,
  header,
  children,
  size = "auto",
  stepKey,
}: SheetProps) {
  const titleId = useId();
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !isClient) return null;

  // Portal no body: as telas animam com transform, que mudaria a referência do `fixed`
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-xs"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-w-md animate-sheet-up flex-col rounded-t-[28px] border-t border-white/10 bg-[rgb(12_15_18/0.97)]",
          size === "tall" ? "h-[84dvh]" : "max-h-[84dvh]",
        )}
      >
        <div className="flex flex-col gap-3 px-4 pt-2.5">
          <span aria-hidden className="h-1.25 w-10 self-center rounded-full bg-white/20" />
          <div className="flex min-h-12 items-center justify-between gap-3">
            {leading}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {eyebrow && (
                <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50 uppercase">
                  {eyebrow}
                </span>
              )}
              <h2 id={titleId} className="font-display text-xl leading-tight font-semibold">
                {title}
              </h2>
            </div>
            {action}
          </div>
          {header}
        </div>
        <div
          key={stepKey}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)]",
            stepKey && "animate-item-in",
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
