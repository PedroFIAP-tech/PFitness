import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getWorkoutSummary } from "@/lib/workout-session";
import { parsePlanId } from "@/lib/workouts";
import { SummaryView } from "./summary-view";

export const metadata: Metadata = { title: "Resumo do treino" };

export default function ResumoPage({ params, searchParams }: PageProps<"/treino/resumo/[sessionId]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Summary params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Summary({ params, searchParams }: PageProps<"/treino/resumo/[sessionId]">) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  const id = parsePlanId(sessionId);
  if (id === null) notFound();
  const summary = await getWorkoutSummary(id);
  if (!summary) notFound();

  // ?de= traz a sequência de antes de finalizar, para animar a subida
  const before = Number(query.de);
  return (
    <SummaryView
      summary={summary}
      streakBefore={Number.isInteger(before) && before >= 0 ? before : summary.streak}
    />
  );
}
