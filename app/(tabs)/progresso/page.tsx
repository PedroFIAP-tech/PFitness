import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen, ScreenHeader } from "@/components/app-shell/screen";
import { getCurrentProfile } from "@/lib/auth";
import { GOAL_LABELS } from "@/lib/profile";

export const metadata: Metadata = { title: "Progresso" };

export default function ProgressoPage() {
  return (
    <Screen>
      <ScreenHeader
        eyebrow={
          <Suspense fallback={"Objetivo"}>
            <GoalLabel />
          </Suspense>
        }
        title="Progresso"
      />
    </Screen>
  );
}

async function GoalLabel() {
  const profile = await getCurrentProfile();
  return `Objetivo · ${GOAL_LABELS[profile.goal]}`;
}
