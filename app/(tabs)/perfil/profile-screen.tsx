"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatMonthYear } from "@/lib/date";
import { formatKg, formatNumber, initials } from "@/lib/format";
import { calculateGoals, GOAL_LABEL, rebalanceCarbs, type Goal } from "@/lib/nutrition-calc";
import type { ProfilePageData } from "@/lib/profile-data";
import {
  BODY_LIMITS,
  GOAL_LIMITS,
  GOAL_OPTIONS,
  GOALS_SOURCE_LABEL,
  SEX_OPTIONS,
  bmi,
  macroKcal,
} from "@/lib/profile-model";
import { XP_PER_LEVEL } from "@/lib/xp";
import { AchievementsGrid } from "./achievements-grid";
import { dismissGoalSuggestion, logWeight, saveGoals, updateGoal } from "./actions";

const RING = "M40 3 a37 37 0 1 1 0 74 a37 37 0 1 1 0 -74";
/** Espera depois do último toque no −/+ antes de gravar o peso. */
const WEIGHT_SAVE_DELAY_MS = 600;

type Goals = { kcal: number; protein: number; carbs: number; fat: number };

export function ProfileScreen({ data, notice }: { data: ProfilePageData; notice: string | null }) {
  const [toast, showToast] = useToast(notice ?? undefined);

  useEffect(() => {
    if (notice) window.history.replaceState(null, "", "/perfil");
  }, [notice]);

  return (
    <>
      <ProfileHeader data={data} />
      <BodyStats data={data} onError={(message) => showToast(message, "error")} />
      <GoalSelector data={data} onToast={showToast} />
      {data.suggestion && <SuggestionCard data={data} onToast={showToast} />}
      <GoalsEditor
        key={`${data.goals.kcal}-${data.goals.protein}-${data.goals.carbs}-${data.goals.fat}-${data.goals.source}`}
        goals={data.goals}
        onToast={showToast}
      />
      <AchievementsGrid achievements={data.achievements} />
      <div className="mt-1 flex flex-col gap-2">
        <Link href="/onboarding" className={buttonStyles({ variant: "secondary", size: "md", className: "w-full" })}>
          Refazer onboarding
        </Link>
      </div>
      {toast}
    </>
  );
}

function ProfileHeader({ data }: { data: ProfilePageData }) {
  const progress = Math.min(100, ((data.xp - data.levelStart) / XP_PER_LEVEL) * 100);
  return (
    <header className="flex items-center gap-4 px-0.5 py-1">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" aria-hidden className="size-20 -rotate-0">
          <path d={RING} fill="none" strokeWidth={4} className="stroke-white/8" />
          <path
            d={RING}
            pathLength={100}
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={100}
            className="animate-ring stroke-lime drop-shadow-[0_0_6px_oklch(0.9_0.2_128/0.7)]"
            style={{ strokeDashoffset: (100 - progress).toFixed(2) }}
          />
        </svg>
        <span className="absolute inset-2.5 grid place-items-center rounded-full border border-lime/30 bg-white/4 font-display text-2xl font-semibold">
          {initials(data.name)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="truncate font-display text-2xl leading-tight font-semibold">{data.name}</h1>
        <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-lime">
          NÍVEL {data.level} · {formatNumber(data.xp)} / {formatNumber(data.levelStart + XP_PER_LEVEL)} XP
        </span>
        <span className="text-xs text-fg/50">Membro desde {formatMonthYear(new Date(data.memberSince))}</span>
      </div>
    </header>
  );
}

function BodyStats({ data, onError }: { data: ProfilePageData; onError: (message: string) => void }) {
  const { body } = data;
  const [weight, setWeight] = useState(body.weightKg);
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const change = (delta: number) => {
    const next = Math.round(Math.min(BODY_LIMITS.weightKg.max, Math.max(BODY_LIMITS.weightKg.min, (weight ?? 70) + delta)) * 10) / 10;
    setWeight(next);
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const result = await logWeight(next);
      if (result?.error) onError(result.error);
      else setSaved(true);
    }, WEIGHT_SAVE_DELAY_MS);
  };

  const sexLabel = SEX_OPTIONS.find((option) => option.value === body.sex)?.label.toLowerCase();

  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Peso" value={weight !== null ? formatKg(weight) : "—"} unit="kg" accent>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {[-0.1, 0.1].map((delta) => (
            <button
              key={delta}
              type="button"
              aria-label={delta < 0 ? "Diminuir peso" : "Aumentar peso"}
              onClick={() => change(delta)}
              className="h-10 rounded-[10px] border border-white/10 bg-white/5 font-mono text-lg text-fg/80 transition-transform duration-150 active:scale-90 active:bg-lime/20"
            >
              {delta < 0 ? "−" : "+"}
            </button>
          ))}
        </div>
        <span aria-live="polite" className="font-mono text-[10px] text-fg/40">
          {saved ? "peso de hoje" : "salvando…"}
        </span>
      </Stat>
      <Stat
        label="Altura"
        value={body.heightCm ? formatNumber(body.heightCm / 100, 2) : "—"}
        unit="m"
        sub={body.heightCm && weight ? `IMC ${formatNumber(bmi(weight, body.heightCm), 1)}` : undefined}
      />
      <Stat label="Idade" value={body.age !== null ? String(body.age) : "—"} unit="anos" sub={sexLabel} />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  accent = false,
  children,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[18px] border p-3",
        accent ? "border-lime/25 bg-lime/4" : "border-white/8 bg-white/[0.035]",
      )}
    >
      <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50 uppercase">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-[22px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
        <span className="font-mono text-[11px] text-fg/50">{unit}</span>
      </span>
      {sub && <span className="font-mono text-[11px] text-fg/50">{sub}</span>}
      {children}
    </div>
  );
}

