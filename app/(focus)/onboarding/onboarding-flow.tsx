"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconButton, iconButtonStyles } from "@/components/ui/icon-button";
import { CheckIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import { WheelPicker } from "@/components/ui/wheel-picker";
import { cn } from "@/lib/cn";
import { shiftDay, todayInAppTimeZone } from "@/lib/date";
import { DEFAULT_MEAL_TIMES, MEALS, type MealPlanEntry, type MealType } from "@/lib/diet-model";
import { formatKg, formatNumber } from "@/lib/format";
import { ageOn, calculateGoals, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition-calc";
import type { OnboardingDefaults } from "@/lib/profile-data";
import {
  ACTIVITY_OPTIONS,
  BODY_LIMITS,
  GOAL_LIMITS,
  GOAL_OPTIONS,
  MEALS_PER_DAY,
  RESTRICTION_OPTIONS,
  SEX_OPTIONS,
  macroKcal,
  type Restriction,
} from "@/lib/profile-model";
import { saveOnboarding } from "./actions";

const STEPS = ["Sobre você", "Objetivo", "Rotina", "Treinos", "Refeições", "Suas metas"] as const;

type Goals = { kcal: number; protein: number; carbs: number; fat: number };

/** Onboarding (primeiro acesso) e "Refazer" pelo Perfil: passos curtos e as metas calculadas no fim. */
export function OnboardingFlow({ defaults }: { defaults: OnboardingDefaults }) {
  const { body, redo } = defaults;
  const today = todayInAppTimeZone();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | null>(body.sex);
  const [birthDate, setBirthDate] = useState(body.birthDate ?? "");
  const [heightCm, setHeightCm] = useState(body.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState(body.weightKg ?? 70);
  // No primeiro acesso o objetivo começa vazio: o "manter" do cadastro não foi escolha do usuário
  const [goal, setGoal] = useState<Goal | null>(redo ? body.goal : null);
  const [activity, setActivity] = useState<ActivityLevel | null>(body.activityLevel);
  const [workouts, setWorkouts] = useState(body.workoutsPerWeek ?? defaults.suggestedWorkoutsPerWeek);
  const [meals, setMeals] = useState<MealPlanEntry[]>(defaults.mealPlan);
  const [restrictions, setRestrictions] = useState<Restriction[]>(defaults.restrictions);
  const [adjusted, setAdjusted] = useState<Goals | null>(null);
  const [saving, startSaving] = useTransition();
  const [toast, showToast] = useToast();

  const age = birthDate ? ageOn(birthDate, today) : null;
  const ageOk = age !== null && age >= BODY_LIMITS.age.min && age <= BODY_LIMITS.age.max;

  const calculated =
    sex && age !== null && ageOk && goal && activity
      ? calculateGoals({ sex, weightKg, heightCm, age, goal, activityLevel: activity, workoutsPerWeek: workouts })
      : null;
  const goals = adjusted ?? calculated;

  const canContinue = [
    sex !== null && ageOk,
    goal !== null,
    activity !== null,
    workouts >= 1,
    meals.length >= MEALS_PER_DAY.min && meals.length <= MEALS_PER_DAY.max,
    goals !== null,
  ][step];

  const goBack = () => setStep((current) => Math.max(0, current - 1));
  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    if (!sex || !goal || !activity || !goals) return;
    startSaving(async () => {
      const result = await saveOnboarding({
        sex,
        birthDate,
        heightCm,
        weightKg,
        goal,
        activityLevel: activity,
        workoutsPerWeek: workouts,
        mealPlan: [...meals].sort((a, b) => a.time.localeCompare(b.time)),
        restrictions,
        goals,
        goalsSource: adjusted ? "personalizado" : "calculado",
        redo,
      });
      if ("error" in result) {
        showToast(result.error, "error");
        return;
      }
      if (redo) {
        router.replace(result.next);
        return;
      }
      // Primeiro acesso: a Hoje que redirecionou para cá ficou guardada (rotas preservadas)
      // e, ao reaparecer, redirecionaria de novo. Um carregamento completo descarta esse estado.
      window.location.replace(result.next);
    });
  };

  const toggleMeal = (meal: MealType) =>
    setMeals((current) =>
      current.some((entry) => entry.meal === meal)
        ? current.filter((entry) => entry.meal !== meal)
        : [...current, { meal, time: DEFAULT_MEAL_TIMES[meal] }],
    );

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          {step > 0 ? (
            <IconButton aria-label="Voltar" onClick={goBack}>
              <ChevronLeftIcon className="size-5" />
            </IconButton>
          ) : redo ? (
            <Link href="/perfil" aria-label="Voltar ao perfil" className={iconButtonStyles()}>
              <ChevronLeftIcon className="size-5" />
            </Link>
          ) : (
            <span aria-hidden className="size-12" />
          )}
          <Label className="flex-1 text-center text-fg/60">
            Passo {step + 1} de {STEPS.length}
          </Label>
          <span aria-hidden className="size-12" />
        </div>
        <ol aria-label="Progresso" className="grid grid-cols-6 gap-1.5">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                index <= step ? "bg-lime shadow-[0_0_8px_oklch(0.9_0.2_128/0.55)]" : "bg-white/10",
              )}
            />
          ))}
        </ol>
      </header>

      <main key={step} className="flex flex-1 animate-item-in flex-col gap-4 pt-6">
        {step === 0 && (
          <StepFrame title={redo ? "Seus dados" : "Vamos calcular suas metas"} subtitle="Usamos só para o cálculo de calorias e macros.">
            <Field label="Sexo">
              <Segmented aria-label="Sexo" options={SEX_OPTIONS} value={sex} onChange={setSex} />
            </Field>
            <Field label="Data de nascimento" hint={age !== null && ageOk ? `${age} anos` : birthDate ? "Confira a data" : undefined}>
              <input
                type="date"
                value={birthDate}
                min={shiftDay(today, -365 * BODY_LIMITS.age.max)}
                max={shiftDay(today, -365 * BODY_LIMITS.age.min)}
                onChange={(event) => setBirthDate(event.target.value)}
                aria-label="Data de nascimento"
                className="h-13 w-full rounded-field border border-white/9 bg-white/5 px-4 text-base text-fg outline-none [color-scheme:dark] focus:border-lime/50"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <WheelPicker
                label="ALTURA · CM"
                hint="±1"
                value={heightCm}
                step={1}
                min={BODY_LIMITS.heightCm.min}
                max={BODY_LIMITS.heightCm.max}
                format={String}
                onChange={setHeightCm}
              />
              <WheelPicker
                label="PESO · KG"
                hint="±0,5"
                value={weightKg}
                step={0.5}
                min={BODY_LIMITS.weightKg.min}
                max={BODY_LIMITS.weightKg.max}
                format={formatKg}
                onChange={setWeightKg}
              />
            </div>
          </StepFrame>
        )}

        {step === 1 && (
          <StepFrame title="Qual é o seu objetivo?">
            <ChoiceList
              label="Objetivo"
              options={GOAL_OPTIONS.map((option) => ({ value: option.value, title: option.label, detail: option.hint }))}
              value={goal}
              onChange={(value) => {
                setGoal(value);
                setAdjusted(null);
              }}
            />
          </StepFrame>
        )}

        {step === 2 && (
          <StepFrame title="E fora da academia?" subtitle="Como é o seu dia, sem contar os treinos.">
            <ChoiceList
              label="Rotina"
              options={ACTIVITY_OPTIONS.map((option) => ({ value: option.value, title: option.label, detail: option.example }))}
              value={activity}
              onChange={(value) => {
                setActivity(value);
                setAdjusted(null);
              }}
            />
          </StepFrame>
        )}

        {step === 3 && (
          <StepFrame
            title="Quantos treinos por semana?"
            subtitle={
              body.workoutsPerWeek === null
                ? "Preenchemos pelas suas fichas. Ajuste se for diferente."
                : undefined
            }
          >
            <div role="radiogroup" aria-label="Treinos por semana" className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={count === workouts}
                  onClick={() => {
                    setWorkouts(count);
                    setAdjusted(null);
                  }}
                  className={cn(
                    "grid h-16 place-items-center rounded-2xl border font-mono text-xl font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-95",
                    count === workouts ? "border-lime/60 bg-lime/14 text-lime shadow-glow" : "border-white/8 bg-white/4 text-fg/70",
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="text-center font-mono text-xs text-fg/55">
              {workouts} {workouts === 1 ? "treino" : "treinos"} por semana
            </p>
          </StepFrame>
        )}

        {step === 4 && (
          <StepFrame
            title="Suas refeições"
            subtitle={`Escolha de ${MEALS_PER_DAY.min} a ${MEALS_PER_DAY.max} e o horário aproximado. A meta do dia é dividida entre elas.`}
          >
            <ul className="flex flex-col gap-2">
              {MEALS.map(({ id, name }) => {
                const entry = meals.find((item) => item.meal === id);
                return (
                  <li
                    key={id}
                    className={cn(
                      "flex h-15 items-center gap-3 rounded-2xl border pr-2 pl-1 transition-colors duration-200",
                      entry ? "border-lime/40 bg-lime/6" : "border-white/8 bg-white/[0.025]",
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={entry !== undefined}
                      onClick={() => toggleMeal(id)}
                      disabled={!entry && meals.length >= MEALS_PER_DAY.max}
                      className="flex h-full flex-1 items-center gap-3 pl-2.5 text-left disabled:opacity-40"
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-lg border",
                          entry ? "border-lime bg-lime text-on-lime" : "border-white/20",
                        )}
                      >
                        {entry && <CheckIcon className="size-3.5" />}
                      </span>
                      <span className="text-[15px] font-medium">{name}</span>
                    </button>
                    {entry && (
                      <input
                        type="time"
                        step={300}
                        value={entry.time}
                        aria-label={`Horário de ${name}`}
                        onChange={(event) =>
                          setMeals((current) =>
                            current.map((item) => (item.meal === id ? { ...item, time: event.target.value || item.time } : item)),
                          )
                        }
                        className="h-11 rounded-xl border border-white/10 bg-black/30 px-2.5 font-mono text-[15px] text-fg outline-none [color-scheme:dark] focus:border-lime/50"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <p className={cn("font-mono text-xs", meals.length < MEALS_PER_DAY.min ? "text-amber" : "text-fg/55")}>
              {meals.length} {meals.length === 1 ? "refeição" : "refeições"} por dia
              {meals.length < MEALS_PER_DAY.min && ` · escolha pelo menos ${MEALS_PER_DAY.min}`}
            </p>
            <Field label="Restrições (opcional)">
              <div className="flex flex-wrap gap-2">
                {RESTRICTION_OPTIONS.map((option) => {
                  const active = restrictions.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setRestrictions((current) =>
                          active ? current.filter((value) => value !== option.value) : [...current, option.value],
                        )
                      }
                      className="flex h-12 items-center"
                    >
                      <span
                        className={cn(
                          "flex h-9 items-center rounded-xl border px-3.5 text-[13px] font-medium transition-colors duration-200",
                          active ? "border-lime/60 bg-lime/14 text-lime" : "border-white/8 bg-white/4 text-fg/75",
                        )}
                      >
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </StepFrame>
        )}

        {step === 5 && goals && calculated && (
          <GoalsStep
            goals={goals}
            calculated={calculated}
            adjusted={adjusted !== null}
            onAdjust={setAdjusted}
            onReset={() => setAdjusted(null)}
          />
        )}
      </main>

      <Button size="lg" loading={saving} disabled={!canContinue} onClick={next} className="mt-6 w-full">
        {step === STEPS.length - 1 ? "Usar essas metas" : "Continuar"}
      </Button>
      {toast}
    </div>
  );
}

function StepFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-balance">{title}</h1>
        {subtitle && <p className="text-sm leading-relaxed text-fg/60">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint && <span className="font-mono text-xs text-fg/55">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; title: string; detail: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-19 items-center gap-3.5 rounded-[20px] border p-4 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[.98]",
              selected ? "border-lime/55 bg-lime/10 shadow-glow-sm" : "border-white/8 bg-white/[0.03]",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cn("font-display text-lg font-semibold", selected && "text-lime")}>{option.title}</span>
              <span className="text-[13px] leading-snug text-fg/60">{option.detail}</span>
            </span>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border",
                selected ? "border-lime bg-lime text-on-lime" : "border-white/20",
              )}
            >
              {selected && <CheckIcon className="size-3.5" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GoalsStep({
  goals,
  calculated,
  adjusted,
  onAdjust,
  onReset,
}: {
  goals: Goals;
  calculated: ReturnType<typeof calculateGoals>;
  adjusted: boolean;
  onAdjust: (goals: Goals) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<Goals>) => onAdjust({ ...goals, ...patch });
  const sum = macroKcal(goals);
  const diff = sum - goals.kcal;

  return (
    <StepFrame title="Suas metas diárias">
      <div className="flex flex-col items-center gap-2 rounded-card border border-lime/30 bg-[linear-gradient(160deg,oklch(0.9_0.2_128/0.1),rgb(255_255_255/0.02)_60%)] p-5">
        <span className="flex items-center gap-2">
          <Label tone="accent">Meta do dia</Label>
          <span className="rounded-md border border-white/12 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-fg/60 uppercase">
            {adjusted ? "personalizado" : "calculado"}
          </span>
        </span>
        <span className="font-mono text-[48px] leading-none font-semibold tracking-[-0.04em] text-lime tabular-nums [text-shadow:0_0_22px_oklch(0.9_0.2_128/0.45)]">
          {formatNumber(goals.kcal)}
        </span>
        <span className="font-mono text-xs text-fg/55">kcal por dia</span>
        <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center">
          <Macro label="Proteína" value={goals.protein} className="text-lime" />
          <Macro label="Carbo" value={goals.carbs} className="text-cyan" />
          <Macro label="Gordura" value={goals.fat} className="text-amber" />
        </div>
      </div>

      <section className="flex flex-col gap-2 rounded-card border border-line bg-card p-4">
        <Label>Como chegamos nisso</Label>
        <ol className="flex flex-col gap-1.5">
          {calculated.explanation.map((line) => (
            <li key={line} className="text-[13px] leading-snug text-fg/70">
              {line}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <Label>Ajustar antes</Label>
          {adjusted && (
            <button type="button" onClick={onReset} className="-my-3 py-3 text-xs font-medium text-lime">
              Voltar ao calculado
            </button>
          )}
        </div>
        <Stepper
          label="kcal"
          value={goals.kcal}
          step={GOAL_LIMITS.kcal.step}
          min={GOAL_LIMITS.kcal.min}
          max={GOAL_LIMITS.kcal.max}
          format={(value) => formatNumber(value)}
          onChange={(kcal) => set({ kcal })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Stepper label="Prot. g" value={goals.protein} step={5} min={0} max={GOAL_LIMITS.protein.max} onChange={(protein) => set({ protein })} />
          <Stepper label="Carbo g" value={goals.carbs} step={5} min={0} max={GOAL_LIMITS.carbs.max} onChange={(carbs) => set({ carbs })} />
          <Stepper label="Gord. g" value={goals.fat} step={5} min={0} max={GOAL_LIMITS.fat.max} onChange={(fat) => set({ fat })} />
        </div>
        <p className={cn("font-mono text-xs", Math.abs(diff) <= goals.kcal * 0.05 ? "text-fg/55" : "text-amber")}>
          Macros somam {formatNumber(sum)} kcal
          {Math.abs(diff) <= goals.kcal * 0.05 ? " · OK" : ` · ${diff > 0 ? "+" : "−"}${formatNumber(Math.abs(diff))} kcal da meta`}
        </p>
      </section>
    </StepFrame>
  );
}

function Macro({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("font-mono text-xl font-semibold tabular-nums", className)}>{value} g</span>
      <span className="font-mono text-[10px] tracking-[0.12em] text-fg/50 uppercase">{label}</span>
    </div>
  );
}
