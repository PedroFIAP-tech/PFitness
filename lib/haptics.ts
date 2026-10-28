/** Vibra quando o aparelho suporta (o Safari do iPhone não suporta). */
export function vibrate(pattern: number | number[]) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}
