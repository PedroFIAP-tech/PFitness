const numberFormats = new Map<number, Intl.NumberFormat>();

/** Número no padrão pt-BR: 1.582 · 42,5. */
export function formatNumber(value: number, maxDecimals = 0): string {
  let format = numberFormats.get(maxDecimals);
  if (!format) {
    format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxDecimals });
    numberFormats.set(maxDecimals, format);
  }
  return format.format(value);
}

/** Iniciais para avatar: "Lucas Martins" → "LM". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0][0], words.at(-1)![0]] : [words[0]?.[0] ?? "?"];
  return letters.join("").toUpperCase();
}
