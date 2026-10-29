import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildCalendar,
  buildLoadSeries,
  buildWeightChart,
  calendarInfo,
  formatMinutes,
  formatVolume,
  monthStats,
  nearestPointIndex,
  rankLoadExercises,
  recentWeekStarts,
  volumeLevel,
  weekStart,
  WEIGHT_CHART,
  type LoadExercise,
  type TrainingDay,
} from "@/lib/progress-model";

const TODAY = "2026-10-29"; // quinta-feira

describe("buildWeightChart", () => {
  const weights = [
    { day: "2026-10-01", kg: 80 },
    { day: "2026-10-08", kg: 80.4 },
    { day: "2026-10-15", kg: 80.6 },
    { day: "2026-10-29", kg: 81 },
    { day: "2026-07-01", kg: 77 },
  ];

  test("só o período escolhido, eixo X pelas datas até hoje", () => {
    const chart = buildWeightChart(weights, "1M", TODAY)!;
    assert.equal(chart.points.length, 4);
    assert.equal(chart.points[0].x, 0);
    assert.equal(chart.points.at(-1)!.x, WEIGHT_CHART.width);
    // 7 de 28 dias → 1/4 da largura
    assert.ok(Math.abs(chart.points[1].x - WEIGHT_CHART.width / 4) < 1e-9);
    assert.equal(chart.delta, 1);
    assert.equal(chart.xStart, "2026-10-01");
    assert.equal(chart.xMid, "2026-10-15");
  });

  test("Y com folga de 0,3 kg: o maior fica em 8% e o menor em 92% da altura (sem tendência fora)", () => {
    const chart = buildWeightChart(weights.slice(0, 2), "1M", TODAY)!;
    assert.ok(Math.abs(chart.points[0].y - WEIGHT_CHART.height * (0.08 + (1 - 0.3 / 1) * 0.84)) < 1e-9);
    assert.equal(chart.trend, null);
    assert.equal(chart.ticks.mid, 80.2);
  });

  test("tendência pela mesma regressão da meta adaptativa", () => {
    const chart = buildWeightChart(weights, "1M", TODAY)!;
    assert.ok(chart.trend);
    assert.ok(chart.trend.kgPerWeek > 0.2 && chart.trend.kgPerWeek < 0.3, String(chart.trend.kgPerWeek));
    assert.equal(chart.trend.x1, 0);
  });

  test("1A inclui pesagens antigas; sem pesagens no período, null", () => {
    assert.equal(buildWeightChart(weights, "1A", TODAY)!.points.length, 5);
    assert.equal(buildWeightChart([{ day: "2026-01-01", kg: 80 }], "1M", TODAY), null);
  });

  test("uma pesagem só fica na ponta direita", () => {
    const chart = buildWeightChart([{ day: TODAY, kg: 80 }], "1M", TODAY)!;
    assert.equal(chart.points[0].x, WEIGHT_CHART.width);
  });

  test("ponto mais perto do dedo", () => {
    const chart = buildWeightChart(weights, "1M", TODAY)!;
    assert.equal(nearestPointIndex(chart.points, 0.3), 1);
    assert.equal(nearestPointIndex(chart.points, 1), 3);
  });
});

describe("semanas", () => {
  test("semana começa na segunda", () => {
    assert.equal(weekStart("2026-10-29"), "2026-10-26");
    assert.equal(weekStart("2026-10-26"), "2026-10-26");
    assert.equal(weekStart("2026-11-01"), "2026-10-26");
  });
  test("12 semanas terminando nesta", () => {
    const weeks = recentWeekStarts(TODAY, 12);
    assert.equal(weeks.length, 12);
    assert.equal(weeks.at(-1), "2026-10-26");
    assert.equal(weeks[0], "2026-08-10");
  });
});

