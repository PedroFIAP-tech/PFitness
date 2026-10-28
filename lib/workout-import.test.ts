// Roda com AI_PROVIDER=mock (npm test): usa a resposta real gravada em
// lib/ai/fixtures, sem chamar a API.
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { AiError, getAiDailyLimit, parseWorkoutText } from "@/lib/ai";
import { matchImport, previewCodes } from "@/lib/workout-import";
import type { LibraryExercise } from "@/lib/workouts";

/** Biblioteca global do seed (docs/pfitness_schema.sql). */
const SEED: [string, string, string][] = [
  ["Supino reto com barra", "Peito", "Barra"],
  ["Supino inclinado c/ halteres", "Peito", "Halter"],
  ["Crucifixo na máquina", "Peito", "Máquina"],
  ["Crossover polia alta", "Peito", "Polia"],
  ["Tríceps na corda", "Tríceps", "Polia"],
  ["Tríceps francês", "Tríceps", "Halter"],
  ["Mergulho nas paralelas", "Tríceps", "Peso corporal"],
  ["Puxada frontal", "Costas", "Polia"],
  ["Remada curvada", "Costas", "Barra"],
  ["Remada baixa", "Costas", "Polia"],
  ["Pulldown braço reto", "Costas", "Polia"],
  ["Levantamento terra", "Costas", "Barra"],
  ["Rosca direta", "Bíceps", "Barra W"],
  ["Rosca martelo", "Bíceps", "Halter"],
  ["Agachamento livre", "Pernas", "Barra"],
  ["Leg press 45°", "Pernas", "Máquina"],
  ["Cadeira extensora", "Pernas", "Máquina"],
  ["Mesa flexora", "Pernas", "Máquina"],
  ["Stiff", "Pernas", "Barra"],
  ["Panturrilha em pé", "Pernas", "Máquina"],
  ["Desenvolvimento militar", "Ombros", "Barra"],
  ["Elevação lateral", "Ombros", "Halter"],
  ["Crucifixo invertido", "Ombros", "Máquina"],
  ["Encolhimento", "Ombros", "Halter"],
  ["Abdominal infra", "Abdômen", "Peso corporal"],
  ["Prancha isométrica", "Abdômen", "Peso corporal"],
];
const LIBRARY: LibraryExercise[] = SEED.map(([name, muscleGroup, equipment], index) => ({
  id: index + 1,
  name,
  muscleGroup,
  equipment,
  weightIncrement: 2.5,
}));
const HINTS = LIBRARY.map(({ name, equipment }) => ({ name, equipment }));

describe("importar treino (mock com a resposta real gravada)", async () => {
  const parsed = await parseWorkoutText("texto de exemplo", HINTS);
  const plans = matchImport(parsed, LIBRARY);
  const all = plans.flatMap((plan) => plan.exercises);
  const byOriginal = (pattern: RegExp) => all.find((item) => pattern.test(item.originalName));

  test("5 fichas, de segunda a sexta", () => {
    assert.equal(plans.length, 5);
    assert.deepEqual(
      plans.map((plan) => plan.weekday),
      [1, 2, 3, 4, 5],
    );
  });

  test("títulos limpos (sem dia nem símbolos soltos)", () => {
    assert.deepEqual(
      plans.map((plan) => plan.title),
      ["Costas", "Perna", "Peito", "Braço completo", "Perna posterior"],
    );
  });

  test("22 exercícios e o link ignorado", () => {
    assert.equal(all.length, 22);
    assert.ok(!all.some((item) => /http|tiktok/i.test(JSON.stringify(item))));
  });

  test("observações: cada perna e deitado no banco de frente", () => {
    assert.equal(byOriginal(/afundo/i)?.notes, "cada perna");
    assert.match(byOriginal(/spider/i)?.notes ?? "", /deitado no banco de frente/);
  });

  test("Stiff halter vira exercício novo com halteres", () => {
    const stiff = byOriginal(/stiff/i);
    assert.equal(stiff?.status, "new");
    assert.equal(stiff?.newExercise.name, "Stiff com halteres");
    assert.equal(stiff?.newExercise.equipment, "Halter");
  });

  test("encontra na biblioteca os que existem com o mesmo equipamento", () => {
    for (const pattern of [/^remada baixa/i, /^cadeira extensora/i, /^mesa flexora/i, /^elevação lateral/i]) {
      const item = byOriginal(pattern);
      assert.equal(item?.status, "found", pattern.source);
      assert.equal(item?.confirmed, true);
    }
  });

  test("séries e repetições do texto", () => {
    const pelvic = byOriginal(/pélvica/i);
    assert.equal(pelvic?.sets, 4);
    assert.equal(pelvic?.reps, 12);
    assert.equal(byOriginal(/pullover/i)?.sets, 2);
  });

  test("letras previstas: adicionar continua de onde parou, substituir recomeça", () => {
    assert.deepEqual(previewCodes(3, ["A", "B"], false), ["C", "D", "E"]);
    assert.deepEqual(previewCodes(3, ["A", "B"], true), ["A", "B", "C"]);
  });
});

describe("provedor mock", () => {
  test("simula resposta inválida e serviço fora", async () => {
    await assert.rejects(parseWorkoutText("[mock:invalid]", HINTS), (error) => error instanceof AiError && error.code === "invalid_response");
    await assert.rejects(parseWorkoutText("[mock:unavailable]", HINTS), (error) => error instanceof AiError && error.code === "unavailable");
  });

  test("texto sem treino não gera fichas", async () => {
    assert.equal(matchImport(await parseWorkoutText("[mock:empty]", HINTS), LIBRARY).length, 0);
  });
});

describe("AI_DAILY_LIMIT", () => {
  const original = process.env.AI_DAILY_LIMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.AI_DAILY_LIMIT;
    else process.env.AI_DAILY_LIMIT = original;
  });

  test("padrão 10", () => {
    delete process.env.AI_DAILY_LIMIT;
    assert.equal(getAiDailyLimit(), 10);
  });

  test("usa o valor do ambiente entre 1 e 100", () => {
    process.env.AI_DAILY_LIMIT = "25";
    assert.equal(getAiDailyLimit(), 25);
  });

  test("valor inválido volta ao padrão", () => {
    for (const value of ["0", "500", "abc", "2.5"]) {
      process.env.AI_DAILY_LIMIT = value;
      assert.equal(getAiDailyLimit(), 10, value);
    }
  });
});
