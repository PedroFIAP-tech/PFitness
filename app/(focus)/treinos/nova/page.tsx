import type { Metadata } from "next";
import { Suspense } from "react";
import { getExerciseLibrary, getNextPlanCode } from "@/lib/workouts";
import { EditorSkeleton } from "../editor-skeleton";
import { PlanEditor } from "../plan-editor";

export const metadata: Metadata = { title: "Nova ficha" };

export default function NovaFichaPage() {
  return (
    <Suspense fallback={<EditorSkeleton label="Nova ficha" />}>
      <NewPlanEditor />
    </Suspense>
  );
}

async function NewPlanEditor() {
  const [code, library] = await Promise.all([getNextPlanCode(), getExerciseLibrary()]);
  return (
    <PlanEditor
      plan={null}
      // Sem letra livre (26 fichas) o salvar devolve o aviso de limite
      code={code ?? "?"}
      library={library.exercises}
      muscleGroups={library.muscleGroups}
    />
  );
}
