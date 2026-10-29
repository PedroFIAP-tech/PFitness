import { dayToDate, shiftDay } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import { dropWeightOutliers, weightRegression, type WeightPoint } from "@/lib/nutrition-calc";

// Regras da aba Progresso (servidor e cliente). Medidas e fórmulas em
// docs/design-notes.md, seção 6.

// ---------------------------------------------------------------------
// Peso corporal
// ---------------------------------------------------------------------

export const WEIGHT_RANGES = [
  { id: "1M", days: 30, label: "no último mês" },
  { id: "3M", days: 91, label: "em 3 meses" },
  { id: "6M", days: 182, label: "em 6 meses" },
  { id: "1A", days: 365, label: "no último ano" },
] as const;

export type WeightRange = (typeof WEIGHT_RANGES)[number]["id"];

/** viewBox do gráfico de peso. */
export const WEIGHT_CHART = { width: 287, height: 154 } as const;

/** Folga de cada lado do eixo Y (kg) e faixa ocupada (8% a 92% da altura). */
const Y_PADDING_KG = 0.3;
const Y_TOP = 0.08;
const Y_SPAN = 0.84;

export type ChartPoint = WeightPoint & { x: number; y: number };

export type WeightChart = {
  points: ChartPoint[];
  line: string;
  area: string;
  /** Linha tracejada da regressão (mesma da meta adaptativa); null com menos de 3 pesagens */
  trend: { x1: number; y1: number; x2: number; y2: number; kgPerWeek: number } | null;
  /** Valores dos rótulos em 8%, 50% e 92% da altura */
  ticks: { top: number; mid: number; bottom: number };
  /** Datas dos rótulos do eixo X (início e meio; o fim é "hoje") */
  xStart: string;
  xMid: string;
  /** Último − primeiro peso do período */
  delta: number;
};

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/**
 * Pontos, caminhos e eixos do gráfico de peso de um período. O eixo X é
 * proporcional às datas (do primeiro peso do período até hoje).
 */
export function buildWeightChart(weights: WeightPoint[], range: WeightRange, today: string): WeightChart | null {
  const days = WEIGHT_RANGES.find((item) => item.id === range)!.days;
  const since = shiftDay(today, -days);
  const inRange = weights.filter((point) => point.day > since && point.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  if (inRange.length === 0) return null;

  const regression = inRange.length >= 3 ? weightRegression(dropWeightOutliers(inRange)) : null;
  const first = dayNumber(inRange[0].day);
  const last = dayNumber(inRange.at(-1)!.day);
  const trendKg = regression
    ? [regression.intercept + regression.slopePerDay * (first - dayNumber(regression.firstDay)),
       regression.intercept + regression.slopePerDay * (last - dayNumber(regression.firstDay))]
    : [];

  const values = [...inRange.map((point) => point.kg), ...trendKg];
  const min = Math.min(...values) - Y_PADDING_KG;
  const max = Math.max(...values) + Y_PADDING_KG;
  const domainStart = first;
  const domainEnd = Math.max(dayNumber(today), last);
  const span = domainEnd - domainStart;

  const x = (day: number) => (span === 0 ? WEIGHT_CHART.width : ((day - domainStart) / span) * WEIGHT_CHART.width);
  const y = (kg: number) => WEIGHT_CHART.height * (Y_TOP + (1 - (kg - min) / (max - min)) * Y_SPAN);

  const points = inRange.map((point) => ({ ...point, x: x(dayNumber(point.day)), y: y(point.kg) }));
  const line = `M${points.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L")}`;
  const lastX = points.at(-1)!.x.toFixed(1);
  const firstX = points[0].x.toFixed(1);
  const area = `${line} L${lastX} ${WEIGHT_CHART.height} L${firstX} ${WEIGHT_CHART.height} Z`;
  const round1 = (value: number) => Math.round(value * 10) / 10;

  return {
    points,
    line,
    area,
    trend: regression
      ? {
          x1: x(first),
          y1: y(trendKg[0]),
          x2: x(last),
          y2: y(trendKg[1]),
          kgPerWeek: Math.round(regression.slopePerDay * 7 * 100) / 100,
        }
      : null,
    ticks: {
      top: round1(min + (max - min) * (1 - Y_TOP)),
      mid: round1((max + min) / 2),
      bottom: round1(min + (max - min) * Y_TOP),
    },
    xStart: inRange[0].day,
    xMid: shiftDay(inRange[0].day, Math.round(span / 2)),
    delta: round1(inRange.at(-1)!.kg - inRange[0].kg),
  };
}

/** Índice do ponto mais perto de uma posição X (0 a 1 da largura). */
export function nearestPointIndex(points: { x: number }[], fraction: number): number {
  const target = fraction * WEIGHT_CHART.width;
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i].x - target) < Math.abs(points[best].x - target)) best = i;
  }
  return best;
}

