import { useEffect, useState } from "react";

/** Progresso 0→1 com desaceleração, para contagens animadas (ex.: kg do PR). */
export function useTween(durationMs: number, delayMs = 0) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delayMs;
    const step = (now: number) => {
      const linear = Math.min(1, Math.max(0, (now - start) / durationMs));
      setProgress(1 - (1 - linear) ** 3);
      if (linear < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, delayMs]);

  return progress;
}