describe("buildLoadSeries", () => {
  const weeks = recentWeekStarts(TODAY, 4);
  const squat: LoadExercise = {
    id: 1,
    name: "Agachamento livre",
    weeks: [
      { weekStart: weeks[0], maxKg: 80, e1rm: 93.3, sets: 3 },
      { weekStart: weeks[2], maxKg: 90, e1rm: 105, sets: 3 },
      { weekStart: weeks[3], maxKg: 85, e1rm: 99.2, sets: 3 },
    ],
  };

  test("alturas com piso de 18% e semana sem treino vazia", () => {
    const series = buildLoadSeries(squat, weeks, "max");
    // mín = 80 × 0,75 = 60; 80 → 20/30·82 + 18
    assert.ok(Math.abs(series.bars[0].height - ((80 - 60) / 30) * 82 - 18) < 1e-9);
    assert.equal(series.bars[1].value, null);
    assert.equal(series.bars[1].height, 0);
    assert.equal(series.bars[2].height, 100);
    assert.equal(series.bars[2].tone, "max");
    assert.equal(series.bars[3].tone, "current");
  });

  test("rótulo só na primeira e na última com dado; variação e último", () => {
    const series = buildLoadSeries(squat, weeks, "max");
    assert.deepEqual(
      series.bars.map((bar) => bar.label),
      ["80", null, null, "85"],
    );
    assert.equal(series.latest, 85);
    assert.equal(series.delta, 5);
  });

  test("1RM estimado usa a outra coluna", () => {
    assert.equal(buildLoadSeries(squat, weeks, "e1rm").latest, 99.2);
  });

  test("sem histórico: barras vazias", () => {
    const series = buildLoadSeries(null, weeks, "max");
    assert.equal(series.latest, null);
    assert.ok(series.bars.every((bar) => bar.height === 0));
  });

  test("mais frequentes primeiro", () => {
    const bench: LoadExercise = { id: 2, name: "Supino", weeks: [{ weekStart: weeks[3], maxKg: 60, e1rm: 70, sets: 4 }] };
    assert.deepEqual(
      rankLoadExercises([bench, squat], weeks).map((exercise) => exercise.id),
      [1, 2],
    );
  });
});

describe("calendário", () => {
  const days: TrainingDay[] = [
    { day: "2026-10-26", volumeKg: 6100, sessions: 1, durationS: 3000, plans: "A", food: true },
    { day: "2026-10-27", volumeKg: 1000, sessions: 1, durationS: 2400, plans: "B", food: false },
    { day: "2026-10-28", volumeKg: 0, sessions: 0, durationS: 0, plans: null, food: true },
    { day: "2026-09-30", volumeKg: 4000, sessions: 1, durationS: 3600, plans: "C", food: false },
  ];
  const calendar = buildCalendar(days, TODAY);
  const cell = (day: string) => calendar.cells.find((item) => item.day === day)!;

  test("18 semanas de segunda a domingo, terminando na semana atual", () => {
    assert.equal(calendar.cells.length, 126);
    assert.equal(calendar.cells[0].day, "2026-06-29");
    assert.equal(calendar.cells.at(-1)!.day, "2026-11-01");
  });

  test("níveis relativos ao maior dia, futuro −1, hoje marcado", () => {
    assert.equal(cell("2026-10-26").level, 4);
    assert.equal(cell("2026-10-27").level, 1);
    assert.equal(cell("2026-09-30").level, 3);
    assert.equal(cell("2026-10-28").level, 0);
    assert.equal(cell("2026-10-28").food, true);
    assert.equal(cell("2026-10-30").level, -1);
    assert.equal(cell(TODAY).isToday, true);
    assert.equal(calendar.trainedDays, 3);
  });

  test("meses na coluna da semana com o dia 1", () => {
    assert.deepEqual(calendar.months.slice(0, 2), [
      { label: "jul", column: 0 },
      { label: "ago", column: 4 },
    ]);
    assert.ok(calendar.months.some((month) => month.label === "nov" && month.column === 17));
  });

  test("texto do dia tocado", () => {
    assert.equal(calendarInfo(cell("2026-10-26")), "Seg, 26 out · Treino A · 6,1 t");
    assert.equal(calendarInfo(cell("2026-10-28")), "Qua, 28 out · só alimentação");
    assert.equal(calendarInfo(cell(TODAY)), "Qui, 29 out · hoje · treino pendente");
    assert.equal(calendarInfo(cell("2026-10-22")), "Qui, 22 out · descanso");
  });

  test("níveis por quartil", () => {
    assert.deepEqual(
      [100, 251, 501, 751].map((volume) => volumeLevel(volume, 1000)),
      [1, 2, 3, 4],
    );
    assert.equal(volumeLevel(0, 1000), 1);
  });

  test("resumo do mês", () => {
    assert.deepEqual(monthStats(days, TODAY), { sessions: 2, volumeKg: 7100, totalS: 5400, averageS: 2700 });
    assert.deepEqual(monthStats([], TODAY), { sessions: 0, volumeKg: 0, totalS: 0, averageS: null });
  });

  test("formatos", () => {
    assert.equal(formatVolume(850), "850 kg");
    assert.equal(formatVolume(6120), "6,1 t");
    assert.equal(formatMinutes(3120), "52 min");
    assert.equal(formatMinutes(3900), "1 h 05 min");
  });
});
