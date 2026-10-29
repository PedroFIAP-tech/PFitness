/**
 * Giro da medalha 3D das conquistas: inércia, mola até a face mais próxima,
 * entrada do desbloqueio e reflexo pelo ângulo. Ângulos em graus (sem limite:
 * 0, 360, 720… = frente; 180, 540… = verso), tempo em ms.
 */

/** Graus de giro por pixel arrastado. */
export const DEG_PER_PX = 0.5;
/** Atrito do giro solto (1/ms): v(t) = v0·e^(−k·t), e a peça anda v0/k até parar. */
export const FRICTION = 0.0028;
/** Abaixo desta velocidade (°/ms) a mola assume e leva até a face mais próxima. */
export const SETTLE_SPEED = 0.12;
/** Velocidade máxima de um arremesso (°/ms). */
export const MAX_SPEED = 2.6;
/** Janela das últimas amostras do arraste usadas para medir a velocidade (ms). */
export const VELOCITY_WINDOW_MS = 90;

/** Entrada do desbloqueio: voltas, duração e espera (o sheet ainda está subindo). */
export const SPIN_IN_TURNS = 3;
export const SPIN_IN_MS = 1700;
export const SPIN_IN_DELAY_MS = 250;

/** Mola levemente subamortecida (≈ 0,45 s até assentar). */
const STIFFNESS = 0.00008;
const DAMPING = 0.0152;
const SPRING_STEP_MS = 4;

/** Ângulo da luz (°): o reflexo cruza a face quando ela está virada para cá. */
const LIGHT_DEG = 12;
/** A faixa sai da face a ±LIGHT_DEG da luz: com a peça de frente, nada aparece. */
const BAND_HALF_SPAN_DEG = LIGHT_DEG;
/** Deslocamento da faixa (em % da própria largura) para ficar fora da face. */
const BAND_OFFSCREEN = 150;

export type Spin = {
  angle: number;
  velocity: number;
  /** coast: girando solta; settle: mola até `target`; idle: parada */
  mode: "idle" | "coast" | "settle";
  target: number;
};

// `+ 0` troca −0 por 0
export const nearestFace = (angle: number) => Math.round(angle / 180) * 180 + 0;
export const nearestFront = (angle: number) => Math.round(angle / 360) * 360 + 0;

/** Ângulo em (−180, 180]. */
export function normalizeAngle(angle: number) {
  const wrapped = ((angle % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Velocidade (°/ms) pelas amostras do arraste dentro da janela que termina em `now`. */
export function dragVelocity(samples: { t: number; angle: number }[], now: number) {
  const recent = samples.filter((sample) => now - sample.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (last.t - first.t <= 0) return 0;
  return clamp((last.angle - first.angle) / (last.t - first.t), -MAX_SPEED, MAX_SPEED);
}

/** Mola até a face onde a peça pararia pela inércia que ainda tem. */
function settleFrom(angle: number, velocity: number): Spin {
  return { angle, velocity, mode: "settle", target: nearestFace(angle + velocity / FRICTION) };
}

/** Soltou o dedo. Com movimento reduzido não há inércia: vai direto para a face mais próxima. */
export function release(angle: number, velocity: number, reducedMotion: boolean): Spin {
  if (reducedMotion) return { angle, velocity: 0, mode: "settle", target: nearestFace(angle) };
  const speed = clamp(velocity, -MAX_SPEED, MAX_SPEED);
  if (Math.abs(speed) < SETTLE_SPEED) return settleFrom(angle, speed);
  return { angle, velocity: speed, mode: "coast", target: angle };
}

/** Toque duplo: volta para a frente pelo caminho mais curto. */
export function toFront(angle: number): Spin {
  return { angle, velocity: 0, mode: "settle", target: nearestFront(angle) };
}

/** Avança `dt` ms. */
export function step(spin: Spin, dt: number): Spin {
  if (spin.mode === "idle" || dt <= 0) return spin;

  if (spin.mode === "coast") {
    const decay = Math.exp(-FRICTION * dt);
    const angle = spin.angle + (spin.velocity * (1 - decay)) / FRICTION;
    const velocity = spin.velocity * decay;
    return Math.abs(velocity) < SETTLE_SPEED ? settleFrom(angle, velocity) : { ...spin, angle, velocity };
  }

  let { angle, velocity } = spin;
  for (let left = dt; left > 0; left -= SPRING_STEP_MS) {
    const h = Math.min(SPRING_STEP_MS, left);
    velocity += (-STIFFNESS * (angle - spin.target) - DAMPING * velocity) * h;
    angle += velocity * h;
  }
  if (Math.abs(angle - spin.target) < 0.05 && Math.abs(velocity) < 0.002) {
    return { angle: spin.target, velocity: 0, mode: "idle", target: spin.target };
  }
  return { ...spin, angle, velocity };
}

/** Entrada do desbloqueio em t ∈ [0, 1]: gira rápido e desacelera até parar de frente. */
export function spinIn(t: number) {
  const p = clamp(t, 0, 1);
  const grow = 1 - (1 - clamp(p / 0.3, 0, 1)) ** 3;
  return { angle: -SPIN_IN_TURNS * 360 * (1 - p) ** 4 + 0, scale: 0.01 + 0.99 * grow };
}

/**
 * Reflexo de uma face virada `faceAngle` graus para o lado (0 = de frente,
 * já somada a inclinação do celular). Com a peça de frente e parada, tudo é 0:
 * o selo fica idêntico ao plano.
 * - band: deslocamento da faixa especular (% da largura dela), opacidade bandOpacity
 * - ringOpacity: borda em gradiente alternativo (metal mudando com o ângulo)
 */
export function sheen(faceAngle: number) {
  const angle = normalizeAngle(faceAngle);
  const fromLight = angle - LIGHT_DEG;
  const visible = Math.abs(angle) < 90;
  return {
    band: clamp((fromLight / BAND_HALF_SPAN_DEG) * BAND_OFFSCREEN, -BAND_OFFSCREEN, BAND_OFFSCREEN),
    bandOpacity: visible ? clamp(1 - Math.abs(fromLight) / BAND_HALF_SPAN_DEG, 0, 1) : 0,
    ringOpacity: visible ? clamp(Math.abs(Math.sin((angle * Math.PI) / 180)) * 1.6, 0, 1) : 0,
  };
}
