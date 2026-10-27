import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true depois da hidratação; permite usar `document` (ex.: portais) sem efeito extra. */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
