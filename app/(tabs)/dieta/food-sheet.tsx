"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ChevronDownIcon, ChevronLeftIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { WheelPicker } from "@/components/ui/wheel-picker";
import { cn } from "@/lib/cn";
import {
  GRAM_PRESETS,
  GRAMS,
  MEAL_NAMES,
  MEAL_PREPOSITION,
  MEALS,
  NEW_FOOD_LIMITS,
  foodOfItem,
  formatMacros,
  newFoodProblem,
  portion,
  type DiaryItem,
  type Food,
  type MealType,
  type Nutrients,
} from "@/lib/diet-model";
import { formatNumber, normalizeForSearch } from "@/lib/format";
import { createFood } from "./actions";
import { MACROS, percentOf } from "./day-summary";

export type FoodSheetTarget = { mode: "add"; meal: MealType } | { mode: "edit"; item: DiaryItem };

type FoodSheetProps = {
  target: FoodSheetTarget | null;
  foods: Food[];
  recentFoodIds: number[];
  /** kcal já registradas no dia */
  dayKcal: number;
  goals: Nutrients;
  online: boolean;
  onClose: () => void;
  onAdd: (food: Food, meal: MealType, grams: number) => void;
  onUpdate: (item: DiaryItem, grams: number) => void;
  onRemove: (item: DiaryItem) => void;
  onFoodCreated: (food: Food) => void;
};

/** Adicionar alimento (tela 09): busca → quantidade, ou edição direto na quantidade. */
export function FoodSheet({ target, ...props }: FoodSheetProps) {
  // Montado só enquanto aberto: cada abertura começa do zero
  return target ? <FoodSheetContent target={target} {...props} /> : null;
}

type Step = "search" | "quantity" | "create";

function FoodSheetContent({
  target,
  foods,
  recentFoodIds,
  dayKcal,
  goals,
  online,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
  onFoodCreated,
}: FoodSheetProps & { target: FoodSheetTarget }) {
  const editing = target.mode === "edit" ? target.item : null;
  const [step, setStep] = useState<Step>(editing ? "quantity" : "search");
  const [meal, setMeal] = useState<MealType>(target.mode === "add" ? target.meal : target.item.meal);
  const [query, setQuery] = useState("");
  const [food, setFood] = useState<Food | null>(() => (editing ? foodOfItem(editing, foods) : null));
  const [grams, setGrams] = useState(editing?.grams ?? 100);

  const pick = (picked: Food) => {
    setFood(picked);
    setGrams(picked.defaultGrams);
    setStep("quantity");
  };

  const close = (
    <IconButton aria-label="Fechar" onClick={onClose} className="size-10 rounded-xl">
      <CloseIcon className="size-4" />
    </IconButton>
  );
  const back = (to: Step) => (
    <IconButton aria-label="Voltar" onClick={() => setStep(to)} className="size-10 rounded-xl">
      <ChevronLeftIcon className="size-4.5" />
    </IconButton>
  );

  if (step === "quantity" && food) {
    const current = portion(food.per100, grams);
    const previous = editing ? editing.nutrients.kcal : 0;
    return (
      <Sheet
        open
        size="tall"
        stepKey="quantity"
        onClose={onClose}
        leading={editing ? undefined : back("search")}
        eyebrow={`100 g = ${formatNumber(food.per100.kcal)} kcal · ${MEAL_NAMES[meal]}`}
        title={food.name}
        action={close}
      >
        <QuantityStep
          grams={grams}
          onGrams={setGrams}
          portion={current}
          goals={goals}
          kcalChange={`${formatNumber(dayKcal)} → ${formatNumber(dayKcal - previous + current.kcal)} kcal no dia`}
        />
        <div className="mt-3.5 flex flex-col gap-2.5">
          <Button
            size="lg"
            disabled={!online}
            onClick={() => {
              if (!editing) onAdd(food, meal, grams);
              else if (grams !== editing.grams) onUpdate(editing, grams);
              else onClose();
            }}
          >
            {!online
              ? "Sem conexão"
              : `${editing ? "Atualizar" : "Adicionar"} · ${formatNumber(current.kcal)} kcal`}
          </Button>
          {editing && (
            <Button variant="danger" disabled={!online} onClick={() => onRemove(editing)} className="normal-case tracking-normal font-sans font-medium text-sm">
              Remover alimento
            </Button>
          )}
        </div>
      </Sheet>
    );
  }

  if (step === "create") {
    return (
      <Sheet
        open
        size="tall"
        stepKey="create"
        onClose={onClose}
        leading={back("search")}
        eyebrow="Valores por 100 g"
        title="Novo alimento"
        action={close}
      >
        <NewFoodForm
          initialName={query.trim()}
          online={online}
          onCreated={(created) => {
            onFoodCreated(created);
            setFood(created);
            setGrams(created.defaultGrams);
            setStep("quantity");
          }}
        />
      </Sheet>
    );
  }

  return (
    <SearchStep
      meal={meal}
      onMeal={setMeal}
      query={query}
      onQuery={setQuery}
      foods={foods}
      recentFoodIds={recentFoodIds}
      onPick={pick}
      onCreate={() => setStep("create")}
      onClose={onClose}
      close={close}
    />
  );
}

