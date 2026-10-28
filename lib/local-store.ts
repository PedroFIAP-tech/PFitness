// localStorage tolerante a falhas (modo privado, cota cheia): nunca derruba a tela.

export const storageKeys = {
  syncQueue: "pfitness:sync-queue",
  workoutDraft: (sessionId: number) => `pfitness:workout:${sessionId}`,
  rest: (sessionId: number) => `pfitness:rest:${sessionId}`,
};

export function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem espaço ou bloqueado: o treino segue, só não sobrevive a fechar o app
  }
}

export function removeItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // idem
  }
}

/** Apaga rascunho e descanso de um treino (ao finalizar ou descartar). */
export function clearWorkoutStorage(sessionId: number) {
  removeItem(storageKeys.workoutDraft(sessionId));
  removeItem(storageKeys.rest(sessionId));
}
