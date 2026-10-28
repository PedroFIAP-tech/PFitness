// Fila das séries do treino. Concluir, pular e desfazer entram aqui e vão ao
// banco em ordem; sem conexão ficam guardadas no aparelho e saem quando ela voltar.
// As funções do banco são idempotentes por (sessão, exercício, nº da série),
// então reenviar não duplica nada.

import { useSyncExternalStore } from "react";
import { readJSON, storageKeys, writeJSON } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/client";
import { setKey, type SetOp } from "@/lib/workout-model";

type QueuedOp = SetOp & { id: string };

export type SetSyncResult = { op: SetOp; isPr: boolean };
export type SetSyncFailure = { op: SetOp; message: string };

const RETRY_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 15_000;

let inFlightId: string | null = null;
let flushing: Promise<boolean> | null = null;
const queueListeners = new Set<() => void>();
const resultListeners = new Set<(result: SetSyncResult) => void>();
const failureListeners = new Set<(failure: SetSyncFailure) => void>();

function readQueue(): QueuedOp[] {
  return readJSON<QueuedOp[]>(storageKeys.syncQueue) ?? [];
}

function writeQueue(queue: QueuedOp[]) {
  writeJSON(storageKeys.syncQueue, queue);
  for (const listener of queueListeners) listener();
}

export function getPendingSetOps(): SetOp[] {
  return readQueue();
}

/**
 * Coloca a operação na fila e tenta enviar. Uma operação mais nova para a mesma
 * série substitui a que ainda não saiu (só o estado final importa).
 */
export function enqueueSetOp(op: SetOp) {
  const key = setKey(op.exerciseId, op.setNumber);
  const queue = readQueue().filter(
    (queued) =>
      queued.id === inFlightId ||
      queued.sessionId !== op.sessionId ||
      setKey(queued.exerciseId, queued.setNumber) !== key,
  );
  queue.push({ ...op, id: crypto.randomUUID() });
  writeQueue(queue);
  void flushSetQueue();
}

/** Remove da fila tudo de um treino (ex.: treino descartado). */
export function dropSessionOps(sessionId: number) {
  writeQueue(readQueue().filter((op) => op.sessionId !== sessionId || op.id === inFlightId));
}

/** Envia a fila em ordem. Resolve true quando ela esvazia, false se parou por falta de rede. */
export function flushSetQueue(): Promise<boolean> {
  flushing ??= runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<boolean> {
  for (;;) {
    const [op] = readQueue();
    if (!op) return true;
    if (!navigator.onLine) return false;

    inFlightId = op.id;
    const outcome = await send(op).finally(() => {
      inFlightId = null;
    });
    if (outcome === "retry") return false;
    writeQueue(readQueue().filter((queued) => queued.id !== op.id));
  }
}

async function send(op: QueuedOp): Promise<"done" | "retry"> {
  const supabase = createClient();
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  if (op.kind === "log") {
    const { data, error, status } = await supabase
      .rpc("log_set", {
        p_session_id: op.sessionId,
        p_exercise_id: op.exerciseId,
        p_set_number: op.setNumber,
        p_weight_kg: op.weightKg,
        p_reps: op.reps,
        p_status: op.status,
      })
      .abortSignal(signal)
      .single();
    if (error) return handleError(op, error.message, status);
    for (const listener of resultListeners) listener({ op, isPr: data.is_pr });
    return "done";
  }

  const { error, status } = await supabase
    .rpc("undo_set", {
      p_session_id: op.sessionId,
      p_exercise_id: op.exerciseId,
      p_set_number: op.setNumber,
    })
    .abortSignal(signal);
  if (error) return handleError(op, error.message, status);
  return "done";
}

function handleError(op: QueuedOp, message: string, status: number): "done" | "retry" {
  // Sem rede (status 0), token vencendo ou servidor instável: tenta de novo depois
  if (status === 0 || status === 401 || status >= 500) return "retry";
  // O banco recusou (ex.: treino já finalizado em outro aparelho): descarta e avisa
  for (const listener of failureListeners) listener({ op, message });
  return "done";
}

export function onSetSynced(listener: (result: SetSyncResult) => void) {
  resultListeners.add(listener);
  return () => void resultListeners.delete(listener);
}

export function onSetSyncFailed(listener: (failure: SetSyncFailure) => void) {
  failureListeners.add(listener);
  return () => void failureListeners.delete(listener);
}

function subscribeQueue(listener: () => void) {
  queueListeners.add(listener);
  return () => void queueListeners.delete(listener);
}

/** Quantas operações ainda não chegaram ao banco. */
export function usePendingSetOps() {
  return useSyncExternalStore(subscribeQueue, () => readQueue().length, () => 0);
}

/**
 * Retentativas em segundo plano: ao voltar a conexão, ao voltar para o app e a
 * cada 15 s enquanto houver fila. Retorna a função de limpeza.
 */
export function startSetSync() {
  const retry = () => {
    if (readQueue().length) void flushSetQueue();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") retry();
  };
  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(retry, RETRY_INTERVAL_MS);
  retry();
  return () => {
    window.removeEventListener("online", retry);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
  };
}