type SearchStepProps = {
  meal: MealType;
  onMeal: (meal: MealType) => void;
  query: string;
  onQuery: (query: string) => void;
  foods: Food[];
  recentFoodIds: number[];
  onPick: (food: Food) => void;
  onCreate: () => void;
  onClose: () => void;
  close: ReactNode;
};

function SearchStep({ meal, onMeal, query, onQuery, foods, recentFoodIds, onPick, onCreate, onClose, close }: SearchStepProps) {
  const [choosingMeal, setChoosingMeal] = useState(false);

  const searchable = useMemo(() => foods.map((food) => ({ food, key: normalizeForSearch(food.name) })), [foods]);
  const recents = useMemo(() => {
    const byId = new Map(foods.map((food) => [food.id, food]));
    return recentFoodIds.flatMap((id) => byId.get(id) ?? []);
  }, [foods, recentFoodIds]);

  const term = normalizeForSearch(query);
  const visible = term ? searchable.filter(({ key }) => key.includes(term)) : searchable;

  return (
    <Sheet
      open
      size="tall"
      stepKey="search"
      onClose={onClose}
      eyebrow={`Adicionar ${MEAL_PREPOSITION[meal]}`}
      title={
        <button
          type="button"
          aria-expanded={choosingMeal}
          aria-label={`Refeição: ${MEAL_NAMES[meal]}. Trocar refeição`}
          onClick={() => setChoosingMeal((open) => !open)}
          className="-my-1 flex items-center gap-1.5 py-1"
        >
          {MEAL_NAMES[meal]}
          <ChevronDownIcon className={cn("size-4 text-lime transition-transform duration-200", choosingMeal && "rotate-180")} />
        </button>
      }
      action={close}
      header={
        <>
          {choosingMeal && (
            <div role="radiogroup" aria-label="Refeição" className="-mx-4 flex animate-item-in gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
              {MEALS.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={id === meal}
                  onClick={() => {
                    onMeal(id);
                    setChoosingMeal(false);
                  }}
                  className="flex h-12 shrink-0 items-center"
                >
                  <span
                    className={cn(
                      "flex h-8.5 items-center rounded-[11px] border px-3.25 text-[13px] font-medium transition-colors duration-200",
                      id === meal ? "border-lime/60 bg-lime/14 text-lime" : "border-white/8 bg-white/4 text-fg/75",
                    )}
                  >
                    {name}
                  </span>
                </button>
              ))}
            </div>
          )}
          <label className="flex h-12.5 items-center gap-2.5 rounded-[15px] border border-lime/35 bg-white/5 px-3.5 shadow-[0_0_18px_oklch(0.9_0.2_128/0.08)] focus-within:border-lime/60">
            <SearchIcon className="size-4.5 shrink-0 text-lime" />
            <input
              type="search"
              enterKeyHint="search"
              aria-label="Buscar alimento"
              placeholder="Buscar alimento (ex: frango)"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg/40"
            />
          </label>
          {recents.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50">RECENTES</span>
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
                {recents.map((food) => (
                  <button key={food.id} type="button" onClick={() => onPick(food)} className="flex h-12 shrink-0 items-center">
                    <span className="flex h-8.5 items-center rounded-[11px] border border-white/9 bg-white/5 px-3.25 text-[13px] font-medium transition-[transform,border-color] duration-150 active:scale-[.94] active:border-lime">
                      {food.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      }
    >
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-7 text-center">
          <p className="text-sm text-fg/55">Nenhum alimento encontrado.</p>
          <Button variant="secondary" onClick={onCreate} className="max-w-full">
            <PlusIcon className="size-4 shrink-0" />
            <span className="truncate normal-case">Criar “{query.trim()}”</span>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map(({ food }) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => onPick(food)}
                className="flex min-h-14.5 w-full items-center gap-3 rounded-2xl border border-white/7 bg-white/[0.025] px-3.5 py-2 text-left transition-[transform,border-color] duration-150 active:scale-[.98] active:border-lime/50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{food.name}</span>
                    {food.own && (
                      <span className="shrink-0 rounded-md border border-lime/35 px-1.5 py-0.5 font-mono text-[9px] leading-none font-semibold tracking-[0.12em] text-lime">
                        SEU
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-fg/50">{formatMacros(food.per100, 1)} /100 g</span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[15px] font-semibold">{formatNumber(food.per100.kcal)}</span>
                  <span className="font-mono text-[9.5px] font-medium text-fg/45">kcal</span>
                </span>
              </button>
            </li>
          ))}
          {term && (
            <li>
              <button
                type="button"
                onClick={onCreate}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/14 text-sm font-medium text-fg/70 transition-colors duration-200 active:border-lime/50 active:text-lime"
              >
                <PlusIcon className="size-4 shrink-0" />
                <span className="truncate">Criar “{query.trim()}”</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </Sheet>
  );
}

type QuantityStepProps = {
  grams: number;
  onGrams: (grams: number) => void;
  portion: Nutrients;
  goals: Nutrients;
  kcalChange: string;
};

function QuantityStep({ grams, onGrams, portion: values, goals, kcalChange }: QuantityStepProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[1fr_1.1fr] gap-2.5">
        <WheelPicker
          label="GRAMAS"
          hint={`±${GRAMS.step}`}
          value={grams}
          step={GRAMS.step}
          min={GRAMS.min}
          max={GRAMS.max}
          format={(value) => formatNumber(value, 1)}
          onChange={onGrams}
        />
        <div className="flex flex-col justify-center gap-2.5 rounded-[18px] border border-line bg-white/[0.035] p-3.5">
          <span className="flex items-baseline gap-1">
            <span
              aria-live="polite"
              className="font-mono text-[34px] leading-none font-semibold tracking-[-0.05em] text-lime tabular-nums [text-shadow:0_0_16px_oklch(0.9_0.2_128/0.4)]"
            >
              {formatNumber(values.kcal)}
            </span>
            <span className="font-mono text-[11px] font-medium text-fg/50">kcal</span>
          </span>
          {MACROS.map((macro) => (
            <div key={macro.key} className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[11.5px] font-medium">
                <span className={macro.text}>{macro.name}</span>
                <span>{formatNumber(values[macro.key], 1)} g</span>
              </div>
              <div className="h-1 rounded-[2px] bg-white/6">
                <div
                  className={cn("h-full rounded-[2px] shadow-none transition-[width] duration-250", macro.bar)}
                  style={{ width: `${percentOf(values[macro.key], goals[macro.key]).toFixed(1)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        {GRAM_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={grams === preset}
            onClick={() => onGrams(preset)}
            className={cn(
              "h-12 flex-1 rounded-xl border font-mono text-[12.5px] font-semibold transition-[transform,background-color,border-color,color] duration-200 active:scale-[.92]",
              grams === preset ? "border-lime/60 bg-lime/14 text-lime" : "border-white/8 bg-white/4 text-fg/80",
            )}
          >
            {preset} g
          </button>
        ))}
      </div>

      <span className="text-center font-mono text-xs font-medium text-fg/55">{kcalChange}</span>
    </div>
  );
}

const NUMBER_FIELDS = [
  { key: "kcal", label: "Kcal", max: NEW_FOOD_LIMITS.kcalMax },
  { key: "protein", label: "Proteína (g)", max: NEW_FOOD_LIMITS.macroMax },
  { key: "carbs", label: "Carbo (g)", max: NEW_FOOD_LIMITS.macroMax },
  { key: "fat", label: "Gordura (g)", max: NEW_FOOD_LIMITS.macroMax },
] as const satisfies { key: keyof Nutrients; label: string; max: number }[];

/** "12,5" ou "12.5" → 12.5; vazio vira NaN (campo obrigatório). */
const parseDecimal = (text: string) => (text.trim() ? Number(text.trim().replace(",", ".")) : Number.NaN);

function NewFoodForm({
  initialName,
  online,
  onCreated,
}: {
  initialName: string;
  online: boolean;
  onCreated: (food: Food) => void;
}) {
  const [name, setName] = useState(initialName);
  const [numbers, setNumbers] = useState<Record<keyof Nutrients, string>>({ kcal: "", protein: "", carbs: "", fat: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = {
      name,
      kcal: parseDecimal(numbers.kcal),
      protein: parseDecimal(numbers.protein),
      carbs: parseDecimal(numbers.carbs),
      fat: parseDecimal(numbers.fat),
    };
    const problem = newFoodProblem(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await createFood(values);
      if ("error" in result) setError(result.error);
      else onCreated(result.food);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-fg/55 uppercase">Nome</span>
        <Input
          value={name}
          maxLength={NEW_FOOD_LIMITS.nameMaxLength}
          autoComplete="off"
          placeholder="Ex.: Pão de queijo caseiro"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        {NUMBER_FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-fg/55 uppercase">{field.label}</span>
            <Input
              inputMode="decimal"
              autoComplete="off"
              placeholder={`0 a ${field.max}`}
              value={numbers[field.key]}
              onChange={(event) => setNumbers((current) => ({ ...current, [field.key]: event.target.value }))}
              className="font-mono"
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} disabled={!online} className="mt-1">
        {online ? "Criar alimento" : "Sem conexão"}
      </Button>
    </form>
  );
}
