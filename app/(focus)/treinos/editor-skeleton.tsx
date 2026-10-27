import { FocusHeader } from "@/components/app-shell/focus-header";

/** Fallback do editor enquanto ficha e biblioteca carregam. */
export function EditorSkeleton({ label }: { label: string }) {
  return (
    <>
      <FocusHeader backHref="/treinos" label={label} />
      <div aria-hidden className="flex flex-col gap-3 px-3.5 pt-1.5">
        <div className="h-21.5 rounded-card border border-lime/25 bg-white/[0.035]" />
        <span className="h-3 w-48 rounded-sm bg-white/6" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-31 rounded-[20px] border border-white/8 bg-white/[0.035]" />
        ))}
      </div>
    </>
  );
}
