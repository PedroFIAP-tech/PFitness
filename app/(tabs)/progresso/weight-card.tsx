"use client";

import Link from "next/link";
import { useState, useTransition, type PointerEvent } from "react";
import { logWeight } from "@/app/(tabs)/perfil/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Label } from "@/components/ui/label";
import { PillToggle } from "@/components/ui/pill-toggle";
import { Sheet } from "@/components/ui/sheet";
import { WheelPicker } from "@/components/ui/wheel-picker";
import { formatKg, formatNumber } from "@/lib/format";
import type { WeightPoint } from "@/lib/nutrition-calc";
import { BODY_LIMITS } from "@/lib/profile-model";
import {
  WEIGHT_CHART,
  WEIGHT_RANGES,
  buildWeightChart,
  formatShortDay,
  nearestPointIndex,
  type WeightRange,
} from "@/lib/progress-model";

type WeightCardProps = {
  weights: WeightPoint[];
  today: string;
  onToast: (text: string, tone?: "default" | "error") => void;
};

const signed = (value: number, digits = 1) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value), digits)}`;

/** Peso corporal (tela 10): período, gráfico com scrub e tendência, registrar peso. */
export function WeightCard({ weights, today, onToast }: WeightCardProps) {
  const [range, setRange] = useState<WeightRange>("3M");
  const [scrub, setScrub] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const chart = buildWeightChart(weights, range, today);
  const rangeLabel = WEIGHT_RANGES.find((item) => item.id === range)!.label;
  const selected = chart && scrub !== null ? chart.points[scrub] : null;
  const last = chart?.points.at(-1) ?? null;

  const scrubAt = (event: PointerEvent<HTMLDivElement>) => {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setScrub(nearestPointIndex(chart.points, fraction));
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>Peso corporal</Label>
        <PillToggle
          aria-label="Período"
          options={WEIGHT_RANGES.map((item) => ({ value: item.id, label: item.id }))}
          value={range}
          onChange={(next) => {
            setRange(next);
            setScrub(null);
          }}
        />
      </div>

      {!chart || !last ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-fg/60">
            {weights.length === 0 ? "Registre seu peso para acompanhar a evolução." : "Nenhuma pesagem neste período."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-2.5">
            <span className="flex items-baseline gap-1.25">
              {selected ? (
                <span className="font-mono text-[42px] leading-none font-semibold tracking-[-0.05em] tabular-nums">
                  {formatKg(selected.kg)}
                </span>
              ) : (
                <CountUp
                  key={range}
                  value={last.kg}
                  decimals={1}
                  className="font-mono text-[42px] leading-none font-semibold tracking-[-0.05em] tabular-nums"
                />
              )}
              <span className="font-mono text-sm font-medium text-fg/50">kg</span>
            </span>
            <span className="flex-1 pb-1 font-mono text-xs font-medium text-fg/50">
              {(selected ?? last).day === today ? "hoje" : formatShortDay((selected ?? last).day)}
            </span>
            <span className="flex flex-col items-end gap-1 pb-0.5">
              <span className="font-mono text-[15px] font-semibold text-lime">{signed(chart.delta)} kg</span>
              <span className="text-[11px] text-fg/50">{rangeLabel}</span>
            </span>
          </div>

          <div className="relative mt-3.5 h-44.5">
            {(["top", "mid", "bottom"] as const).map((tick, index) => (
              <span
                key={tick}
                aria-hidden
                className="absolute right-0 -translate-y-1/2 font-mono text-[10px] font-medium text-fg/40"
                style={{ top: `${[8, 50, 92][index]}%` }}
              >
                {formatNumber(chart.ticks[tick], 1)}
              </span>
            ))}
            <div
              role="img"
              aria-label={`Peso de ${formatKg(chart.points[0].kg)} kg em ${formatShortDay(chart.points[0].day)} a ${formatKg(last.kg)} kg em ${formatShortDay(last.day)}${chart.trend ? `, tendência de ${signed(chart.trend.kgPerWeek, 2)} kg por semana` : ""}. Arraste para ver cada pesagem.`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                scrubAt(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons || event.pointerType === "mouse") scrubAt(event);
              }}
              onPointerUp={() => setScrub(null)}
              onPointerLeave={() => setScrub(null)}
              onPointerCancel={() => setScrub(null)}
              className="absolute inset-x-0 top-0 right-9.5 bottom-5.5 cursor-crosshair touch-pan-y"
            >
              {[8, 50, 92].map((top) => (
                <div key={top} aria-hidden className="absolute inset-x-0 border-t border-dashed border-white/8" style={{ top: `${top}%` }} />
              ))}
              <svg
                key={range}
                viewBox={`0 0 ${WEIGHT_CHART.width} ${WEIGHT_CHART.height}`}
                preserveAspectRatio="none"
                aria-hidden
                className="absolute inset-0 size-full overflow-visible"
              >
                <defs>
                  <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#C8FF4A" stopOpacity=".26" />
                    <stop offset="1" stopColor="#C8FF4A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {chart.points.length > 1 && (
                  <path d={chart.area} fill="url(#weight-area)" className="animate-fade-in [animation-delay:0.4s] [animation-duration:1s]" />
                )}
                {chart.trend && (
                  <line
                    x1={chart.trend.x1}
                    y1={chart.trend.y1}
                    x2={chart.trend.x2}
                    y2={chart.trend.y2}
                    strokeWidth={1.4}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                    className="animate-fade-in stroke-fg/45 [animation-delay:1.2s]"
                  />
                )}
                {chart.points.length > 1 && (
                  <path
                    d={chart.line}
                    pathLength={1}
                    fill="none"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={1}
                    className="animate-draw stroke-lime drop-shadow-[0_0_4px_oklch(0.9_0.2_128/0.7)]"
                  />
                )}
              </svg>
              {selected ? (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-px bg-white/40"
                    style={{ left: `${(selected.x / WEIGHT_CHART.width) * 100}%` }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -mt-1.75 -ml-1.75 size-3.5 rounded-full border-[2.5px] border-lime bg-bg shadow-[0_0_14px_var(--color-lime)]"
                    style={{ left: `${(selected.x / WEIGHT_CHART.width) * 100}%`, top: `${(selected.y / WEIGHT_CHART.height) * 100}%` }}
                  />
                </>
              ) : (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -mt-1.25 -ml-1.25 size-2.5 animate-glow-pulse rounded-full bg-lime shadow-[0_0_12px_var(--color-lime)]"
                  style={{ left: `${(last.x / WEIGHT_CHART.width) * 100}%`, top: `${(last.y / WEIGHT_CHART.height) * 100}%` }}
                />
              )}
            </div>
            <span aria-hidden className="absolute bottom-0 left-0 font-mono text-[10px] font-medium text-fg/40">
              {formatShortDay(chart.xStart)}
            </span>
            <span aria-hidden className="absolute bottom-0 left-[calc((100%-38px)/2)] -translate-x-1/2 font-mono text-[10px] font-medium text-fg/40">
              {formatShortDay(chart.xMid)}
            </span>
            <span aria-hidden className="absolute right-9.5 bottom-0 font-mono text-[10px] font-medium text-fg/40">
              hoje
            </span>
          </div>

          {chart.trend && (
            <p className="mt-2 flex items-center gap-2 font-mono text-[11px] text-fg/50">
              <span aria-hidden className="w-4 border-t-[1.5px] border-dashed border-fg/45" />
              tendência {signed(chart.trend.kgPerWeek, 2)} kg/sem
            </p>
          )}
        </>
      )}

      <Button variant="secondary" size="sm" onClick={() => setRegistering(true)} className="mt-3.5 w-full">
        Registrar peso
      </Button>

      <WeightSheet
        open={registering}
        initialKg={last?.kg ?? weights.at(-1)?.kg ?? 70}
        onClose={() => setRegistering(false)}
        onSaved={(kg) => {
          setRegistering(false);
          onToast(`Peso de hoje: ${formatKg(kg)} kg`);
        }}
        onError={(message) => onToast(message, "error")}
      />
    </Card>
  );
}

function WeightSheet({
  open,
  initialKg,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  initialKg: number;
  onClose: () => void;
  onSaved: (kg: number) => void;
  onError: (message: string) => void;
}) {
  return open ? <WeightSheetContent initialKg={initialKg} onClose={onClose} onSaved={onSaved} onError={onError} /> : null;
}

function WeightSheetContent({
  initialKg,
  onClose,
  onSaved,
  onError,
}: {
  initialKg: number;
  onClose: () => void;
  onSaved: (kg: number) => void;
  onError: (message: string) => void;
}) {
  const [kg, setKg] = useState(Math.round(initialKg * 10) / 10);
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const result = await logWeight(kg);
      if (result?.error) onError(result.error);
      else onSaved(kg);
    });

  return (
    <Sheet open onClose={onClose} eyebrow="Peso de hoje" title="Registrar peso">
      <div className="flex flex-col gap-4">
        <WheelPicker
          label="PESO · KG"
          hint="±0,1"
          value={kg}
          step={0.1}
          min={BODY_LIMITS.weightKg.min}
          max={BODY_LIMITS.weightKg.max}
          format={formatKg}
          onChange={setKg}
        />
        <p className="text-center text-xs text-fg/50">
          Um registro por dia: registrar de novo hoje substitui. Também dá para ajustar no{" "}
          <Link href="/perfil" className="text-lime">
            Perfil
          </Link>
          .
        </p>
        <Button size="lg" loading={saving} onClick={save}>
          Salvar {formatKg(kg)} kg
        </Button>
      </div>
    </Sheet>
  );
}
