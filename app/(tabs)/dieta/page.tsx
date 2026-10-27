import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Screen, ScreenHeader } from "@/components/app-shell/screen";
import { formatDayLabel } from "@/lib/date";

export const metadata: Metadata = { title: "Alimentação" };

export default function DietaPage() {
  return (
    <Screen>
      <ScreenHeader
        eyebrow={
          <Suspense fallback={" "}>
            <TodayLabel />
          </Suspense>
        }
        title="Alimentação"
      />
    </Screen>
  );
}

async function TodayLabel() {
  // A data é do momento da requisição, não do build
  await connection();
  return formatDayLabel();
}
