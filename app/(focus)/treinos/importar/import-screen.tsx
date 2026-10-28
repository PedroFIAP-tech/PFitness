"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState, useTransition } from "react";
import { FocusHeader } from "@/components/app-shell/focus-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/format";
import { previewCodes, type ImportExercise, type ImportPlan } from "@/lib/workout-import";
import type { LibraryExercise } from "@/lib/workouts";
import { ExerciseLibrarySheet } from "../exercise-library-sheet";
import { importPlans, readWorkoutText } from "./actions";
import { PasteStep } from "./paste-step";
import { ReviewPlan } from "./review-plan";

type ImportScreenProps = {
  library: LibraryExercise[];
  muscleGroups: string[];
  /** Letras das fichas ativas (para prever as das importadas) */
  activeCodes: string[];
  /** Treino em andamento bloqueia "Substituir" */
  hasActiveSession: boolean;
  remainingToday: number;
};

type SaveMode = "add" | "replace";

const SAVE_MODES = [
  { value: "add", label: "Adicionar" },
  { value: "replace", label: "Substituir" },
] as const;

export function ImportScreen(props: ImportScreenProps) {
  // Como no editor: navegar por link recomeça; voltar/avançar mantém o rascunho
  const { bfcacheId } = useRouter();
  return <ImportFlow key={bfcacheId} {...props} />;
}

