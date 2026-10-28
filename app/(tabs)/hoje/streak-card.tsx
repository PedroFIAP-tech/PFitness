import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/cn";
import type { StreakDay } from "@/lib/home";

const ACTIVITY_LABEL = { workout: "treino concluído", food: "alimentação registrada", none: "sem atividade" };

/** Sequência atual, recorde e os últimos 7 dias. */
export function StreakCard({ current, record, week }: { current: number; record: number; week: StreakDay[] }) {
  return (
    <Card className="flex flex-col gap-3.5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-17.5 -left-10 size-55 bg-[radial-gradient(closest-side,oklch(0.8_0.17_55/0.2),transparent)]"
      />
      <div className="relative flex items-center gap-3.5">
        <Flame dim={current === 0} />
        <div className="flex flex-1 flex-col gap-1.25">
          <div className="flex items-baseline gap-2">
            <CountUp
              value={current}
              durationMs={900}
              className="font-mono text-[40px] leading-none font-semibold tracking-[-0.03em] text-amber [text-shadow:0_0_18px_oklch(0.8_0.17_60/0.5)]"
            />
            <span className="font-mono text-label leading-none font-medium tracking-label text-fg/60 uppercase">
              {current === 1 ? "dia seguido" : "dias seguidos"}
            </span>
          </div>
          <span className="text-[13px] text-fg/60">
            {current === 0 && record === 0
              ? "Um treino ou uma refeição hoje já conta"
              : `Treino ou dieta todo dia · recorde ${record}`}
          </span>
        </div>
      </div>

      <ol aria-label="Últimos 7 dias" className="relative grid grid-cols-7 gap-1.5">
        {week.map((day) => {
          const pending = day.isToday && day.activity === "none";
          return (
            <li
              key={day.day}
              aria-label={`${day.isToday ? "Hoje" : `Dia ${day.dayOfMonth}`}: ${pending ? "pendente" : ACTIVITY_LABEL[day.activity]}`}
              className="flex flex-col items-center gap-1.75"
            >
              <span
                className={cn(
                  "font-mono text-[10px] leading-none font-medium tracking-[0.08em]",
                  day.isToday ? "text-lime" : "text-fg/45",
                )}
              >
                {day.label}
              </span>
              <span
                className={cn(
                  "grid h-8 w-full place-items-center rounded-[9px] border font-mono text-xs font-semibold",
                  day.activity === "workout" && "border-lime bg-lime text-on-lime shadow-[0_0_14px_oklch(0.9_0.2_128/0.4)]",
                  day.activity === "food" && "border-lime/30 bg-lime/7 text-lime/85",
                  pending &&
                    "animate-glow-pulse border-lime/85 text-lime shadow-[inset_0_0_12px_oklch(0.9_0.2_128/0.3)]",
                  day.activity === "none" && !pending && "border-white/8 text-fg/35",
                )}
              >
                {day.dayOfMonth}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Chama do protótipo: base brilhando, chama externa e núcleo claro. */
function Flame({ dim }: { dim: boolean }) {
  return (
    <div aria-hidden className={cn("relative h-14 w-12 shrink-0", dim && "opacity-35 grayscale")}>
      <span className="absolute bottom-0 left-1 h-3.5 w-10 animate-glow-pulse rounded-[50%] bg-[radial-gradient(closest-side,rgb(255_150_40/0.55),transparent)]" />
      <span className="absolute top-3 left-1.75 size-8.5 origin-[50%_60%] animate-flame rounded-[50%_0_50%_50%] bg-[linear-gradient(45deg,#FFD66B,#FF9A2E_55%,#FF5A1F)] shadow-[0_0_26px_rgb(255_140_40/0.65)]" />
      <span className="absolute top-7 left-4 size-4 origin-[50%_60%] animate-flame rounded-[50%_0_50%_50%] bg-[#FFF2C2] [animation-direction:reverse] [animation-duration:1.1s]" />
    </div>
  );
}
