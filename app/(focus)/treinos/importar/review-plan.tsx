"use client";

import { IconButton } from "@/components/ui/icon-button";
import { CloseIcon } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/cn";
import { NEW_EXERCISE_NAME_MAX_LENGTH, type ImportExercise, type ImportPlan } from "@/lib/workout-import";
import { PLAN_LIMITS, WEEKDAYS } from "@/lib/workout-rules";

type ReviewPlanProps = {
  plan: ImportPlan;
  /** Letra prevista (null se não houver letra livre) */
  code: string | null;
  onChange: (patch: Partial<Pick<ImportPlan, "title" | "weekday">>) => void;
  onRemove: () => void;
  onExerciseChange: (exerciseKey: string, patch: Partial<ImportExercise>) => void;
  onExerciseRemove: (exerciseKey: string) => void;
  onSwap: (exerciseKey: string) => void;
};

/** Uma ficha lida pela IA: título, dia e exercícios para revisar. */
export function ReviewPlan({ plan, code, onChange, onRemove, onExerciseChange, onExerciseRemove, onSwap }: ReviewPlanProps) {
  const titleId = `title-${plan.key}`;
  return (
    <section aria-labelledby={titleId} className="flex animate-item-in flex-col gap-3 rounded-card border border-lime/20 bg-white/[0.025] p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-13 shrink-0 place-items-center rounded-2xl border border-lime/50 bg-lime/10 font-display text-2xl font-bold text-lime">
          {code ?? "?"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor={titleId} className="text-[9.5px] tracking-[0.16em] text-fg/50">
            Nome da ficha
          </Label>
          <input
            id={titleId}
            value={plan.title}
            maxLength={PLAN_LIMITS.titleMaxLength}
            autoComplete="off"
            placeholder={code ? `Treino ${code}` : "Treino"}
            onChange={(event) => onChange({ title: event.target.value })}
            className="h-9 w-full border-b border-white/15 bg-transparent font-display text-lg font-semibold outline-none transition-colors placeholder:text-fg/30 focus:border-lime/60"
          />
        </div>
        <IconButton variant="quiet" aria-label={`Remover ficha ${plan.title}`} onClick={onRemove}>
          <CloseIcon className="size-4" />
        </IconButton>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-black/25 pl-3.5">
        <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-fg/55 uppercase">Dia da semana</span>
        <select
          value={plan.weekday ?? ""}
          onChange={(event) => onChange({ weekday: event.target.value === "" ? null : Number(event.target.value) })}
          className="h-12 bg-transparent pr-3.5 text-right text-[15px] font-medium text-fg outline-none"
        >
          <option value="">Sem dia fixo</option>
          {WEEKDAYS.map((day, index) => (
            <option key={day.name} value={index}>
              {day.name}
            </option>
          ))}
        </select>
      </label>

      <ol className="flex flex-col gap-2">
        {plan.exercises.map((item) => (
          <ReviewExercise
            key={item.key}
            item={item}
            onChange={(patch) => onExerciseChange(item.key, patch)}
            onRemove={() => onExerciseRemove(item.key)}
            onSwap={() => onSwap(item.key)}
          />
        ))}
      </ol>
    </section>
  );
}

type ReviewExerciseProps = {
  item: ImportExercise;
  onChange: (patch: Partial<ImportExercise>) => void;
  onRemove: () => void;
  onSwap: () => void;
};

function ReviewExercise({ item, onChange, onRemove, onSwap }: ReviewExerciseProps) {
  const isNew = item.status === "new";
  const needsConfirm = !item.confirmed;
  const shown = isNew ? item.newExercise : item.exercise;
  const meta = isNew
    ? [item.newExercise.muscleGroup, item.newExercise.equipment]
    : [item.exercise?.muscleGroup, item.exercise?.equipment];

  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 rounded-[18px] border bg-white/[0.03] p-3",
        needsConfirm ? "border-lime/45" : isNew ? "border-amber/30" : "border-white/8",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isNew ? (
              <input
                value={item.newExercise.name}
                maxLength={NEW_EXERCISE_NAME_MAX_LENGTH}
                aria-label="Nome do exercício novo"
                onChange={(event) => onChange({ newExercise: { ...item.newExercise, name: event.target.value } })}
                className="h-8 min-w-0 flex-1 border-b border-white/15 bg-transparent text-[15px] font-medium outline-none focus:border-lime/60"
              />
            ) : (
              <span className="text-[15px] leading-tight font-medium">{shown?.name}</span>
            )}
            {isNew && <Badge tone="amber">Novo</Badge>}
            {needsConfirm && <Badge tone="lime">Confirmar</Badge>}
          </div>
          <span className="text-[11px] text-fg/45">{meta.filter(Boolean).join(" · ")}</span>
          {item.originalName && item.originalName !== shown?.name && (
            <span className="font-mono text-[10.5px] text-fg/40">texto: {item.originalName}</span>
          )}
        </div>
        <IconButton variant="quiet" aria-label={`Remover ${shown?.name ?? "exercício"}`} onClick={onRemove}>
          <CloseIcon className="size-4" />
        </IconButton>
      </div>

      {needsConfirm && (
        <div className="grid grid-cols-3 gap-1.5">
          <SmallButton accent onClick={() => onChange({ confirmed: true })}>
            Confirmar
          </SmallButton>
          <SmallButton onClick={onSwap}>Trocar</SmallButton>
          <SmallButton
            onClick={() =>
              onChange({
                status: "new",
                confirmed: true,
                // O nome sugerido era o da biblioteca: o novo leva o nome do texto
                newExercise: { ...item.newExercise, name: capitalize(item.originalName).slice(0, NEW_EXERCISE_NAME_MAX_LENGTH) },
              })
            }
          >
            Criar novo
          </SmallButton>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Séries"
          value={item.sets}
          min={PLAN_LIMITS.sets.min}
          max={PLAN_LIMITS.sets.max}
          onChange={(sets) => onChange({ sets })}
        />
        <Stepper
          label="Reps"
          value={item.reps}
          min={PLAN_LIMITS.reps.min}
          max={PLAN_LIMITS.reps.max}
          onChange={(reps) => onChange({ reps })}
        />
      </div>

      <input
        value={item.notes ?? ""}
        maxLength={PLAN_LIMITS.notesMaxLength}
        placeholder="Observação (ex: cada perna)"
        aria-label={`Observação de ${shown?.name ?? "exercício"}`}
        autoComplete="off"
        onChange={(event) => onChange({ notes: event.target.value || null })}
        className="h-12 w-full rounded-[14px] border border-white/8 bg-white/4 px-3.5 text-base text-fg/85 outline-none transition-colors placeholder:text-fg/35 focus:border-lime/50"
      />

      {!needsConfirm && (
        <button type="button" onClick={onSwap} className="-my-1 self-start py-2 text-xs font-medium text-lime">
          Trocar por outro da biblioteca
        </button>
      )}
    </li>
  );
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

function Badge({ tone, children }: { tone: "amber" | "lime"; children: string }) {
  return (
    <span
      className={cn(
        "flex h-5 shrink-0 items-center rounded-md border px-1.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] uppercase",
        tone === "amber" ? "border-amber/45 bg-amber/10 text-amber" : "border-lime/50 bg-lime/10 text-lime",
      )}
    >
      {children}
    </span>
  );
}

function SmallButton({ accent = false, onClick, children }: { accent?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 rounded-xl border text-[13px] font-semibold transition-transform duration-150 active:scale-95",
        accent ? "border-lime/55 bg-lime/14 text-lime" : "border-white/10 bg-white/5 text-fg/80",
      )}
    >
      {children}
    </button>
  );
}
