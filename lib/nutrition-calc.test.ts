import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  activityFactor,
  ageOn,
  bmr,
  calculateGoals,
  dropWeightOutliers,
  rebalanceCarbs,
  suggestGoalAdjustment,
  weightTrendKgPerWeek,
  type WeightPoint,
} from "./nutrition-calc.ts";

/** Pesagens a partir de um dia, uma a cada `everyDays`. */
function series(start: string, kgs: number[], everyDays = 5): WeightPoint[] {
  return kgs.map((kg, index) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index * everyDays);
    return { day: date.toISOString().slice(0, 10), kg };
  });
}

describe("ageOn", () => {
  test("conta o aniversário só a partir do dia", () => {
    assert.equal(ageOn("1996-10-29", "2026-10-28"), 29);
    assert.equal(ageOn("1996-10-29", "2026-10-29"), 30);
  });
});

describe("bmr (Mifflin-St Jeor)", () => {
  test("homem 80 kg, 180 cm, 30 anos", () => {
    assert.equal(bmr({ sex: "masculino", weightKg: 80, heightCm: 180, age: 30 }), 1780);
  });
  test("mulher 60 kg, 165 cm, 25 anos", () => {
    assert.equal(bmr({ sex: "feminino", weightKg: 60, heightCm: 165, age: 25 }), 1345.25);
  });
  test("outro usa a média das constantes", () => {
    assert.equal(bmr({ sex: "outro", weightKg: 80, heightCm: 180, age: 30 }), 1697);
  });
});

describe("activityFactor", () => {
  test("tabela documentada", () => {
    assert.equal(activityFactor("sedentaria", 3), 1.35);
    assert.equal(activityFactor("sedentaria", 5), 1.45);
    assert.equal(activityFactor("moderada", 3), 1.5);
    assert.equal(activityFactor("moderada", 5), 1.6);
    assert.equal(activityFactor("ativa", 3), 1.65);
    assert.equal(activityFactor("ativa", 5), 1.75);
  });
  test("treinos fora de 0–7 são limitados e o teto é 1,9", () => {
    assert.equal(activityFactor("ativa", 12), 1.85);
    assert.equal(activityFactor("sedentaria", -2), 1.2);
  });
});

describe("calculateGoals", () => {
  test("ganhar massa: +300, kcal múltipla de 50, carbo com o restante", () => {
    const goals = calculateGoals({
      sex: "masculino",
      weightKg: 80,
      heightCm: 180,
      age: 30,
      goal: "ganhar_massa",
      activityLevel: "moderada",
      workoutsPerWeek: 3,
    });
    // 1780 × 1,50 = 2670; +300 = 2970 → 2950
    assert.equal(goals.tdee, 2670);
    assert.equal(goals.kcal, 2950);
    assert.equal(goals.protein, 160);
    assert.equal(goals.fat, 72);
    assert.equal(goals.carbs, 416);
    assert.equal(goals.kcal % 50, 0);
    assert.equal(goals.explanation.length, 4);
    assert.match(goals.explanation[2], /\+300 kcal para ganhar massa → 2\.950 kcal/);
  });

  test("perder gordura: 2,2 g/kg de proteína, piso de kcal e de carbo", () => {
    const goals = calculateGoals({
      sex: "feminino",
      weightKg: 60,
      heightCm: 165,
      age: 25,
      goal: "perder_gordura",
      activityLevel: "sedentaria",
      workoutsPerWeek: 0,
    });
    // 1345 × 1,2 = 1614; −400 = 1214 → 1200 (piso)
    assert.equal(goals.kcal, 1200);
    assert.equal(goals.protein, 132);
    assert.equal(goals.fat, 54);
    assert.equal(goals.carbs, 50);
  });

  test("manter: sem ajuste", () => {
    const goals = calculateGoals({
      sex: "masculino",
      weightKg: 80,
      heightCm: 180,
      age: 30,
      goal: "manter",
      activityLevel: "moderada",
      workoutsPerWeek: 3,
    });
    assert.equal(goals.adjustment, 0);
    assert.equal(goals.kcal, 2650);
  });
});

describe("rebalanceCarbs", () => {
  test("o carbo absorve a mudança de kcal", () => {
    assert.equal(rebalanceCarbs({ kcal: 3100, protein: 160, fat: 72 }), 453);
  });
});

