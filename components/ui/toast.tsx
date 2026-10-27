"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/use-is-client";

type ToastTone = "default" | "error";
type ToastMessage = { id: number; text: string; tone: ToastTone };

const DURATION_MS = 2200;

/**
 * Aviso curto vindo do topo, como no protótipo.
 * Uso: `const [toast, showToast] = useToast()` e renderize `{toast}`.
 * `initialText` mostra um aviso assim que o componente monta (ex.: "Ficha salva").
 */
export function useToast(initialText?: string) {
  const isClient = useIsClient();
  const [message, setMessage] = useState<ToastMessage | null>(
    initialText ? { id: 0, text: initialText, tone: "default" } : null,
  );

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), DURATION_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  const showToast = useCallback((text: string, tone: ToastTone = "default") => {
    setMessage({ id: Date.now(), text, tone });
  }, []);

  // Portal no body: as telas animam com transform, que mudaria a referência do `fixed`
  const toast = isClient
    ? createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-50 flex justify-center px-4"
        >
          {message && (
            <span
              key={message.id}
              role={message.tone === "error" ? "alert" : "status"}
              className={cn(
                "max-w-full animate-toast-in rounded-2xl border bg-[rgb(16_20_14/0.92)] px-4 py-3 text-[13px] font-medium shadow-[0_12px_30px_rgb(0_0_0/0.5)] backdrop-blur-lg",
                message.tone === "error" ? "border-danger/45 text-danger" : "border-lime/45 text-fg",
              )}
            >
              {message.text}
            </span>
          )}
        </div>,
        document.body,
      )
    : null;

  return [toast, showToast] as const;
}
