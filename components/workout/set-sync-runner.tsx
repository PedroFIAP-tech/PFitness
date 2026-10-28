"use client";

import { useEffect } from "react";
import { startSetSync } from "@/lib/workout-sync";

/** Envia a fila de séries pendentes em qualquer tela do app (não só na do treino). */
export function SetSyncRunner() {
  useEffect(() => startSetSync(), []);
  return null;
}
