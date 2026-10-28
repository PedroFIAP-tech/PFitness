import { PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatMacros, type DiaryItem, type MealGroup, type MealType } from "@/lib/diet-model";
import { formatNumber } from "@/lib/format";

type MealCardProps = {
  group: MealGroup;
  /** Dia aberto para mudanças (hoje ou ontem) */
  editable: boolean;
  /** Sem conexão: adicionar fica desligado */
  disabled: boolean;
  onAdd: (meal: MealType) => void;
  onEdit: (item: DiaryItem) => void;
};

/** Uma refeição do dia: totais, itens e "+ Adicionar alimento". */
export function MealCard({ group, editable, disabled, onAdd, onEdit }: MealCardProps) {
  return (
    <section
      aria-label={group.name}
      className="overflow-hidden rounded-card border border-line bg-[linear-gradient(180deg,rgb(255_255_255/0.045),rgb(255_255_255/0.015))]"
    >
      <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-2.5">
        <div className="flex flex-1 flex-col gap-1.25">
          <span className="flex items-baseline gap-2">
            <h2 className="font-display text-[17px] font-semibold">{group.name}</h2>
            <span className="font-mono text-[11px] font-medium text-fg/45">
              {group.time ?? (group.plannedTime ? `~${group.plannedTime}` : "—")}
            </span>
          </span>
          <span className="font-mono text-[11px] font-medium text-fg/50">{formatMacros(group.totals)}</span>
          {group.goal && <MealGoalLine goal={group.goal} totals={group.totals} />}
        </div>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-semibold tracking-[-0.03em] tabular-nums">
            {formatNumber(group.totals.kcal)}
          </span>
          <span className="font-mono text-[11px] font-medium text-fg/50">kcal</span>
        </span>
      </div>

      {group.items.length === 0 ? (
        <p className="px-3.5 pt-1 pb-2.5 text-[13px] text-fg/50">Nada registrado ainda.</p>
      ) : (
        <ul>
          {group.items.map((item) => (
            <li key={item.id} className="border-t border-white/5">
              <MealItem item={item} editable={editable} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(group.meal)}
          className="flex h-12.5 w-full items-center justify-center gap-2 border-t border-white/6 font-display text-[12.5px] font-semibold tracking-[0.12em] text-lime uppercase transition-colors duration-150 active:bg-lime/8 disabled:text-fg/35"
        >
          <PlusIcon className="size-3.5" strokeWidth={2.4} />
          Adicionar alimento
        </button>
      )}
    </section>
  );
}

/** "meta 690 kcal · faltam 32 g de proteína" ou "proteína ok". */
function MealGoalLine({ goal, totals }: { goal: MealGroup["totals"]; totals: MealGroup["totals"] }) {
  const missingProtein = Math.round(goal.protein - totals.protein);
  return (
    <span className="font-mono text-[11px] font-medium text-fg/45">
      meta {formatNumber(goal.kcal)} kcal ·{" "}
      {missingProtein > 0 ? (
        <span className="text-lime/80">faltam {missingProtein} g de proteína</span>
      ) : (
        <span className="text-lime">proteína ok ✓</span>
      )}
    </span>
  );
}

function MealItem({ item, editable, onEdit }: { item: DiaryItem; editable: boolean; onEdit: (item: DiaryItem) => void }) {
  // Id negativo: ainda salvando (atualização otimista)
  const saving = item.id < 0;
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="truncate text-sm font-medium">{item.name}</span>
        <span className="font-mono text-[11px] text-fg/45">{formatMacros(item.nutrients)}</span>
      </span>
      <span className="font-mono text-xs font-medium text-fg/60">{formatNumber(item.grams, 1)} g</span>
      <span className="w-12 text-right font-mono text-[13px] font-semibold tabular-nums">
        {formatNumber(item.nutrients.kcal)}
      </span>
    </>
  );
  const className = cn(
    "flex min-h-12.5 w-full items-center gap-2.5 px-3.5 py-1.5 text-left",
    saving && "animate-pulse opacity-60",
  );

  if (!editable) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => onEdit(item)}
      aria-label={`Editar ${item.name}, ${formatNumber(item.grams, 1)} g`}
      className={cn(className, "transition-colors duration-150 active:bg-white/5")}
    >
      {content}
    </button>
  );
}
