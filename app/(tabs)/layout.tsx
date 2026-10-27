import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";

// A sessão é garantida pelo proxy.ts. O layout fica estático e as partes que
// leem o usuário vivem dentro de <Suspense> em cada página (Cache Components).
export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
