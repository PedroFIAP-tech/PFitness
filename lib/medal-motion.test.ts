import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  dragVelocity,
  MAX_SPEED,
  nearestFace,
  nearestFront,
  normalizeAngle,
  release,
  sheen,
  spinIn,
  step,
  toFront,
  type Spin,
} from "./medal-motion.ts";

/** Roda a simulação a 60fps até parar (ou estourar o limite). */
function run(spin: Spin, maxMs = 10_000) {
  let current = spin;
  let elapsed = 0;
  const angles = [current.angle];
  while (current.mode !== "idle" && elapsed < maxMs) {
    current = step(current, 16.7);
    elapsed += 16.7;
    angles.push(current.angle);
  }
  return { spin: current, elapsed, angles };
}

describe("faces", () => {
  test("face mais próxima e frente mais próxima", () => {
    assert.equal(nearestFace(80), 0);
    assert.equal(nearestFace(100), 180);
    assert.equal(nearestFace(-260), -180);
    assert.equal(nearestFront(170), 0);
    assert.equal(nearestFront(190), 360);
    assert.equal(nearestFront(-700), -720);
  });

  test("normaliza em (−180, 180]", () => {
    assert.equal(normalizeAngle(0), 0);
    assert.equal(normalizeAngle(180), 180);
    assert.equal(normalizeAngle(-180), 180);
    assert.equal(normalizeAngle(370), 10);
    assert.equal(normalizeAngle(-370), -10);
  });
});

describe("dragVelocity", () => {
  test("usa só as amostras recentes", () => {
    const samples = [
      { t: 0, angle: 0 },
      { t: 900, angle: 0 },
      { t: 950, angle: 25 },
      { t: 1000, angle: 50 },
    ];
    assert.equal(dragVelocity(samples, 1000), 0.5);
  });

  test("parado ou com uma amostra: zero", () => {
    assert.equal(dragVelocity([{ t: 0, angle: 10 }], 10), 0);
    assert.equal(dragVelocity([{ t: 0, angle: 0 }, { t: 10, angle: 5 }], 500), 0);
  });

  test("limita arremessos absurdos", () => {
    assert.equal(dragVelocity([{ t: 0, angle: 0 }, { t: 1, angle: 900 }], 1), MAX_SPEED);
  });
});

describe("release e step", () => {
  test("arremesso gira solto, desacelera e para numa face", () => {
    const start = release(30, 1.5, false);
    assert.equal(start.mode, "coast");
    const { spin, angles } = run(start);
    assert.equal(spin.mode, "idle");
    assert.equal(spin.angle % 180, 0);
    assert.ok(spin.angle > 180, "andou bem mais que meia volta");
    // Sem voltar para trás enquanto está solta (a mola pode balançar só no fim)
    const coastEnd = angles.findIndex((angle, index) => index > 0 && angle < angles[index - 1]);
    assert.ok(coastEnd === -1 || angles[coastEnd] > 0.9 * spin.angle);
  });

  test("pela inércia, a face escolhida é a da direção do giro", () => {
    // Em 80° e girando para a frente, para no verso (180), não volta para 0
    const { spin } = run(release(80, 0.1, false));
    assert.equal(spin.angle, 180);
  });

  test("solto devagar perto da frente: volta para a frente", () => {
    const { spin, elapsed } = run(release(40, 0, false));
    assert.equal(spin.angle, 0);
    assert.ok(elapsed < 1500, `assentou em ${elapsed}ms`);
  });

  test("movimento reduzido: ignora a inércia", () => {
    const start = release(60, 2, true);
    assert.deepEqual([start.mode, start.velocity, start.target], ["settle", 0, 0]);
    assert.equal(run(start).spin.angle, 0);
  });

  test("toque duplo volta para a frente mais próxima", () => {
    assert.equal(run(toFront(200)).spin.angle, 360);
    assert.equal(run(toFront(-150)).spin.angle, 0);
  });

  test("parada não muda", () => {
    const idle: Spin = { angle: 180, velocity: 0, mode: "idle", target: 180 };
    assert.equal(step(idle, 16), idle);
  });

  test("o passo não depende do frame rate", () => {
    let a = release(0, 2, false);
    let b = a;
    for (let i = 0; i < 30; i++) a = step(a, 33.4);
    for (let i = 0; i < 60; i++) b = step(b, 16.7);
    assert.ok(Math.abs(a.angle - b.angle) < 2, `${a.angle} vs ${b.angle}`);
  });
});

describe("spinIn", () => {
  test("começa invisível e girando, termina de frente e no tamanho certo", () => {
    const start = spinIn(0);
    assert.equal(start.angle, -1080);
    assert.ok(start.scale < 0.05);
    assert.deepEqual(spinIn(1), { angle: 0, scale: 1 });
  });

  test("desacelera: cada trecho gira menos que o anterior", () => {
    const deltas = [0, 0.25, 0.5, 0.75, 1].map((t) => spinIn(t).angle);
    for (let i = 2; i < deltas.length; i++) {
      assert.ok(deltas[i] - deltas[i - 1] < deltas[i - 1] - deltas[i - 2]);
    }
  });
});

describe("sheen", () => {
  test("de frente e parada: sem reflexo nem borda alternativa", () => {
    for (const angle of [0, 360, -720]) {
      const at = sheen(angle);
      assert.equal(at.bandOpacity, 0);
      assert.equal(at.ringOpacity, 0);
    }
  });

  test("a faixa cruza a face perto da luz e some depois", () => {
    assert.equal(sheen(12).bandOpacity, 1);
    assert.equal(sheen(12).band, 0);
    assert.ok(sheen(4).band < 0 && sheen(20).band > 0);
    assert.equal(sheen(40).bandOpacity, 0);
  });

  test("de costas, a face não brilha", () => {
    assert.deepEqual(
      [sheen(180).bandOpacity, sheen(180).ringOpacity, sheen(120).ringOpacity],
      [0, 0, 0],
    );
  });
});
