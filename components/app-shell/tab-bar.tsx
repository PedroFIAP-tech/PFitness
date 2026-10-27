"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { DietIcon, ProfileIcon, ProgressIcon, TodayIcon, WorkoutIcon } from "./tab-icons";

const TABS = [
  { href: "/hoje", label: "Hoje", Icon: TodayIcon },
  { href: "/treinos", label: "Treinos", Icon: WorkoutIcon },
  { href: "/dieta", label: "Dieta", Icon: DietIcon },
  { href: "/progresso", label: "Progresso", Icon: ProgressIcon },
  { href: "/perfil", label: "Perfil", Icon: ProfileIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-15 mx-auto max-w-md bg-linear-to-b from-bg/0 to-bg/92 to-40% px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+4px)]"
    >
      <div className="relative grid h-16.5 grid-cols-5 rounded-hero border border-white/9 bg-[rgb(15_18_21/0.78)] shadow-tab-bar backdrop-blur-[22px] backdrop-saturate-140">
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-px flex w-1/5 justify-center transition-[left] duration-450 ease-snap"
            style={{ left: `${activeIndex * 20}%` }}
          >
            <span className="h-0.5 w-7.5 rounded-full bg-lime shadow-indicator" />
          </span>
        )}

        {TABS.map(({ href, label, Icon }, index) => {
          const active = index === activeIndex;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1.25 text-[10.5px] leading-none font-medium",
                "transition-[color,transform] duration-250 active:scale-90",
                active ? "text-lime" : "text-fg/50",
              )}
            >
              <Icon className={cn("size-5.5", active && "drop-shadow-glow")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
