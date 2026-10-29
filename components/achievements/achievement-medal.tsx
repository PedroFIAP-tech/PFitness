"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import type { Achievement } from "@/lib/achievements";
import {
  DEG_PER_PX,
  dragVelocity,
  release,
  sheen,
  SPIN_IN_DELAY_MS,
  SPIN_IN_MS,
  spinIn,
  step,
  toFront,
  type Spin,
} from "@/lib/medal-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { AchievementHexagon, HEXAGON } from "./achievement-hexagon";

/** Espessura da peça (px) e camadas empilhadas que formam a borda lateral. */
const THICKNESS = 12;
const EDGE_LAYERS = 11;
/** Inclinação máxima pelo giroscópio (°) e quanto cada grau do celular inclina a peça. */
const MAX_TILT = 8;
const TILT_GAIN = 0.4;
const DOUBLE_TAP_MS = 300;
/** Até aqui (px) um toque não conta como arraste. */
const TAP_SLOP_PX = 6;

/** Ponto do hexágono recuado `inset` px (o miolo do selo fica a 3px da borda). */
const insetPoint = (x: number, y: number, inset: number) =>
  `calc(${inset}px + (100% - ${2 * inset}px) * ${x}) calc(${inset}px + (100% - ${2 * inset}px) * ${y})`;
const HEX_POINTS: [number, number][] = [
  [0.5, 0],
  [1, 0.25],
  [1, 0.75],
  [0.5, 1],
  [0, 0.75],
  [0, 0.25],
  [0.5, 0],
];
/** Só o anel da borda (contorno externo + miolo vazado): recebe o gradiente que muda com o giro. */
const RING = `polygon(evenodd, ${[
  ...HEX_POINTS.map(([x, y]) => insetPoint(x, y, 0)),
  ...HEX_POINTS.map(([x, y]) => insetPoint(x, y, 3)),
].join(", ")})`;

const pieceTransform = (angle: number, tiltX: number, tiltY: number, scale: number) =>
  // Recuada meia espessura: de frente, a face fica no plano da tela, no mesmo tamanho do selo
  `translateZ(${-THICKNESS / 2}px) rotateX(${tiltX}deg) rotateY(${angle + tiltY}deg) scale(${scale})`;

type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** iOS só entrega o giroscópio depois de um toque pedindo permissão; vale até recarregar a página. */
let tiltGranted = false;

const needsTiltPermission = () =>
  typeof DeviceOrientationEvent !== "undefined" &&
  typeof (DeviceOrientationEvent as DeviceOrientationWithPermission).requestPermission === "function";

type DivRef = RefObject<HTMLDivElement | null>;

/**
 * Medalha 3D da conquista (sheet de detalhe): o selo vira uma peça metálica que
 * gira no eixo Y. Arrastar gira com inércia e para na face mais próxima; toque
 * duplo volta para a frente. `celebrate`: entra girando e para de frente com um
 * flash (desbloqueio). Tudo por transform/opacity num loop de rAF, sem render.
 */
