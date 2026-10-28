"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { HoldButton } from "@/components/ui/hold-button";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDuration, formatKg, formatNumber, formatVolume } from "@/lib/format";
import { vibrate } from "@/lib/haptics";
import { clearWorkoutStorage, readJSON, removeItem, storageKeys, writeJSON } from "@/lib/local-store";
import { useIsClient } from "@/lib/use-is-client";
import { useNow } from "@/lib/use-now";
import { useOnline } from "@/lib/use-online";
import { useWakeLock } from "@/lib/use-wake-lock";
import {
  activeSetIndex,
  buildExercises,
  currentBest,
  hasTodoSets,
  nextTodoSet,
  predictPr,
  setKey,
  workoutTotals,
  type ExerciseState,
  type RestTimer,
  type SetState,
  type WorkoutDraft,
  type WorkoutSessionData,
} from "@/lib/workout-model";
import {
  dropSessionOps,
  enqueueSetOp,
  flushSetQueue,
  getPendingSetOps,
  onSetSynced,
  onSetSyncFailed,
  usePendingSetOps,
} from "@/lib/workout-sync";
import { discardWorkout, finishWorkout } from "../actions";
import { ActiveSetCard } from "./active-set-card";
import { PrOverlay, type PrCelebration } from "./pr-overlay";
import { RestPill, RestSheet } from "./rest-timer";
import { SetRow } from "./set-row";

// Tempos do protótipo
const PR_DELAY_MS = 520;
const REST_DELAY_MS = 650;
const BURST_MS = 1100;
const EXERCISE_SWIPE = 60;
const SLIDE_SNAP = "transform .3s cubic-bezier(.2,.8,.2,1), opacity .3s";
const SLIDE_ENTER = "transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s";

export function WorkoutScreen({ data }: { data: WorkoutSessionData }) {
  // Rascunho, fila e descanso vivem no aparelho: a tela só monta no cliente
  const isClient = useIsClient();
  if (!isClient) return <WorkoutSkeleton />;
  if (data.exercises.length === 0) return <EmptyWorkout sessionId={data.sessionId} />;
  return <WorkoutSession data={data} />;
}

