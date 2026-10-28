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

/** Carga com até 2 casas: 42,5 · 41,25. */
export function formatKg(value: number): string {
  return formatNumber(value, 2);
}

/** Volume do treino: 6.192 ou, a partir de 10 toneladas, "10,2t". */
export function formatVolume(kg: number): string {
  return kg >= 10_000 ? `${formatNumber(kg / 1000, 1)}t` : formatNumber(kg);
}

/** Cronômetro: "01:05", "14:32" ou "1:02:05". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`;
}

/** "há 14 min", "há 1 h 05 min". */
export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** "1 série", "20 séries". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Texto para busca: sem acentos, minúsculo ("Tríceps" → "triceps"). */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Iniciais para avatar: "Lucas Martins" → "LM". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0][0], words.at(-1)![0]] : [words[0]?.[0] ?? "?"];
  return letters.join("").toUpperCase();
}
