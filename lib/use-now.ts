import { useEffect, useState } from "react";

/** Relógio que atualiza a cada `intervalMs` e ao voltar para o app. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);

  return now;
}