function GoalSelector({ data, onToast }: { data: ProfilePageData; onToast: (text: string, tone?: "default" | "error") => void }) {
  const [goal, setGoal] = useState<Goal>(data.body.goal);
  const [proposal, setProposal] = useState<Goals | null>(null);
  const [pending, startTransition] = useTransition();
  const { body } = data;

  const choose = (next: Goal) => {
    if (next === goal) return;
    const previous = goal;
    setGoal(next);
    startTransition(async () => {
      const result = await updateGoal(next);
      if (result?.error) {
        setGoal(previous);
        onToast(result.error, "error");
        return;
      }
      if (body.sex && body.age !== null && body.heightCm && body.weightKg && body.activityLevel && body.workoutsPerWeek) {
        const calculated = calculateGoals({
          sex: body.sex,
          age: body.age,
          heightCm: body.heightCm,
          weightKg: body.weightKg,
          goal: next,
          activityLevel: body.activityLevel,
          workoutsPerWeek: body.workoutsPerWeek,
        });
        setProposal({ kcal: calculated.kcal, protein: calculated.protein, carbs: calculated.carbs, fat: calculated.fat });
      } else {
        onToast("Objetivo atualizado");
      }
    });
  };

  const apply = () =>
    startTransition(async () => {
      if (!proposal) return;
      const result = await saveGoals(proposal, "calculado");
      if (result?.error) onToast(result.error, "error");
      else onToast("Metas atualizadas");
      setProposal(null);
    });

  return (
    <Card className="flex flex-col gap-3">
      <Label>Objetivo</Label>
      <Segmented
        aria-label="Objetivo"
        options={GOAL_OPTIONS.map((option) => ({ value: option.value, label: option.short }))}
        value={goal}
        onChange={choose}
      />
      <span className="text-[13px] text-fg/55">{GOAL_OPTIONS.find((option) => option.value === goal)?.hint}</span>

      <Sheet open={proposal !== null} onClose={() => setProposal(null)} title="Aplicar novas metas?">
        {proposal && (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-fg/65">
              Recalculamos para {GOAL_LABEL[goal]}:{" "}
              <strong className="font-semibold text-fg">{formatNumber(proposal.kcal)} kcal</strong> · P {proposal.protein} · C{" "}
              {proposal.carbs} · G {proposal.fat}
            </p>
            <div className="flex flex-col gap-2">
              <Button loading={pending} onClick={apply}>
                Aplicar
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setProposal(null)}>
                Manter as atuais
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function SuggestionCard({ data, onToast }: { data: ProfilePageData; onToast: (text: string, tone?: "default" | "error") => void }) {
  const suggestion = data.suggestion!;
  const [pending, startTransition] = useTransition();
  const signed = (value: number, digits = 0) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value), digits)}`;

  const accept = () =>
    startTransition(async () => {
      const goals = { ...data.goals, kcal: suggestion.newKcal };
      const result = await saveGoals({ ...goals, carbs: rebalanceCarbs(goals) }, "calculado");
      if (result?.error) onToast(result.error, "error");
      else onToast(`Meta ajustada para ${formatNumber(suggestion.newKcal)} kcal`);
    });

  const dismiss = () =>
    startTransition(async () => {
      const result = await dismissGoalSuggestion();
      if (result?.error) onToast(result.error, "error");
    });

  return (
    <Card className="flex flex-col gap-3 border-amber/30 bg-amber/5">
      <div className="flex items-baseline justify-between">
        <Label tone="amber">Sugestão de meta</Label>
        <span className="font-mono text-xl font-semibold text-amber">{signed(suggestion.adjustKcal)} kcal</span>
      </div>
      <p className="text-[13px] leading-relaxed text-fg/70">
        Nas últimas 3 semanas seu peso variou {signed(suggestion.actualKgPerWeek, 2)} kg por semana. Para{" "}
        {GOAL_LABEL[data.body.goal]}, o esperado é {signed(suggestion.expectedKgPerWeek, 2)} kg. A meta iria de{" "}
        {formatNumber(data.goals.kcal)} para {formatNumber(suggestion.newKcal)} kcal (o carbo absorve a diferença).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" loading={pending} onClick={accept}>
          Aceitar
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={dismiss}>
          Ignorar
        </Button>
      </div>
    </Card>
  );
}

const GOAL_ROWS = [
  { key: "kcal", name: "Calorias", unit: "kcal", dot: "bg-fg/70", limits: GOAL_LIMITS.kcal },
  { key: "protein", name: "Proteína", unit: "g", dot: "bg-lime", limits: GOAL_LIMITS.protein },
  { key: "carbs", name: "Carbo", unit: "g", dot: "bg-cyan", limits: GOAL_LIMITS.carbs },
  { key: "fat", name: "Gordura", unit: "g", dot: "bg-amber", limits: GOAL_LIMITS.fat },
] as const;

function GoalsEditor({
  goals,
  onToast,
}: {
  goals: ProfilePageData["goals"];
  onToast: (text: string, tone?: "default" | "error") => void;
}) {
  const [draft, setDraft] = useState<Goals>({ kcal: goals.kcal, protein: goals.protein, carbs: goals.carbs, fat: goals.fat });
  const [saving, startSaving] = useTransition();
  const dirty = GOAL_ROWS.some((row) => draft[row.key] !== goals[row.key]);
  const sum = macroKcal(draft);
  const diff = sum - draft.kcal;
  const ok = Math.abs(diff) <= draft.kcal * 0.05;

  const save = () =>
    startSaving(async () => {
      const result = await saveGoals(draft, "personalizado");
      if (result?.error) onToast(result.error, "error");
      else onToast("Metas salvas");
    });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Metas diárias</Label>
          <span className="rounded-md border border-white/12 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em] text-fg/60 uppercase">
            {dirty ? "personalizado" : GOALS_SOURCE_LABEL[goals.source]}
          </span>
        </div>
        <span className={cn("font-mono text-[11px]", ok ? "text-fg/55" : "text-amber")}>
          Macros somam {formatNumber(sum)} kcal
          <span className={cn("ml-1.5 font-semibold", ok ? "text-lime" : "text-amber")}>
            {ok ? "OK" : `${diff > 0 ? "+" : "−"}${formatNumber(Math.abs(diff))} kcal da meta`}
          </span>
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {GOAL_ROWS.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", row.dot)} />
            <span className="w-20 shrink-0 text-sm font-medium">{row.name}</span>
            <Stepper
              label={row.unit}
              value={draft[row.key]}
              step={row.limits.step}
              min={row.limits.min}
              max={row.limits.max}
              format={(value) => formatNumber(value)}
              onChange={(value) => setDraft((current) => ({ ...current, [row.key]: value }))}
              className="flex-1"
            />
          </li>
        ))}
      </ul>
      {dirty && (
        <div className="grid animate-item-in grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => setDraft({ kcal: goals.kcal, protein: goals.protein, carbs: goals.carbs, fat: goals.fat })}>
            Desfazer
          </Button>
          <Button size="sm" loading={saving} onClick={save}>
            Salvar metas
          </Button>
        </div>
      )}
    </Card>
  );
}