describe("dropWeightOutliers", () => {
  test("remove um valor digitado errado no meio", () => {
    const kept = dropWeightOutliers(series("2026-10-01", [80, 80.2, 85, 80.4, 80.5]));
    assert.deepEqual(
      kept.map((point) => point.kg),
      [80, 80.2, 80.4, 80.5],
    );
  });
  test("remove um valor errado na ponta", () => {
    const kept = dropWeightOutliers(series("2026-10-01", [70, 80, 80.1]));
    assert.deepEqual(
      kept.map((point) => point.kg),
      [80, 80.1],
    );
  });
});

describe("weightTrendKgPerWeek", () => {
  test("ganho linear de 0,1 kg a cada 5 dias = 0,14 kg/sem", () => {
    const trend = weightTrendKgPerWeek(series("2026-10-01", [80, 80.1, 80.2, 80.3]));
    assert.ok(Math.abs(trend - 0.14) < 1e-9, String(trend));
  });
});

describe("suggestGoalAdjustment", () => {
  const today = "2026-10-21";

  test("sem dados suficientes: menos de 4 pesagens", () => {
    const weights = series("2026-10-02", [80, 80, 80], 7);
    assert.equal(suggestGoalAdjustment({ weights, goal: "ganhar_massa", currentKcal: 2950, today }), null);
  });

  test("sem dados suficientes: menos de 14 dias entre a primeira e a última", () => {
    const weights = series("2026-10-10", [80, 80, 80, 80], 3);
    assert.equal(suggestGoalAdjustment({ weights, goal: "ganhar_massa", currentKcal: 2950, today }), null);
  });

  test("ignora pesagens fora das últimas 3 semanas", () => {
    // Só 3 pesagens caem na janela
    const weights = series("2026-09-20", [79, 79.5, 80, 80.1, 80.2], 7);
    assert.equal(suggestGoalAdjustment({ weights, goal: "ganhar_massa", currentKcal: 2950, today }), null);
  });

  test("ganhar massa com peso parado: sugere +200", () => {
    const weights = series("2026-10-01", [80, 80, 80, 80, 80]);
    const suggestion = suggestGoalAdjustment({ weights, goal: "ganhar_massa", currentKcal: 2950, today });
    assert.deepEqual(suggestion, { adjustKcal: 200, newKcal: 3150, actualKgPerWeek: 0, expectedKgPerWeek: 0.25 });
  });

  test("dentro da tolerância: sem sugestão", () => {
    // 0,14 kg/sem contra 0,25 esperado: diferença 0,11 < 0,15
    const weights = series("2026-10-01", [80, 80.1, 80.2, 80.3, 80.4]);
    assert.equal(suggestGoalAdjustment({ weights, goal: "ganhar_massa", currentKcal: 2950, today }), null);
  });

  test("perdendo rápido demais: sugere comer mais", () => {
    const weights = series("2026-10-01", [80, 79.3, 78.6, 77.9, 77.2]);
    const suggestion = suggestGoalAdjustment({ weights, goal: "perder_gordura", currentKcal: 2000, today });
    assert.equal(suggestion?.adjustKcal, 200);
    assert.equal(suggestion?.expectedKgPerWeek, -0.39);
  });

  test("manter e ganhando: sugere comer menos (múltiplo de 50, entre 100 e 200)", () => {
    const weights = series("2026-10-01", [80, 80.2, 80.4, 80.6, 80.8]);
    const suggestion = suggestGoalAdjustment({ weights, goal: "manter", currentKcal: 2650, today });
    assert.ok(suggestion);
    assert.ok(suggestion.adjustKcal < 0 && Math.abs(suggestion.adjustKcal) <= 200 && Math.abs(suggestion.adjustKcal) >= 100);
    assert.equal(Math.abs(suggestion.adjustKcal) % 50, 0);
  });

  test("pesagem errada não gera sugestão falsa", () => {
    // Peso estável em manter, com um 89 digitado no meio
    const weights = series("2026-10-01", [80, 80.1, 89, 80, 80.1]);
    assert.equal(suggestGoalAdjustment({ weights, goal: "manter", currentKcal: 2650, today }), null);
  });
});