export function AchievementMedal({ achievement, celebrate = false }: { achievement: Achievement; celebrate?: boolean }) {
  const on = achievement.unlockedAt !== null;
  const reduced = useReducedMotion();
  const spinsIn = celebrate && on && !reduced;
  const [tilt, setTilt] = useState<"on" | "ask" | "off">(() =>
    needsTiltPermission() && !tiltGranted ? "ask" : "on",
  );
  const tiltActive = tilt === "on" && !reduced;

  const stageRef = useRef<HTMLDivElement>(null);
  const pieceRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ringOutRef = useRef<HTMLDivElement>(null);
  const frontBandRef = useRef<HTMLDivElement>(null);
  const frontRingRef = useRef<HTMLDivElement>(null);
  const backBandRef = useRef<HTMLDivElement>(null);
  const backRingRef = useRef<HTMLDivElement>(null);
  const kickRef = useRef(() => {});
  const [initial] = useState(() => {
    const start = spinsIn ? spinIn(0) : { angle: 0, scale: 1 };
    return { ...start, transform: pieceTransform(start.angle, 0, 0, start.scale) };
  });
  const motion = useRef({
    spin: { angle: initial.angle, velocity: 0, mode: "idle", target: 0 } as Spin,
    scale: initial.scale,
    /** Início da entrada (performance.now); null fora dela */
    entranceAt: null as number | null,
    celebrated: false,
    drag: null as null | { id: number; x: number; angle: number; moved: boolean; samples: { t: number; angle: number }[] },
    lastTap: -Infinity,
    tilt: { x: 0, y: 0, targetX: 0, targetY: 0, baseBeta: null as number | null },
    raf: 0,
    last: 0,
  });

  useEffect(() => {
    const stage = stageRef.current;
    const piece = pieceRef.current;
    if (!stage || !piece) return;
    const m = motion.current;

    const paintSheen = (bandRef: DivRef, ringRef: DivRef, faceAngle: number) => {
      const band = bandRef.current;
      const ring = ringRef.current;
      if (!band || !ring) return;
      const at = sheen(faceAngle);
      band.style.transform = `translateX(${at.band}%) skewX(-20deg)`;
      band.style.opacity = String(at.bandOpacity);
      ring.style.opacity = String(at.ringOpacity);
    };

    const paint = () => {
      const { angle } = m.spin;
      piece.style.transform = pieceTransform(angle, m.tilt.x, m.tilt.y, m.scale);
      if (on) {
        paintSheen(frontBandRef, frontRingRef, angle + m.tilt.y);
        paintSheen(backBandRef, backRingRef, angle + m.tilt.y - 180);
      }
    };

    const flash = () => {
      flashRef.current?.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0 }]
          : [
              { opacity: 0, transform: "scale(0.4)" },
              { opacity: 1, transform: "scale(1)", offset: 0.2 },
              { opacity: 0, transform: "scale(1.5)" },
            ],
        { duration: reduced ? 900 : 750, easing: "ease-out" },
      );
      if (!reduced) {
        ringOutRef.current?.animate(
          [
            { opacity: 0.9, transform: "scale(0.6)" },
            { opacity: 0, transform: "scale(1.6)" },
          ],
          { duration: 1000, easing: "ease-out" },
        );
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(Math.max(now - m.last, 0), 50);
      m.last = now;
      let busy = false;

      if (m.entranceAt !== null) {
        const t = (now - m.entranceAt) / SPIN_IN_MS;
        const at = spinIn(t);
        m.spin = { angle: at.angle, velocity: 0, mode: "idle", target: 0 };
        m.scale = at.scale;
        if (t >= 1) {
          m.entranceAt = null;
          flash();
        } else {
          busy = true;
        }
      } else if (!m.drag) {
        m.spin = step(m.spin, dt);
        busy = m.spin.mode !== "idle";
      }

      // Inclinação suavizada (segue o giroscópio sem tremer)
      const t = m.tilt;
      const follow = 1 - Math.exp(-dt / 120);
      t.x += (t.targetX - t.x) * follow;
      t.y += (t.targetY - t.y) * follow;
      if (Math.abs(t.targetX - t.x) > 0.01 || Math.abs(t.targetY - t.y) > 0.01) busy = true;
      else [t.x, t.y] = [t.targetX, t.targetY];

      paint();
      m.raf = busy ? requestAnimationFrame(frame) : 0;
    };

    const kick = () => {
      if (m.raf) return;
      m.last = performance.now();
      m.raf = requestAnimationFrame(frame);
    };
    kickRef.current = kick;

    const onDown = (event: PointerEvent) => {
      if (m.drag || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (m.entranceAt !== null) {
        // Ainda crescendo: deixa a entrada terminar
        if (m.scale < 1) return;
        m.entranceAt = null;
      }
      stage.setPointerCapture(event.pointerId);
      m.drag = {
        id: event.pointerId,
        x: event.clientX,
        angle: m.spin.angle,
        moved: false,
        samples: [{ t: event.timeStamp, angle: m.spin.angle }],
      };
      // Segurar a peça girando faz ela parar na mão
      m.spin = { angle: m.spin.angle, velocity: 0, mode: "idle", target: m.spin.angle };
    };

    const onMove = (event: PointerEvent) => {
      const drag = m.drag;
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < TAP_SLOP_PX) return;
      drag.moved = true;
      const angle = drag.angle + dx * DEG_PER_PX;
      m.spin = { angle, velocity: 0, mode: "idle", target: angle };
      drag.samples.push({ t: event.timeStamp, angle });
      if (drag.samples.length > 12) drag.samples.shift();
      kick();
    };

    const onUp = (event: PointerEvent) => {
      const drag = m.drag;
      if (!drag || event.pointerId !== drag.id) return;
      m.drag = null;
      if (drag.moved) {
        m.lastTap = -Infinity;
        m.spin = release(m.spin.angle, dragVelocity(drag.samples, event.timeStamp), reduced);
      } else if (event.type === "pointerup" && event.timeStamp - m.lastTap < DOUBLE_TAP_MS) {
        m.lastTap = -Infinity;
        m.spin = toFront(m.spin.angle);
      } else {
        m.lastTap = event.type === "pointerup" ? event.timeStamp : -Infinity;
        m.spin = release(m.spin.angle, 0, reduced);
      }
      kick();
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);

    let flashTimeout = 0;
    if (celebrate && on && !m.celebrated) {
      m.celebrated = true;
      if (spinsIn) m.entranceAt = performance.now() + SPIN_IN_DELAY_MS;
      else flashTimeout = window.setTimeout(flash, SPIN_IN_DELAY_MS);
    }
    paint();
    kick();

    return () => {
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      window.clearTimeout(flashTimeout);
      cancelAnimationFrame(m.raf);
      m.raf = 0;
      m.drag = null;
    };
  }, [on, reduced, celebrate, spinsIn]);

  useEffect(() => {
    if (!tiltActive) return;
    const m = motion.current;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      const t = m.tilt;
      // A posição de segurar o celular vira o "neutro" e se reajusta devagar
      t.baseBeta = t.baseBeta === null ? event.beta : t.baseBeta + (event.beta - t.baseBeta) * 0.01;
      const clampTilt = (value: number) => Math.min(MAX_TILT, Math.max(-MAX_TILT, value));
      t.targetX = clampTilt((t.baseBeta - event.beta) * TILT_GAIN);
      t.targetY = clampTilt(event.gamma * TILT_GAIN);
      kickRef.current();
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      Object.assign(m.tilt, { targetX: 0, targetY: 0, baseBeta: null });
      kickRef.current();
    };
  }, [tiltActive]);

  const askTilt = async () => {
    try {
      const result = await (DeviceOrientationEvent as DeviceOrientationWithPermission).requestPermission?.();
      tiltGranted = result === "granted";
    } catch {
      tiltGranted = false;
    }
    setTilt(tiltGranted ? "on" : "off");
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div
        ref={stageRef}
        role="img"
        aria-label={`Medalha ${achievement.name}, ${on ? "desbloqueada" : "bloqueada"}. Arraste para girar.`}
        className="relative flex h-48 w-full cursor-grab touch-pan-y items-center justify-center select-none perspective-[700px] [-webkit-touch-callout:none] active:cursor-grabbing"
      >
        {on && (
          <div
            ref={ringOutRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto size-30 rounded-full border-2 border-lime opacity-0"
          />
        )}
        <div
          ref={pieceRef}
          className="relative h-28 w-24 transform-3d will-change-transform"
          style={{ transform: initial.transform }}
        >
          {Array.from({ length: EDGE_LAYERS }, (_, index) => (
            <div
              key={index}
              aria-hidden
              className={cn(
                "absolute inset-0",
                on
                  ? "bg-[linear-gradient(160deg,oklch(0.74_0.17_128),oklch(0.42_0.1_128)_55%,oklch(0.66_0.16_128))]"
                  : "bg-[linear-gradient(160deg,#2c3136,#16191c_55%,#262a2e)]",
              )}
              style={{
                clipPath: HEXAGON,
                transform: `translateZ(${-THICKNESS / 2 + (THICKNESS / (EDGE_LAYERS + 1)) * (index + 1)}px)`,
              }}
            />
          ))}
          <Face transform={`translateZ(${THICKNESS / 2}px)`}>
            <AchievementHexagon achievement={achievement} size="lg" />
          </Face>
          <Face transform={`rotateY(180deg) translateZ(${THICKNESS / 2}px)`}>
            <AchievementHexagon achievement={achievement} size="lg" side="back" />
          </Face>
          {on && (
            <>
              <Sheen bandRef={frontBandRef} ringRef={frontRingRef} transform={`translateZ(${THICKNESS / 2 + 1}px)`} />
              <Sheen bandRef={backBandRef} ringRef={backRingRef} transform={`rotateY(180deg) translateZ(${THICKNESS / 2 + 1}px)`} />
            </>
          )}
        </div>
        {on && (
          <div
            ref={flashRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto size-44 rounded-full bg-[radial-gradient(closest-side,oklch(0.98_0.06_128/0.9),oklch(0.9_0.2_128/0.35)_45%,transparent)] opacity-0"
          />
        )}
      </div>

      <div className="flex min-h-8 items-center gap-3">
        <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/35">
          ARRASTE PARA GIRAR
        </span>
        {tilt === "ask" && !reduced && (
          <button type="button" onClick={askTilt} className="flex h-12 items-center">
            <span className="flex h-8 items-center rounded-[11px] border border-white/8 bg-white/4 px-3 font-mono text-[9.5px] leading-none font-semibold tracking-[0.16em] text-fg/75 transition-transform duration-150 active:scale-95">
              ATIVAR MOVIMENTO
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Frente ou verso: o selo idêntico ao plano, sobre um fundo opaco da cor do
 * sheet (a borda translúcida não deixa ver as camadas de espessura atrás).
 */
function Face({ transform, children }: { transform: string; children: ReactNode }) {
  return (
    <div aria-hidden className="absolute inset-0 backface-hidden" style={{ transform }}>
      <div className="absolute inset-0 bg-[rgb(12_15_18)]" style={{ clipPath: HEXAGON }} />
      {children}
    </div>
  );
}

/** Metal polido por cima da face: borda em outro gradiente e a faixa especular. */
function Sheen({ bandRef, ringRef, transform }: { bandRef: DivRef; ringRef: DivRef; transform: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 backface-hidden" style={{ transform }}>
      <div
        ref={ringRef}
        className="absolute inset-0 bg-[linear-gradient(20deg,oklch(0.97_0.08_128),oklch(0.9_0.2_128/0.1)_50%,oklch(0.95_0.12_128))] opacity-0"
        style={{ clipPath: RING }}
      />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: HEXAGON }}>
        <div
          ref={bandRef}
          className="absolute -inset-y-4 left-1/4 w-1/2 bg-linear-to-r from-transparent via-white/45 to-transparent opacity-0 will-change-transform"
          style={{ transform: "translateX(-150%) skewX(-20deg)" }}
        />
      </div>
    </div>
  );
}
