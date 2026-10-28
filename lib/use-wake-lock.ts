import { useEffect } from "react";

/**
 * Mantém a tela acesa enquanto o componente está visível (Screen Wake Lock API).
 * O navegador solta o bloqueio quando o app vai para segundo plano, então ele é
 * pedido de novo ao voltar. Sem suporte, não faz nada.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let active = true;

    const request = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (active) sentinel = lock;
        else void lock.release();
      } catch {
        // Recusado (bateria baixa, modo economia): a tela apaga normalmente
      }
    };

    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release();
    };
  }, []);
}
