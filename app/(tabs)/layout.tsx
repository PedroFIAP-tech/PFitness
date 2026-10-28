import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { ActiveWorkoutPill } from "@/components/workout/active-workout-pill";
import { getActiveSession } from "@/lib/workout-session";

// A sessão é garantida pelo proxy.ts. O layout fica estático e as partes que
// leem o usuário vivem dentro de <Suspense> (Cache Components).
export default function TabsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppShell
      overlay={
        <Suspense fallback={null}>
          <ActiveWorkoutPillLoader />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function ActiveWorkoutPillLoader() {
  const session = await getActiveSession();
  return session ? <ActiveWorkoutPill session={session} /> : null;
}
