"use client";

import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useRef, useState, useTransition, type PointerEvent } from "react";
import { ScreenHeader } from "@/components/app-shell/screen";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { dayToDate, formatDayLabel, shiftDay } from "@/lib/date";
import type { DiaryDay } from "@/lib/diet";
import {
  FOOD_POINTS,
  MEAL_NAMES,
  MEAL_PREPOSITION,
  foodOfItem,
  groupByMeal,
  isDayOpen,
  portion,
  relativeDayLabel,
  sumNutrients,
  type DiaryItem,
  type Food,
  type MealType,
} from "@/lib/diet-model";
import { useOnline } from "@/lib/use-online";
import { addFood, removeFoodLog, updateFoodLog } from "./actions";
import { DaySummary } from "./day-summary";
import { FoodSheet, type FoodSheetTarget } from "./food-sheet";
import { MealCard } from "./meal-card";

type ItemChange =
  | { type: "add"; item: DiaryItem }
  | { type: "update"; id: number; grams: number; food: Food }
  | { type: "remove"; id: number };

function applyChange(items: DiaryItem[], change: ItemChange): DiaryItem[] {
  switch (change.type) {
    case "add":
      return [...items, change.item];
    case "update":
      return items.map((item) =>
        item.id === change.id
          ? { ...item, grams: change.grams, nutrients: portion(change.food.per100, change.grams) }
          : item,
      );
    case "remove":
      return items.filter((item) => item.id !== change.id);
  }
}

/** Ids temporários (negativos) dos itens ainda salvando. */
let nextTempId = -1;

/** Aba Dieta (tela 08): dia, refeições e o sheet de alimento. */
export function DietScreen({ diary, today }: { diary: DiaryDay; today: string }) {
  const router = useRouter();
  const online = useOnline();
  const [toast, showToast] = useToast();
  const [sheet, setSheet] = useState<FoodSheetTarget | null>(null);
  const [createdFoods, setCreatedFoods] = useState<Food[]>([]);

  const [items, changeItems] = useOptimistic(diary.items, applyChange);
  const [, startSaving] = useTransition();

  // O dia muda na hora no cabeçalho; o conteúdo esmaece até o servidor responder
  const [shownDay, setShownDay] = useOptimistic(diary.day);
  const [navigating, startNavigation] = useTransition();

  const editable = isDayOpen(diary.day, today);
  const totals = useMemo(() => sumNutrients(items.map((item) => item.nutrients)), [items]);
  const meals = useMemo(() => groupByMeal(items), [items]);

  const foods = useMemo(() => {
    const known = new Set(diary.foods.map((food) => food.id));
    const extra = createdFoods.filter((food) => !known.has(food.id));
    return extra.length
      ? [...diary.foods, ...extra].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
      : diary.foods;
  }, [diary.foods, createdFoods]);

  const goToDay = (day: string) => {
    if (day > today) return;
    setSheet(null);
    startNavigation(() => {
      setShownDay(day);
      router.replace(day === today ? "/dieta" : `/dieta?dia=${day}`, { scroll: false });
    });
  };

  const save = (change: ItemChange, request: () => Promise<{ error: string } | undefined>, success: string) => {
    setSheet(null);
    showToast(success);
    startSaving(async () => {
      changeItems(change);
      const result = await request();
      if (result?.error) showToast(result.error, "error");
    });
  };

  const handleAdd = (food: Food, meal: MealType, grams: number) => {
    const item: DiaryItem = {
      id: nextTempId--,
      foodId: food.id,
      name: food.name,
      meal,
      grams,
      loggedAt: new Date().toISOString(),
      nutrients: portion(food.per100, grams),
    };
    save(
      { type: "add", item },
      () => addFood({ foodId: food.id, meal, grams, day: diary.day }),
      `+${FOOD_POINTS} pts · adicionado ${MEAL_PREPOSITION[meal]} ${MEAL_NAMES[meal].toLowerCase()}`,
    );
  };

  const handleUpdate = (item: DiaryItem, grams: number) => {
    save(
      { type: "update", id: item.id, grams, food: foodOfItem(item, foods) },
      () => updateFoodLog(item.id, grams),
      "Quantidade atualizada",
    );
  };

  const handleRemove = (item: DiaryItem) => {
    save({ type: "remove", id: item.id }, () => removeFoodLog(item.id), "Alimento removido");
  };

  return (
    <>
      <ScreenHeader
        eyebrow={formatDayLabel(dayToDate(shownDay))}
        title="Alimentação"
        action={
          shownDay !== today && (
            <button type="button" onClick={() => goToDay(today)} className="flex h-12 shrink-0 items-center">
              <span className="flex h-9 animate-item-in items-center rounded-xl border border-lime/50 bg-lime/10 px-3.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-lime">
                HOJE
              </span>
            </button>
          )
        }
      />

      <DayNav day={shownDay} today={today} onChange={goToDay} />

      {!online && editable && (
        <p role="status" className="rounded-2xl border border-amber/30 bg-amber/8 px-3.5 py-2.5 text-[13px] text-amber">
          Sem conexão. Registrar alimentos precisa de internet.
        </p>
      )}

      <div
        aria-busy={navigating}
        className={cn("flex flex-col gap-3 transition-opacity duration-200", navigating && "pointer-events-none opacity-50")}
      >
        <DaySummary key={diary.day} totals={totals} goals={diary.goals} />
        {meals.map((group) => (
          <MealCard
            key={`${diary.day}-${group.meal}`}
            group={group}
            editable={editable}
            disabled={!online}
            onAdd={(meal) => setSheet({ mode: "add", meal })}
            onEdit={(item) => setSheet({ mode: "edit", item })}
          />
        ))}
      </div>

      <FoodSheet
        target={sheet}
        foods={foods}
        recentFoodIds={diary.recentFoodIds}
        dayKcal={totals.kcal}
        goals={diary.goals}
        online={online}
        onClose={() => setSheet(null)}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onRemove={handleRemove}
        onFoodCreated={(food) => setCreatedFoods((current) => [...current, food])}
      />
      {toast}
    </>
  );
}

