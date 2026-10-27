import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/app-shell/screen";

export const metadata: Metadata = { title: "Treinos" };

export default function TreinosPage() {
  return (
    <Screen>
      <ScreenHeader eyebrow="Fichas de treino" title="Treinos" />
    </Screen>
  );
}
