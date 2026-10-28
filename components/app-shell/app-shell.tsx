import type { ReactNode } from "react";
import { TabBar } from "./tab-bar";

/** Moldura das abas: conteúdo com safe-area e tab bar flutuante. */
export function AppShell({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <>
      {/* A base reserva espaço para a tab bar (66px + respiro) */}
      <main className="mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+126px)]">
        {children}
        {/* Elementos flutuantes acima da tab bar (ex.: pílula do treino em andamento) */}
        {overlay}
      </main>
      <TabBar />
    </>
  );
}