// ---------------------------------------------------------------------
// Evolução de carga
// ---------------------------------------------------------------------

export const LOAD_WEEKS = 12;
export type LoadMetric = "max" | "e1rm";

export type LoadWeek = { weekStart: string; maxKg: number; e1rm: number; sets: number };
export type LoadExercise = { id: number; name: string; weeks: LoadWeek[] };

/** Segunda-feira da semana de um dia. */
export function weekStart(day: string): string {
  const weekday = dayToDate(day).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

/** As últimas `count` semanas (segundas-feiras), da mais antiga para esta. */
export function recentWeekStarts(today: string, count: number): string[] {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, index) => shiftDay(current, -7 * (count - 1 - index)));
}

/** Exercícios por frequência nas últimas semanas (semanas com treino, depois séries). */
export function rankLoadExercises(exercises: LoadExercise[], weeks: string[]): LoadExercise[] {
  const inWindow = (exercise: LoadExercise) => exercise.weeks.filter((week) => weeks.includes(week.weekStart));
  return [...exercises].sort((a, b) => {
    const wa = inWindow(a);
    const wb = inWindow(b);
    return (
      wb.length - wa.length ||
      wb.reduce((sum, week) => sum + week.sets, 0) - wa.reduce((sum, week) => sum + week.sets, 0) ||
      a.name.localeCompare(b.name, "pt-BR")
    );
  });
}

export type LoadBar = {
  weekStart: string;
  value: number | null;
  /** Altura em % (0 sem treino na semana) */
  height: number;
  tone: "current" | "max" | "normal";
  /** Valor escrito acima: só na primeira e na última com dado */
  label: string | null;
};

export type LoadSeries = {
  bars: LoadBar[];
  /** Último valor com dado (null se nenhuma semana tem treino) */
  latest: number | null;
  /** Último − primeiro com dado */
  delta: number | null;
};

/** Barras semanais: altura = (v − mín)/(máx − mín)·82 + 18 %, com mín = menor × 0,75. */
export function buildLoadSeries(exercise: LoadExercise | null, weeks: string[], metric: LoadMetric): LoadSeries {
  const byWeek = new Map((exercise?.weeks ?? []).map((week) => [week.weekStart, metric === "max" ? week.maxKg : week.e1rm]));
  const values = weeks.map((week) => byWeek.get(week) ?? null);
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return {
      bars: weeks.map((week, index) => ({
        weekStart: week,
        value: null,
        height: 0,
        tone: index === weeks.length - 1 ? "current" : "normal",
        label: null,
      })),
      latest: null,
      delta: null,
    };
  }

  const max = Math.max(...present);
  const min = Math.min(...present) * 0.75;
  const firstIndex = values.findIndex((value) => value !== null);
  const lastIndex = values.findLastIndex((value) => value !== null);

  return {
    bars: values.map((value, index) => ({
      weekStart: weeks[index],
      value,
      height: value === null ? 0 : max === min ? 100 : ((value - min) / (max - min)) * 82 + 18,
      tone: index === weeks.length - 1 ? "current" : value === max ? "max" : "normal",
      label: value !== null && (index === firstIndex || index === lastIndex) ? formatNumber(value, 1) : null,
    })),
    latest: values[lastIndex],
    delta: Math.round((values[lastIndex]! - values[firstIndex]!) * 10) / 10,
  };
}

// ---------------------------------------------------------------------
// Consistência (calendário) e resumo do mês
// ---------------------------------------------------------------------

export const CALENDAR_WEEKS = 18;

export type TrainingDay = {
  day: string;
  volumeKg: number;
  sessions: number;
  durationS: number;
  /** "A" ou "A+C"; null sem treino ou ficha excluída */
  plans: string | null;
  food: boolean;
};