function ImportFlow({ library, muscleGroups, activeCodes, hasActiveSession, remainingToday }: ImportScreenProps) {
  const [text, setText] = useState("");
  const [plans, setPlans] = useState<ImportPlan[] | null>(null);
  const [remaining, setRemaining] = useState(remainingToday);
  const [readError, setReadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [mode, setMode] = useState<SaveMode>("add");
  const [swapping, setSwapping] = useState<{ planKey: string; exerciseKey: string } | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [toast, showToast] = useToast();

  // Sheets são transitórios: fecham quando a rota fica oculta
  useLayoutEffect(
    () => () => {
      setSwapping(null);
      setConfirmingReplace(false);
    },
    [],
  );

  const read = () =>
    startReading(async () => {
      setReadError(null);
      const result = await readWorkoutText(text);
      if (result.remaining !== undefined) setRemaining(result.remaining);
      if ("error" in result) {
        setReadError({ message: result.error, retry: result.retry });
        return;
      }
      setPlans(result.plans);
      setMode("add");
      window.scrollTo({ top: 0 });
    });

  const updatePlan = (planKey: string, update: (plan: ImportPlan) => ImportPlan | null) =>
    setPlans((current) =>
      current?.flatMap((plan) => {
        if (plan.key !== planKey) return [plan];
        const next = update(plan);
        return next && next.exercises.length > 0 ? [next] : [];
      }) ?? null,
    );

  const updateExercise = (planKey: string, exerciseKey: string, patch: Partial<ImportExercise>) =>
    updatePlan(planKey, (plan) => ({
      ...plan,
      exercises: plan.exercises.map((item) => (item.key === exerciseKey ? { ...item, ...patch } : item)),
    }));

  const removeExercise = (planKey: string, exerciseKey: string) => {
    const plan = plans?.find((candidate) => candidate.key === planKey);
    if (plan?.exercises.length === 1) showToast(`Ficha ${plan.title || "sem nome"} removida`);
    updatePlan(planKey, (current) => ({
      ...current,
      exercises: current.exercises.filter((item) => item.key !== exerciseKey),
    }));
  };

  const stats = useMemo(() => {
    const all = plans?.flatMap((plan) => plan.exercises) ?? [];
    return {
      exercises: all.length,
      toConfirm: all.filter((item) => !item.confirmed).length,
      created: all.filter((item) => item.status === "new").length,
    };
  }, [plans]);

  if (!plans) {
    return (
      <>
        <FocusHeader backHref="/treinos" label="Importar treino" />
        <PasteStep
          text={text}
          onText={setText}
          reading={reading}
          remaining={remaining}
          error={readError}
          onRead={read}
        />
        {toast}
      </>
    );
  }

  const codes = previewCodes(plans.length, activeCodes, mode === "replace");
  const missingCodes = codes.some((code) => code === null);
  const canSave = plans.length > 0 && stats.toConfirm === 0 && !missingCodes;

  const save = () =>
    startSaving(async () => {
      setConfirmingReplace(false);
      const result = await importPlans(
        plans.map((plan) => ({
          title: plan.title,
          weekday: plan.weekday,
          exercises: plan.exercises.map((item) => {
            const useLibrary = item.status !== "new" && item.exercise !== null;
            return {
              exerciseId: useLibrary ? item.exercise!.id : null,
              newExercise: useLibrary ? null : item.newExercise,
              sets: item.sets,
              reps: item.reps,
              notes: item.notes,
            };
          }),
        })),
        mode === "replace",
      );
      if (result?.error) showToast(result.error, "error");
    });

  const swapTarget = swapping
    ? plans.find((plan) => plan.key === swapping.planKey)?.exercises.find((item) => item.key === swapping.exerciseKey)
    : undefined;

  return (
    <>
      <FocusHeader backHref="/treinos" label="Revisar importação" />

      <div className="flex flex-col gap-3 px-3.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="font-display text-2xl font-semibold">
            {plural(plans.length, "ficha encontrada", "fichas encontradas")}
          </h1>
          <p className="font-mono text-[11.5px] font-medium text-fg/55">
            {plural(stats.exercises, "exercício", "exercícios")}
            {stats.created > 0 && ` · ${plural(stats.created, "novo", "novos")}`}
            {stats.toConfirm > 0 && ` · ${stats.toConfirm} para confirmar`}
          </p>
        </div>

        {plans.map((plan, index) => (
          <ReviewPlan
            key={plan.key}
            plan={plan}
            code={codes[index]}
            onChange={(patch) => updatePlan(plan.key, (current) => ({ ...current, ...patch }))}
            onRemove={() => {
              updatePlan(plan.key, () => null);
              showToast(`Ficha ${plan.title || "sem nome"} removida`);
            }}
            onExerciseChange={(exerciseKey, patch) => updateExercise(plan.key, exerciseKey, patch)}
            onExerciseRemove={(exerciseKey) => removeExercise(plan.key, exerciseKey)}
            onSwap={(exerciseKey) => setSwapping({ planKey: plan.key, exerciseKey })}
          />
        ))}

        {plans.length === 0 ? (
          <p className="p-5 text-center text-sm text-fg/55">Todas as fichas foram removidas.</p>
        ) : (
          <section className="mt-1 flex flex-col gap-3 rounded-card border border-line bg-card p-4">
            {activeCodes.length > 0 && (
              <>
                <Label>Suas fichas atuais ({activeCodes.join("")})</Label>
                <Segmented
                  aria-label="Como salvar"
                  options={SAVE_MODES}
                  value={mode}
                  onChange={setMode}
                />
                <p className="text-[13px] leading-relaxed text-fg/60">
                  {mode === "add"
                    ? "As fichas importadas entram junto com as que você já tem."
                    : "As fichas atuais vão para o arquivo. O histórico de treinos continua."}
                </p>
                {mode === "replace" && hasActiveSession && (
                  <p role="alert" className="text-[13px] text-amber">
                    Finalize ou descarte o treino atual antes de substituir.
                  </p>
                )}
              </>
            )}
            {missingCodes && (
              <p role="alert" className="text-[13px] text-amber">
                Não há letras livres para todas (máximo de 26 fichas). Remova algumas ou use “Substituir”.
              </p>
            )}
            {stats.toConfirm > 0 && (
              <p className="text-[13px] text-fg/60">
                Confirme {stats.toConfirm === 1 ? "o exercício marcado" : "os exercícios marcados"} para salvar.
              </p>
            )}
            <Button
              size="lg"
              loading={saving}
              disabled={!canSave || (mode === "replace" && hasActiveSession)}
              onClick={() => (mode === "replace" ? setConfirmingReplace(true) : save())}
            >
              {mode === "replace" ? "Substituir minhas fichas" : activeCodes.length > 0 ? "Adicionar às minhas fichas" : `Salvar ${plural(plans.length, "ficha", "fichas")}`}
            </Button>
          </section>
        )}

        <Button variant="ghost" disabled={saving} onClick={() => setPlans(null)}>
          Ler outro texto
        </Button>
      </div>

      <ExerciseLibrarySheet
        open={swapTarget !== undefined}
        onClose={() => setSwapping(null)}
        exercises={library}
        muscleGroups={muscleGroups}
        selectedIds={new Set(swapTarget?.exercise && swapTarget.status !== "new" ? [swapTarget.exercise.id] : [])}
        onToggle={(exercise) => {
          if (swapping) {
            updateExercise(swapping.planKey, swapping.exerciseKey, {
              exercise,
              status: "found",
              confirmed: true,
            });
          }
          setSwapping(null);
        }}
      />

      <Sheet open={confirmingReplace} onClose={() => setConfirmingReplace(false)} title="Substituir suas fichas?">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-fg/65">
            As fichas {activeCodes.join(", ")} vão para o arquivo e as importadas entram no lugar, a partir da
            letra A. Os treinos que você já fez continuam no histórico.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="danger" loading={saving} onClick={save}>
              Substituir fichas
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => setConfirmingReplace(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Sheet>

      {toast}
    </>
  );
}
