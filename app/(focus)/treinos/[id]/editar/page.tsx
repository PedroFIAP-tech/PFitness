import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getExerciseLibrary, getPlan, parsePlanId } from "@/lib/workouts";
import { EditorSkeleton } from "../../editor-skeleton";
import { PlanEditor } from "../../plan-editor";

export const metadata: Metadata = { title: "Editar ficha" };

export default function EditarFichaPage({ params }: PageProps<"/treinos/[id]/editar">) {
  return (
    <Suspense fallback={<EditorSkeleton label="Editar ficha" />}>
      <EditPlanEditor params={params} />
    </Suspense>
  );
}

async function EditPlanEditor({ params }: Pick<PageProps<"/treinos/[id]/editar">, "params">) {
  const planId = parsePlanId((await params).id);
  if (planId === null) notFound();

  const [plan, library] = await Promise.all([getPlan(planId), getExerciseLibrary()]);
  if (!plan) notFound();

  return (
    <PlanEditor
      plan={plan}
      code={plan.code}
      library={library.exercises}
      muscleGroups={library.muscleGroups}
    />
  );
}