export type CalendarCell = {
  day: string;
  /** −1 futuro; 0 sem treino; 1–4 volume relativo ao maior dia do período */
  level: -1 | 0 | 1 | 2 | 3 | 4;
  food: boolean;
  isToday: boolean;
  data: TrainingDay | null;
};

export type Calendar = {
  /** Coluna a coluna (semana), de segunda a domingo */
  cells: CalendarCell[];
  months: { label: string; column: number }[];
  trainedDays: number;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Nível de 1 a 4 pelo volume em relação ao maior dia (quartis). Treino sem carga conta como 1. */
export function volumeLevel(volumeKg: number, maxVolumeKg: number): 1 | 2 | 3 | 4 {
  if (maxVolumeKg <= 0 || volumeKg <= 0) return 1;
  const ratio = volumeKg / maxVolumeKg;
  return ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
}

export function buildCalendar(days: TrainingDay[], today: string, weeks: number = CALENDAR_WEEKS): Calendar {
  const start = shiftDay(weekStart(today), -7 * (weeks - 1));
  const byDay = new Map(days.map((day) => [day.day, day]));
  const maxVolume = Math.max(0, ...days.filter((day) => day.day >= start).map((day) => day.volumeKg));

  const cells = Array.from({ length: weeks * 7 }, (_, index): CalendarCell => {
    const day = shiftDay(start, index);
    const data = byDay.get(day) ?? null;
    const future = day > today;
    return {
      day,
      level: future ? -1 : data && data.sessions > 0 ? volumeLevel(data.volumeKg, maxVolume) : 0,
      food: !future && Boolean(data?.food),
      isToday: day === today,
      data,
    };
  });

  // O mês aparece na coluna da semana que contém o dia 1; a primeira coluna leva o mês corrente dela
  const months: Calendar["months"] = [];
  for (let column = 0; column < weeks; column++) {
    const monday = shiftDay(start, column * 7);
    const firstOfMonth = Array.from({ length: 7 }, (_, offset) => shiftDay(monday, offset)).find((day) => day.endsWith("-01"));
    if (firstOfMonth) months.push({ label: MONTHS[Number(firstOfMonth.slice(5, 7)) - 1], column });
  }
  if (!months.some((month) => month.column <= 2)) {
    months.unshift({ label: MONTHS[Number(start.slice(5, 7)) - 1], column: 0 });
  }

  return { cells, months, trainedDays: cells.filter((cell) => cell.level > 0).length };
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "26 out" a partir de YYYY-MM-DD. */
export function formatShortDay(day: string): string {
  const date = dayToDate(day);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export const monthLabel = (day: string) => MONTHS[Number(day.slice(5, 7)) - 1];

/** "Seg, 26 out · Treino A · 6,1 t", "… · só alimentação", "… · descanso", "… · hoje · treino pendente". */
export function calendarInfo(cell: CalendarCell): string {
  const date = dayToDate(cell.day);
  const prefix = `${WEEKDAY_SHORT[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  if (cell.level > 0 && cell.data) {
    const plans = cell.data.plans ? `Treino ${cell.data.plans}` : cell.data.sessions > 1 ? `${cell.data.sessions} treinos` : "Treino";
    return `${prefix} · ${plans} · ${formatVolume(cell.data.volumeKg)}`;
  }
  if (cell.isToday) return `${prefix} · hoje · treino pendente`;
  return `${prefix} · ${cell.food ? "só alimentação" : "descanso"}`;
}

export type MonthStats = { sessions: number; volumeKg: number; totalS: number; averageS: number | null };

/** Treinos, volume e tempo do mês do dia `today`. */
export function monthStats(days: TrainingDay[], today: string): MonthStats {
  const month = today.slice(0, 7);
  const inMonth = days.filter((day) => day.day.startsWith(month));
  const sessions = inMonth.reduce((sum, day) => sum + day.sessions, 0);
  const totalS = inMonth.reduce((sum, day) => sum + day.durationS, 0);
  return {
    sessions,
    volumeKg: inMonth.reduce((sum, day) => sum + day.volumeKg, 0),
    totalS,
    averageS: sessions > 0 ? Math.round(totalS / sessions) : null,
  };
}

/** Volume: "850 kg" ou, a partir de 1 tonelada, "6,1 t". */
export function formatVolume(kg: number): string {
  return kg >= 1000 ? `${formatNumber(kg / 1000, 1)} t` : `${formatNumber(kg)} kg`;
}

/** Duração: "52 min", "1 h 05 min". */
export function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
