/** Fuso do app. É o mesmo usado por `current_streak()` no banco. */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/**
 * Data de hoje (YYYY-MM-DD) em America/Sao_Paulo.
 *
 * Use sempre que gravar colunas `date` (valid_from, eaten_on, logged_on): o
 * default `current_date` do banco é UTC e, depois das 21h no Brasil, gravaria
 * o dia seguinte.
 */
export function todayInAppTimeZone(now: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

/** Dias de calendário (em America/Sao_Paulo) entre `date` e `now`. */
export function calendarDaysAgo(date: Date, now: Date = new Date()): number {
  const dayStart = (d: Date) => Date.parse(`${todayInAppTimeZone(d)}T00:00:00Z`);
  return Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
}

/** "hoje", "ontem", "há 7 dias". */
export function formatDaysAgo(date: Date, now: Date = new Date()): string {
  const days = calendarDaysAgo(date, now);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

const dayLabelFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Rótulo curto do dia, ex.: "seg · 26 out". */
export function formatDayLabel(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    dayLabelFormat.formatToParts(now).map((part) => [part.type, part.value.replace(".", "")]),
  );
  return `${parts.weekday} · ${parts.day} ${parts.month}`;
}

const monthYearFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  year: "numeric",
});

/** Ex.: "mar 2026". */
export function formatMonthYear(date: Date): string {
  return monthYearFormat.format(date).replace(".", "").replace(" de ", " ");
}
