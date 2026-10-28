import type { Metadata } from "next";
import { Suspense } from "react";
import { FocusHeader } from "@/components/app-shell/focus-header";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IMPORT_DAILY_LIMIT } from "@/lib/workout-import";
import { getActiveSession } from "@/lib/workout-session";
import { getExerciseLibrary } from "@/lib/workouts";
import { ImportScreen } from "./import-screen";

export const metadata: Metadata = { title: "Importar treino" };

export default function ImportarPage() {
  return (
    <Suspense fallback={<ImportSkeleton />}>
      <ImportLoader />
    </Suspense>
  );
}

async function ImportLoader() {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const [library, activeSession, plansResult, usageResult] = await Promise.all([
    getExerciseLibrary(),
    getActiveSession(),
    supabase.from("workout_plans").select("code").eq("user_id", user.id).eq("archived", false),
    supabase.rpc("ai_usage_today", { p_kind: "workout_import" }),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (usageResult.error) throw usageResult.error;

  return (
    <ImportScreen
      library={library.exercises}
      muscleGroups={library.muscleGroups}
      activeCodes={plansResult.data.map((plan) => plan.code)}
      hasActiveSession={activeSession !== null}
      remainingToday={Math.max(0, IMPORT_DAILY_LIMIT - usageResult.data)}
    />
  );
}

function ImportSkeleton() {
  return (
    <>
      <FocusHeader backHref="/treinos" label="Importar treino" />
      <div aria-hidden className="flex flex-col gap-3 px-3.5 pt-1.5">
        <div className="h-[50dvh] rounded-card border border-white/8 bg-white/[0.035]" />
        <div className="h-15 rounded-button bg-lime/20" />
      </div>
    </>
  );
}