/** Distância (px) do arraste horizontal que troca o dia. */
const SWIPE_DISTANCE = 56;

type DayNavProps = { day: string; today: string; onChange: (day: string) => void };

/** ‹ Hoje › com arraste para os lados: direita volta um dia, esquerda avança. */
function DayNav({ day, today, onChange }: DayNavProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const canGoForward = day < today;
  const open = isDayOpen(day, today);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    // Sem dia seguinte, o arraste para a esquerda resiste
    setOffset(dx < 0 && !canGoForward ? dx * 0.15 : dx * 0.45);
  };
  const cancel = () => {
    start.current = null;
    setOffset(0);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    setOffset(0);
    if (!origin) return;
    const dx = event.clientX - origin.x;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(event.clientY - origin.y)) return;
    if (dx > 0) onChange(shiftDay(day, -1));
    else if (canGoForward) onChange(shiftDay(day, 1));
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      className="flex h-14 touch-pan-y items-center gap-1 rounded-[18px] border border-line bg-white/3 px-1 select-none"
    >
      <button
        type="button"
        aria-label="Dia anterior"
        onClick={() => onChange(shiftDay(day, -1))}
        className="grid size-12 place-items-center rounded-[14px] text-fg/70 transition-transform duration-150 active:scale-90 active:bg-white/6"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <div
        aria-live="polite"
        className="flex flex-1 flex-col items-center gap-1"
        style={{ transform: `translateX(${offset}px)`, transition: offset ? "none" : "transform .3s var(--ease-snap)" }}
      >
        <span className="font-display text-base leading-none font-semibold">{relativeDayLabel(day, today)}</span>
        <span className="font-mono text-[10px] leading-none font-medium tracking-[0.14em] text-fg/45 uppercase">
          {open ? "registros abertos" : "só leitura"}
        </span>
      </div>
      <button
        type="button"
        aria-label="Próximo dia"
        disabled={!canGoForward}
        onClick={() => onChange(shiftDay(day, 1))}
        className="grid size-12 place-items-center rounded-[14px] text-fg/70 transition-transform duration-150 active:scale-90 active:bg-white/6 disabled:opacity-25"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}
