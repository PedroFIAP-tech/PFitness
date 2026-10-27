import { cn } from "@/lib/cn";

/** Selo "P" do PFitness (painel lateral do protótipo). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-14 place-items-center rounded-[17px] bg-lime font-display text-[30px] font-bold text-on-lime shadow-glow-lg",
        className,
      )}
    >
      P
    </span>
  );
}
