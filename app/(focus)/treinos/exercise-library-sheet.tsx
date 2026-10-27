"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/chip";
import { CheckIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { normalizeForSearch } from "@/lib/format";
import type { LibraryExercise } from "@/lib/workouts";

const ALL_GROUPS = "Todos";

type ExerciseLibrarySheetProps = {
  open: boolean;
  onClose: () => void;
  exercises: LibraryExercise[];
  muscleGroups: string[];
  selectedIds: ReadonlySet<number>;
  onToggle: (exercise: LibraryExercise) => void;
};

export function ExerciseLibrarySheet({ open, ...props }: ExerciseLibrarySheetProps) {
  // Montado só enquanto aberto: busca e filtro recomeçam a cada abertura, como no protótipo
  return open ? <LibrarySheetContent {...props} /> : null;
}

function LibrarySheetContent({
  onClose,
  exercises,
  muscleGroups,
  selectedIds,
  onToggle,
}: Omit<ExerciseLibrarySheetProps, "open">) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(ALL_GROUPS);

  const searchable = useMemo(
    () => exercises.map((exercise) => ({ exercise, key: normalizeForSearch(exercise.name) })),
    [exercises],
  );
  const term = normalizeForSearch(query);
  const visible = searchable.filter(
    ({ exercise, key }) =>
      (group === ALL_GROUPS || exercise.muscleGroup === group) && (!term || key.includes(term)),
  );

  return (
    <Sheet
      open
      size="tall"
      title="Exercícios"
      onClose={onClose}
      action={
        <button type="button" onClick={onClose} className="h-12 px-1 text-sm font-medium text-lime">
          Concluído
        </button>
      }
      header={
        <>
          <label className="flex h-12 items-center gap-2.5 rounded-[15px] border border-white/9 bg-white/5 px-3.5 focus-within:border-lime/50">
            <SearchIcon className="size-4.5 shrink-0 text-fg/50" />
            <input
              type="search"
              enterKeyHint="search"
              aria-label="Buscar exercício"
              placeholder="Buscar exercício"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg/40"
            />
          </label>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
            {[ALL_GROUPS, ...muscleGroups].map((name) => (
              <Chip key={name} active={name === group} onClick={() => setGroup(name)}>
                {name}
              </Chip>
            ))}
          </div>
        </>
      }
    >
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/50">Nenhum exercício encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map(({ exercise }) => {
            const added = selectedIds.has(exercise.id);
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  aria-pressed={added}
                  onClick={() => onToggle(exercise)}
                  className={cn(
                    "flex min-h-14.5 w-full items-center gap-3 rounded-2xl border py-2 pr-3 pl-3.5 text-left transition-[background-color,border-color,transform] duration-250 active:scale-[.98]",
                    added ? "border-lime/40 bg-lime/6" : "border-white/7 bg-white/[0.025]",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                    <span className="text-[15px] font-medium">{exercise.name}</span>
                    <span className="text-[11.5px] text-fg/50">
                      {[exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {added ? (
                    <span className="grid size-9 shrink-0 animate-pop place-items-center rounded-full bg-lime text-on-lime shadow-[0_0_14px_oklch(0.9_0.2_128/0.6)]">
                      <CheckIcon className="size-4" />
                    </span>
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-lime/45 text-lime">
                      <PlusIcon className="size-4" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