/** A ficha ficou sem exercícios durante o treino: só resta descartar. */
function EmptyWorkout({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  const discard = async () => {
    setBusy(true);
    const result = await discardWorkout(sessionId);
    if (result?.error) {
      setBusy(false);
      showToast(result.error, "error");
      return;
    }
    clearWorkoutStorage(sessionId);
    router.replace("/treinos");
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-fg/65">A ficha deste treino não tem mais exercícios.</p>
      <Button variant="danger" loading={busy} onClick={discard}>
        Descartar treino
      </Button>
      {toast}
    </div>
  );
}

function WorkoutSession({ data }: { data: WorkoutSessionData }) {
  const router = useRouter();
  const { sessionId } = data;
  const draftKey = storageKeys.workoutDraft(sessionId);

  const [initial] = useState(() => {
    const draft = readJSON<WorkoutDraft>(draftKey);
    const exercises = buildExercises(data, draft, getPendingSetOps());
    const firstOpen = exercises.findIndex((item) => item.sets.some((set) => set.status === "todo"));
    const index = draft?.exerciseIndex ?? Math.max(0, firstOpen);
    return {
      exercises,
      exerciseIndex: Math.min(Math.max(0, index), exercises.length - 1),
      selectedSet: draft?.selectedSetNumber ?? null,
    };
  });
  const [exercises, setExercises] = useState(initial.exercises);
  const [exerciseIndex, setExerciseIndex] = useState(initial.exerciseIndex);
  const [selectedSet, setSelectedSet] = useState<number | null>(initial.selectedSet);
  const [slide, setSlide] = useState({ offset: 0, transition: "none" });
  const [burst, setBurst] = useState<{ key: string; id: number } | null>(null);
  const [pr, setPr] = useState<(PrCelebration & { restSeconds: number | null }) | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  const now = useNow(250);
  const online = useOnline();
  const pending = usePendingSetOps();
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; lock: "x" | "y" | null } | null>(null);
  // Ao sair (finalizar/descartar) erros de séries antigas na fila não importam mais
  const leaving = useRef(false);
  useWakeLock();

  const rest = useRestTimer(sessionId, (late) => {
    if (late) return;
    showToast("Descanso concluído — bora!");
    vibrate([200, 100, 200]);
  });

  const exercise = exercises[exerciseIndex];
  const activeIndex = activeSetIndex(exercise, selectedSet);
  const activeSet = activeIndex >= 0 ? exercise.sets[activeIndex] : null;
  const totals = workoutTotals(exercises);
  const bestKg = currentBest(exercise);
  const hasNext = exerciseIndex < exercises.length - 1;

  // Salva o estado no aparelho a cada mudança: fechar o app não perde nada
  useEffect(() => {
    const done = workoutTotals(exercises);
    const draft: WorkoutDraft = {
      exerciseIndex,
      selectedSetNumber: selectedSet,
      values: Object.fromEntries(
        exercises.flatMap((item) =>
          item.sets.map((set) => [setKey(item.exerciseId, set.setNumber), [set.weightKg, set.reps]]),
        ),
      ),
      progress: { done: done.done, total: done.total, exerciseName: exercises[exerciseIndex].name },
    };
    writeJSON(draftKey, draft);
  }, [draftKey, exercises, exerciseIndex, selectedSet]);

  // O banco tem a palavra final sobre PR
  useEffect(
    () =>
      onSetSynced(({ op, isPr }) => {
        if (op.kind !== "log" || op.sessionId !== sessionId) return;
        setExercises((current) =>
          updateSet(current, op.exerciseId, op.setNumber, (set) =>
            set.status === op.status ? { ...set, isPr } : set,
          ),
        );
      }),
    [sessionId],
  );

  useEffect(
    () =>
      onSetSyncFailed(({ op }) => {
        if (op.sessionId !== sessionId || leaving.current) return;
        showToast("O servidor recusou uma série. Recarregando o treino…", "error");
        window.setTimeout(() => window.location.reload(), 1800);
      }),
    [sessionId, showToast],
  );

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const schedule = (callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay));
  };
  const clearScheduled = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const patchSet = (setNumber: number, patch: Partial<SetState>) =>
    setExercises((current) => updateSet(current, exercise.exerciseId, setNumber, (set) => ({ ...set, ...patch })));

  const complete = (setNumber: number) => {
    const target = exercise.sets.find((set) => set.setNumber === setNumber);
    if (!target || target.status === "concluida") return;

    const { isPr, previousBest } = predictPr(exercise, target);
    const next = updateSet(exercises, exercise.exerciseId, setNumber, (set) => ({
      ...set,
      status: "concluida",
      isPr,
    }));
    setExercises(next);
    setSelectedSet(null);
    enqueueSetOp({
      kind: "log",
      sessionId,
      exerciseId: exercise.exerciseId,
      setNumber,
      weightKg: target.weightKg,
      reps: target.reps,
      status: "concluida",
      predictedPr: isPr,
    });
    vibrate(15);

    clearScheduled();
    rest.stop();
    const burstId = Date.now();
    setBurst({ key: setKey(exercise.exerciseId, setNumber), id: burstId });
    schedule(() => setBurst((current) => (current?.id === burstId ? null : current)), BURST_MS);

    // Partículas → (PR) → descanso, se ainda há séries
    const restSeconds = hasTodoSets(next) ? exercise.restSeconds : null;
    if (isPr && previousBest !== null) {
      schedule(
        () =>
          setPr({
            exerciseName: exercise.name,
            weightKg: target.weightKg,
            reps: target.reps,
            previousBest,
            restSeconds,
          }),
        PR_DELAY_MS,
      );
    } else if (restSeconds) {
      schedule(() => rest.start(restSeconds), REST_DELAY_MS);
    }
  };

  const skip = (set: SetState) => {
    patchSet(set.setNumber, { status: "pulada", isPr: false });
    enqueueSetOp({
      kind: "log",
      sessionId,
      exerciseId: exercise.exerciseId,
      setNumber: set.setNumber,
      weightKg: set.weightKg,
      reps: set.reps,
      status: "pulada",
      predictedPr: false,
    });
  };

  /** Volta a série para "a fazer" (desmarcar concluída ou retomar pulada). */
  const reopen = (setNumber: number) => {
    patchSet(setNumber, { status: "todo", isPr: false });
    enqueueSetOp({ kind: "undo", sessionId, exerciseId: exercise.exerciseId, setNumber });
  };

  const closePr = () => {
    const restSeconds = pr?.restSeconds;
    setPr(null);
    if (restSeconds) schedule(() => rest.start(restSeconds), 250);
  };

  const goTo = (index: number) => {
    if (index < 0 || index >= exercises.length || index === exerciseIndex) {
      setSlide({ offset: 0, transition: SLIDE_SNAP });
      return;
    }
    const direction = index > exerciseIndex ? 1 : -1;
    setExerciseIndex(index);
    setSelectedSet(null);
    scrollRef.current?.scrollTo({ top: 0 });
    setSlide({ offset: direction * 80, transition: "none" });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setSlide({ offset: 0, transition: SLIDE_ENTER })),
    );
  };

  const onSwipeStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-nodrag]")) return;
    swipe.current = { x: event.clientX, y: event.clientY, lock: null };
  };
  const onSwipeMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = swipe.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.lock) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        current.lock = "x";
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (Math.abs(dy) > 8) {
        current.lock = "y";
      }
    }
    if (current.lock !== "x") return;
    // Resistência nas pontas
    const atEdge = (exerciseIndex === 0 && dx > 0) || (!hasNext && dx < 0);
    setSlide({ offset: atEdge ? dx * 0.3 : dx, transition: "none" });
  };
  const onSwipeEnd = () => {
    const current = swipe.current;
    swipe.current = null;
    if (current?.lock !== "x") return;
    if (slide.offset < -EXERCISE_SWIPE) goTo(exerciseIndex + 1);
    else if (slide.offset > EXERCISE_SWIPE) goTo(exerciseIndex - 1);
    else setSlide({ offset: 0, transition: SLIDE_SNAP });
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const synced = await flushSetQueue();
      if (!synced || getPendingSetOps().some((op) => op.sessionId === sessionId)) {
        showToast("Sem conexão: ainda há séries para enviar. Tente quando a internet voltar.", "error");
        return;
      }
      const result = await finishWorkout(sessionId);
      if ("error" in result) {
        showToast(result.error, "error");
        return;
      }
      leaving.current = true;
      clearWorkoutStorage(sessionId);
      router.replace(result.summaryUrl);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    leaving.current = true;
    dropSessionOps(sessionId);
    const result = await discardWorkout(sessionId);
    if (result?.error) {
      leaving.current = false;
      setBusy(false);
      showToast(result.error, "error");
      return;
    }
    clearWorkoutStorage(sessionId);
    router.replace("/treinos");
  };

  const upcoming = nextTodoSet(exercises, exerciseIndex);
  const exerciseDone = exercise.sets.filter((set) => set.status === "concluida");
  const lastFirstSet = exercise.lastSets[0];

  return (
    <div className="flex h-dvh flex-col">
      {/* Cabeçalho: minimizar, tempo/volume/séries, segmentos por exercício */}
      <header className="relative flex shrink-0 flex-col gap-2 px-3.5 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Minimizar treino"
            onClick={() => router.push("/hoje")}
            className="grid size-12 shrink-0 place-items-center rounded-[14px] border border-white/9 bg-white/4 transition-transform duration-150 active:scale-90"
          >
            <ChevronDownIcon className="size-5" />
          </button>
          <dl className="grid h-12 flex-1 grid-cols-3 rounded-[14px] border border-white/8 bg-white/[0.035]">
            <Stat label="Tempo" value={formatDuration((now - Date.parse(data.startedAt)) / 1000)} highlight />
            <Stat label="Volume kg" value={formatVolume(totals.volumeKg)} />
            <Stat label="Séries" value={`${totals.done}/${totals.total}`} />
          </dl>
        </div>

        {/* Barras de 4px dentro de alvos de toque de 48px */}
        <nav aria-label="Exercícios" className="-my-2 flex gap-1">
          {exercises.map((item, index) => {
            const current = index === exerciseIndex;
            const finished = item.sets.every((set) => set.status !== "todo");
            return (
              <button
                key={item.exerciseId}
                type="button"
                aria-label={`${index + 1}. ${item.name}`}
                aria-current={current ? "step" : undefined}
                onClick={() => goTo(index)}
                className="flex h-12 flex-1 items-center"
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-[background-color,box-shadow] duration-300",
                    current
                      ? "bg-lime shadow-[0_0_10px_oklch(0.9_0.2_128/0.8)]"
                      : finished
                        ? "bg-lime/50"
                        : "bg-white/12",
                  )}
                />
              </button>
            );
          })}
        </nav>

        {rest.timer?.minimized && (
          <RestPill rest={rest.timer} now={now} onExpand={() => rest.setMinimized(false)} />
        )}
        {!online && (
          <p role="status" className="font-mono text-[11px] text-amber">
            Sem conexão · as séries ficam salvas no aparelho
            {pending > 0 && ` (${pending} na fila)`}
          </p>
        )}
      </header>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div
          className="flex flex-col gap-3 px-3.5 pt-1 pb-5"
          style={{
            transform: `translateX(${slide.offset.toFixed(1)}px)`,
            opacity: 1 - Math.min(0.6, Math.abs(slide.offset) / 260),
            transition: slide.transition,
          }}
        >
          {/* Nome do exercício: arraste ↔ para navegar */}
          <div
            onPointerDown={onSwipeStart}
            onPointerMove={onSwipeMove}
            onPointerUp={onSwipeEnd}
            onPointerCancel={onSwipeEnd}
            className="flex cursor-grab touch-pan-y items-center gap-1 pt-1.5 pb-0.5 select-none"
          >
            <button
              type="button"
              data-nodrag
              aria-label="Exercício anterior"
              disabled={exerciseIndex === 0}
              onClick={() => goTo(exerciseIndex - 1)}
              className="grid h-16 w-10 shrink-0 place-items-center disabled:opacity-20"
            >
              <ChevronLeftIcon className="size-4.5" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <Label>
                Exercício {exerciseIndex + 1}/{exercises.length} · {exercise.muscleGroup}
              </Label>
              <h1 className="font-display text-2xl leading-[1.1] font-semibold text-balance">{exercise.name}</h1>
              {exercise.notes && <p className="-mt-0.5 text-[13px] leading-snug text-fg/60">{exercise.notes}</p>}
              <div className="flex flex-wrap justify-center gap-1.5">
                <Tag>
                  <span className="text-fg/50">ÚLTIMA</span>
                  {lastFirstSet ? `${formatKg(lastFirstSet.weightKg)} kg × ${lastFirstSet.reps}` : "—"}
                </Tag>
                <Tag tone="amber">
                  <span className="opacity-70">PR</span>
                  {bestKg !== null ? `${formatKg(bestKg)} kg` : "—"}
                </Tag>
                <Tag>
                  <span className="text-fg/70">
                    {exercise.targetSets || exercise.sets.length}×{exercise.targetReps}
                  </span>
                </Tag>
              </div>
            </div>
            <button
              type="button"
              data-nodrag
              aria-label="Próximo exercício"
              disabled={!hasNext}
              onClick={() => goTo(exerciseIndex + 1)}
              className="grid h-16 w-10 shrink-0 place-items-center disabled:opacity-20"
            >
              <ChevronRightIcon className="size-4.5" />
            </button>
          </div>

          {activeSet ? (
            <ActiveSetCard
              set={activeSet}
              totalSets={exercise.sets.length}
              weightStep={exercise.weightIncrement}
              bestKg={bestKg}
              onChange={(patch) => patchSet(activeSet.setNumber, patch)}
              onComplete={() => complete(activeSet.setNumber)}
            />
          ) : (
            <ExerciseDoneCard
              sets={exerciseDone.length}
              volumeKg={exerciseDone.reduce((sum, set) => sum + set.weightKg * set.reps, 0)}
              nextName={hasNext ? exercises[exerciseIndex + 1].name : null}
              onNext={() => goTo(exerciseIndex + 1)}
            />
          )}

          <section aria-label="Séries" className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 pt-1">
              <Label>Séries</Label>
              <span className="font-mono text-label tracking-[0.06em] text-fg/42">→ concluir · ← pular</span>
            </div>
            <ol className="flex flex-col gap-2">
              {exercise.sets.map((set, index) => (
                <SetRow
                  key={setKey(exercise.exerciseId, set.setNumber)}
                  set={set}
                  active={index === activeIndex}
                  burstId={burst?.key === setKey(exercise.exerciseId, set.setNumber) ? burst.id : null}
                  onComplete={() => complete(set.setNumber)}
                  onSkip={() => skip(set)}
                  onUndo={() => reopen(set.setNumber)}
                  onTap={() => (set.status === "pulada" ? reopen(set.setNumber) : setSelectedSet(set.setNumber))}
                />
              ))}
            </ol>
          </section>

          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmingDiscard(true)}
            className="mt-4 text-danger active:bg-danger/10"
          >
            Descartar treino
          </Button>
        </div>
      </div>

      <footer className="flex shrink-0 gap-2.5 border-t border-white/6 bg-bg/92 px-3.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        <HoldButton
          label={hasNext ? "Segure p/ finalizar" : "Segure para finalizar"}
          holdingLabel={busy ? "Finalizando…" : "Segurando…"}
          emphasized={!hasNext}
          onComplete={finish}
          className="flex-1"
        />
        {hasNext && (
          <button
            type="button"
            onClick={() => goTo(exerciseIndex + 1)}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] border border-lime/40 bg-lime/10 font-display text-[13px] font-semibold tracking-label text-lime uppercase transition-transform duration-150 active:scale-[.96]"
          >
            Próximo
            <ChevronRightIcon className="size-4.5" />
          </button>
        )}
      </footer>

      {rest.timer && !rest.timer.minimized && (
        <RestSheet
          rest={rest.timer}
          now={now}
          next={
            upcoming
              ? {
                  exercise: upcoming.exercise.name,
                  detail: `Série ${upcoming.set.setNumber} · ${formatKg(upcoming.set.weightKg)} kg × ${upcoming.set.reps}`,
                }
              : { exercise: "Treino quase no fim", detail: "Última série feita" }
          }
          onMinimize={() => rest.setMinimized(true)}
          onAdjust={rest.adjust}
          onSkip={rest.stop}
        />
      )}

      {pr && <PrOverlay pr={pr} onClose={closePr} />}

      <Sheet open={confirmingDiscard} onClose={() => setConfirmingDiscard(false)} title="Descartar treino?">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-fg/65">
            {totals.done > 0
              ? `As ${totals.done} séries registradas e os pontos deste treino serão apagados.`
              : "O treino será apagado."}{" "}
            Não dá para desfazer.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="danger" loading={busy} onClick={discard}>
              Descartar treino
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDiscard(false)}>
              Continuar treino
            </Button>
          </div>
        </div>
      </Sheet>

      {toast}
    </div>
  );
}

