"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState, useTransition } from "react";
import { FocusHeader } from "@/components/app-shell/focus-header";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import { estimatePlanMinutes, NEW_EXERCISE_DEFAULTS, PLAN_LIMITS, WEEKDAYS } from "@/lib/workout-rules";
import type { LibraryExercise, PlanExercise, WorkoutPlan } from "@/lib/workouts";
import { deletePlan, savePlan } from "./actions";
import { ExerciseLibrarySheet } from "./exercise-library-sheet";

type PlanEditorProps = {
  /** null em /treinos/nova */
  plan: WorkoutPlan | null;
  /** Letra exibida (a ficha nova recebe a letra de verdade ao salvar). */
  code: string;
  library: LibraryExercise[];
  muscleGroups: string[];
};

type DraftExercise = PlanExercise & { key: string };

export function PlanEditor(props: PlanEditorProps) {
  // Com Cache Components a rota fica preservada ao sair. A chave muda a cada
  // navegação por link, então o editor recomeça com os dados do servidor; no
  // voltar/avançar do navegador o rascunho é mantido.
  const { bfcacheId } = useRouter();
  return <PlanEditorForm key={bfcacheId} {...props} />;
}

function PlanEditorForm({ plan, code, library, muscleGroups }: PlanEditorProps) {
  const [title, setTitle] = useState(plan?.title ?? "");
  const [weekday, setWeekday] = useState<number | null>(plan?.weekday ?? null);
  const [items, setItems] = useState<DraftExercise[]>(() =>
    (plan?.exercises ?? []).map((item) => ({ ...item, key: crypto.randomUUID() })),
  );
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [toast, showToast] = useToast();

  // Sheets são transitórios: fecham quando a rota fica oculta
  useLayoutEffect(
    () => () => {
      setLibraryOpen(false);
      setConfirmingDelete(false);
    },
    [],
  );

  const selectedIds = useMemo(() => new Set(items.map((item) => item.exercise.id)), [items]);
  const totalSets = items.reduce((sum, item) => sum + item.targetSets, 0);

  const update = (key: string, patch: Partial<Pick<PlanExercise, "targetSets" | "targetReps" | "notes">>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const move = (index: number, offset: -1 | 1) =>
    setItems((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });

  const remove = (key: string) => setItems((current) => current.filter((item) => item.key !== key));

  const toggleFromLibrary = (exercise: LibraryExercise) => {
    if (selectedIds.has(exercise.id)) {
      setItems((current) => current.filter((item) => item.exercise.id !== exercise.id));
      showToast(`${exercise.name} removido`);
      return;
    }
    if (items.length >= PLAN_LIMITS.maxExercises) {
      showToast(`Máximo de ${PLAN_LIMITS.maxExercises} exercícios por ficha`, "error");
      return;
    }
    setItems((current) => [
      ...current,
      { exercise, ...NEW_EXERCISE_DEFAULTS, notes: null, key: crypto.randomUUID() },
    ]);
    showToast(`${exercise.name} adicionado`);
  };

  const save = () =>
    startSaving(async () => {
      const result = await savePlan({
        planId: plan?.id ?? null,
        title,
        weekday,
        exercises: items.map(({ exercise, targetSets, targetReps, restSeconds, notes }) => ({
          exerciseId: exercise.id,
          targetSets,
          targetReps,
          restSeconds,
          notes,
        })),
      });
      if (result?.error) showToast(result.error, "error");
    });

  const confirmDelete = () =>
    startDeleting(async () => {
      if (!plan) return;
      const result = await deletePlan(plan.id);
      if (result?.error) showToast(result.error, "error");
    });

  return (
    <>
      <FocusHeader
        backHref="/treinos"
        label={plan ? "Editar ficha" : "Nova ficha"}
        action={
          <Button
            size="sm"
            loading={saving}
            disabled={deleting}
            onClick={save}
            className="rounded-[14px] px-4.5 text-[13px] tracking-label"
          >
            Salvar
          </Button>
        }
      />

      <div className="flex flex-col gap-3 px-3.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="flex items-center gap-3.5 rounded-card border border-lime/25 bg-white/[0.035] p-3.5">
          <span className="grid size-14.5 shrink-0 place-items-center rounded-2xl border border-lime/50 bg-lime/10 font-display text-[28px] font-bold text-lime shadow-glow">
            {code}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="plan-title" className="text-[9.5px] tracking-[0.16em] text-fg/50">
              Nome da ficha
            </Label>
            <input
              id="plan-title"
              value={title}
              maxLength={PLAN_LIMITS.titleMaxLength}
              placeholder="Ex: Peito e Tríceps"
              autoComplete="off"
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 w-full border-b border-white/15 bg-transparent font-display text-xl font-semibold outline-none transition-colors placeholder:text-fg/30 focus:border-lime/60"
            />
          </div>
        </div>

        <div role="radiogroup" aria-label="Dia da semana" className="flex flex-col gap-1">
          <Label className="px-1 text-[9.5px] tracking-[0.16em] text-fg/50">Dia da semana</Label>
          <div className="grid grid-cols-[1.6fr_repeat(7,minmax(0,1fr))] gap-1">
            {[null, ...WEEKDAYS.keys()].map((day) => {
              const selected = day === weekday;
              return (
                <button
                  key={day ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={day === null ? "Sem dia fixo" : WEEKDAYS[day].name}
                  onClick={() => setWeekday(day)}
                  className="flex h-12 items-center"
                >
                  <span
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-[10px] border font-mono text-xs font-semibold transition-colors duration-200",
                      selected ? "border-lime/60 bg-lime/14 text-lime" : "border-white/8 bg-white/4 text-fg/65",
                    )}
                  >
                    {day === null ? "Sem dia" : WEEKDAYS[day].initial}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <span className="px-1 font-mono text-[11.5px] font-medium text-fg/55">
          {plural(items.length, "exercício", "exercícios")} · {plural(totalSets, "série", "séries")} · ~
          {estimatePlanMinutes(totalSets)} min
        </span>

        {items.length === 0 ? (
          <p className="p-5 text-center text-sm leading-normal text-fg/55">
            Ficha vazia. Adicione o primeiro exercício.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li
                key={item.key}
                className="flex animate-item-in flex-col gap-3 rounded-[20px] border border-white/8 bg-white/[0.035] py-3 pr-3 pl-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-lime">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                    <span className="text-[15px] leading-tight font-medium">{item.exercise.name}</span>
                    <span className="text-[11px] text-fg/45">
                      {[item.exercise.muscleGroup, item.exercise.equipment].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <div className="flex shrink-0 rounded-[14px] bg-white/4">
                    <button
                      type="button"
                      aria-label={`Mover ${item.exercise.name} para cima`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="grid h-12 w-10 place-items-center text-fg/60 transition-colors active:text-lime disabled:text-fg/15"
                    >
                      <ArrowUpIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Mover ${item.exercise.name} para baixo`}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                      className="grid h-12 w-10 place-items-center text-fg/60 transition-colors active:text-lime disabled:text-fg/15"
                    >
                      <ArrowDownIcon className="size-4" />
                    </button>
                  </div>
                  <IconButton
                    variant="quiet"
                    aria-label={`Remover ${item.exercise.name}`}
                    onClick={() => remove(item.key)}
                  >
                    <CloseIcon className="size-4" />
                  </IconButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stepper
                    label="Séries"
                    value={item.targetSets}
                    min={PLAN_LIMITS.sets.min}
                    max={PLAN_LIMITS.sets.max}
                    onChange={(targetSets) => update(item.key, { targetSets })}
                  />
                  <Stepper
                    label="Reps alvo"
                    value={item.targetReps}
                    min={PLAN_LIMITS.reps.min}
                    max={PLAN_LIMITS.reps.max}
                    onChange={(targetReps) => update(item.key, { targetReps })}
                  />
                </div>
                <input
                  value={item.notes ?? ""}
                  maxLength={PLAN_LIMITS.notesMaxLength}
                  placeholder="Observação (ex: cada perna)"
                  aria-label={`Observação de ${item.exercise.name}`}
                  autoComplete="off"
                  onChange={(event) => update(item.key, { notes: event.target.value || null })}
                  className="h-12 w-full rounded-[14px] border border-white/8 bg-white/4 px-3.5 text-base text-fg/85 outline-none transition-colors placeholder:text-fg/35 focus:border-lime/50"
                />
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex h-15 items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-lime/45 bg-lime/4 font-display text-[13px] font-semibold tracking-[0.12em] text-lime uppercase transition-transform duration-150 active:scale-[.98]"
        >
          <PlusIcon className="size-4" />
          Adicionar exercício
        </button>

        {plan && (
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 text-danger active:bg-danger/10"
          >
            Excluir ficha
          </Button>
        )}
      </div>

      <ExerciseLibrarySheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        exercises={library}
        muscleGroups={muscleGroups}
        selectedIds={selectedIds}
        onToggle={toggleFromLibrary}
      />

      {plan && (
        <Sheet
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title={`Excluir ${plan.title}?`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-fg/65">
              A ficha {plan.code} e os exercícios dela serão apagados. Os treinos que você já fez
              continuam no histórico.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="danger" loading={deleting} onClick={confirmDelete}>
                Excluir ficha
              </Button>
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {toast}
    </>
  );
}