/** Descanso guardado como horário de término no aparelho (sobrevive a bloquear a tela). */
function useRestTimer(sessionId: number, onFinished: (late: boolean) => void) {
  const key = storageKeys.rest(sessionId);
  const [timer, setTimer] = useState<RestTimer | null>(() => readJSON<RestTimer>(key));
  const finished = useEffectEvent(onFinished);

  useEffect(() => {
    if (timer) writeJSON(key, timer);
    else removeItem(key);
  }, [key, timer]);

  useEffect(() => {
    if (!timer) return;
    const check = () => {
      const overdue = Date.now() - timer.endAt;
      if (overdue < 0) return;
      setTimer(null);
      // Acabou com o app fechado há mais de 1 min: não avisa ao voltar
      finished(overdue > 60_000);
    };
    const interval = window.setInterval(check, 250);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [timer]);

  return {
    timer,
    start: (seconds: number) =>
      setTimer({ endAt: Date.now() + seconds * 1000, totalSeconds: seconds, minimized: false }),
    adjust: (deltaSeconds: number) =>
      setTimer((current) => {
        if (!current) return current;
        const remaining = Math.max(1, (current.endAt - Date.now()) / 1000 + deltaSeconds);
        return {
          ...current,
          endAt: Date.now() + remaining * 1000,
          totalSeconds: Math.max(current.totalSeconds, Math.ceil(remaining)),
        };
      }),
    stop: () => setTimer(null),
    setMinimized: (minimized: boolean) => setTimer((current) => current && { ...current, minimized }),
  };
}

function updateSet(
  exercises: ExerciseState[],
  exerciseId: number,
  setNumber: number,
  update: (set: SetState) => SetState,
) {
  return exercises.map((item) =>
    item.exerciseId !== exerciseId
      ? item
      : { ...item, sets: item.sets.map((set) => (set.setNumber === setNumber ? update(set) : set)) },
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.25 border-white/6 not-first:border-l">
      <dt className="font-mono text-[9.5px] leading-none font-medium tracking-[0.16em] text-fg/50 uppercase">{label}</dt>
      <dd
        className={cn(
          "font-mono text-[15px] leading-none font-semibold tabular-nums",
          highlight && "text-lime [text-shadow:0_0_10px_oklch(0.9_0.2_128/0.5)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Tag({ tone = "default", children }: { tone?: "default" | "amber"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6.5 items-center gap-1.5 rounded-lg border px-2.25 font-mono text-[11.5px] font-medium",
        tone === "amber" ? "border-amber/30 bg-amber/8 text-amber" : "border-white/8 bg-white/5",
      )}
    >
      {children}
    </span>
  );
}

function ExerciseDoneCard({
  sets,
  volumeKg,
  nextName,
  onNext,
}: {
  sets: number;
  volumeKg: number;
  nextName: string | null;
  onNext: () => void;
}) {
  return (
    <section className="relative flex animate-item-in flex-col items-center gap-2.5 overflow-hidden rounded-hero border border-lime/35 bg-[radial-gradient(ellipse_at_50%_0%,oklch(0.9_0.2_128/0.14),rgb(255_255_255/0.02)_70%)] px-4.5 py-5.5 text-center">
      <span className="grid size-15 animate-[pop_0.6s_0.1s_both] place-items-center rounded-full bg-lime text-on-lime shadow-[0_0_30px_oklch(0.9_0.2_128/0.7)]">
        <CheckIcon className="size-7" />
      </span>
      <Label tone="accent" className="mt-1">
        Exercício concluído
      </Label>
      <span className="font-mono text-[13px] font-medium text-fg/70">
        {sets} séries · {formatNumber(volumeKg)} kg de volume
      </span>
      {nextName ? (
        <button
          type="button"
          onClick={onNext}
          className="mt-2 flex min-h-15 w-full items-center justify-between gap-2.5 rounded-button bg-lime px-4 py-2.5 text-left text-on-lime shadow-[0_0_36px_-8px_oklch(0.9_0.2_128/0.8)] transition-transform duration-150 active:scale-[.97]"
        >
          <span className="flex flex-col gap-1">
            <span className="font-mono text-[10px] leading-none font-semibold tracking-label opacity-65">PRÓXIMO</span>
            <span className="font-display text-base leading-[1.1] font-bold">{nextName}</span>
          </span>
          <ArrowRightIcon className="size-5.5 shrink-0" />
        </button>
      ) : (
        <span className="text-[13px] text-fg/60">Último exercício. Segure o botão abaixo para finalizar.</span>
      )}
    </section>
  );
}

function WorkoutSkeleton() {
  return (
    <div aria-hidden className="flex h-dvh flex-col gap-3 px-3.5 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="h-12 rounded-[14px] border border-white/8 bg-white/[0.035]" />
      <div className="mx-auto mt-6 h-6 w-56 rounded-md bg-white/6" />
      <div className="h-90 rounded-hero border border-lime/25 bg-white/[0.035]" />
    </div>
  );
}
