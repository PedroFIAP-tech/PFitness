// Modelo do treino em andamento: tipos e regras puras, usados no servidor e no cliente.

export type SetStatus = "todo" | "concluida" | "pulada";

export type WorkoutExercise = {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  weightIncrement: number;
  restSeconds: number;
  targetSets: number;
  targetReps: number;
  /** Observação da ficha ("cada perna"), exibida abaixo do nome */
  notes: string | null;
  /** Séries da última sessão concluída (v_exercise_last), em ordem */
  lastSets: { setNumber: number; weightKg: number; reps: number }[];
  /** Melhor carga em treinos anteriores a este (null sem histórico) */
  historicBestKg: number | null;
};

export type LoggedSet = {
  exerciseId: number;
  setNumber: number;
  weightKg: number;
  reps: number;
  status: "concluida" | "pulada";
  isPr: boolean;
};

export type WorkoutSessionData = {
  sessionId: number;
  planId: number;
  planCode: string;
  title: string;
  startedAt: string;
  exercises: WorkoutExercise[];
  loggedSets: LoggedSet[];
};

export type SetState = {
  setNumber: number;
  status: SetStatus;
  weightKg: number;
  reps: number;
  isPr: boolean;
  /** Série equivalente da última sessão */
  last: { weightKg: number; reps: number } | null;
};

export type ExerciseState = WorkoutExercise & { sets: SetState[] };

/** Operação de série esperando para ir ao banco (fila offline). */
export type SetOp =
  | {
      kind: "log";
      sessionId: number;
      exerciseId: number;
      setNumber: number;
      weightKg: number;
      reps: number;
      status: "concluida" | "pulada";
      /** PR previsto no aparelho; o banco confirma ao sincronizar */
      predictedPr: boolean;
    }
  | { kind: "undo"; sessionId: number; exerciseId: number; setNumber: number };

/** Estado local do treino, salvo no aparelho para retomar depois. */
export type WorkoutDraft = {
  exerciseIndex: number;
  selectedSetNumber: number | null;
  /** kg e reps de cada série, por setKey */
  values: Record<string, [weightKg: number, reps: number]>;
  /** Resumo para a pílula do treino nas abas */
  progress: { done: number; total: number; exerciseName: string };
};

export type RestTimer = {
  /** Horário de término (ms). Guardar o fim, e não um contador, sobrevive à tela bloqueada. */
  endAt: number;
  totalSeconds: number;
  minimized: boolean;
};

export function setKey(exerciseId: number, setNumber: number) {
  return `${exerciseId}:${setNumber}`;
}

/**
 * Estado inicial da tela: o que está no banco, por cima as operações ainda na
 * fila (mais novas) e, para as séries a fazer, os valores ajustados no aparelho.
 * Sem nada disso, a série vem da última sessão (ou 0 kg e as reps alvo).
 */
export function buildExercises(
  data: WorkoutSessionData,
  draft: WorkoutDraft | null,
  pendingOps: SetOp[],
): ExerciseState[] {
  const logged = new Map(data.loggedSets.map((set) => [setKey(set.exerciseId, set.setNumber), set]));
  const queued = new Map(
    pendingOps
      .filter((op) => op.sessionId === data.sessionId)
      .map((op) => [setKey(op.exerciseId, op.setNumber), op]),
  );

  return data.exercises.map((exercise) => {
    const recordedNumbers = [...data.loggedSets, ...pendingOps]
      .filter((set) => set.exerciseId === exercise.exerciseId)
      .map((set) => set.setNumber);
    const count = Math.max(exercise.targetSets, ...recordedNumbers, 1);

    const sets = Array.from({ length: count }, (_, index): SetState => {
      const setNumber = index + 1;
      const key = setKey(exercise.exerciseId, setNumber);
      const saved = logged.get(key);
      const op = queued.get(key);
      const draftValues = draft?.values[key];
      const last =
        exercise.lastSets.find((item) => item.setNumber === setNumber) ?? exercise.lastSets.at(-1) ?? null;

      const state: SetState = {
        setNumber,
        status: saved?.status ?? "todo",
        weightKg: saved?.weightKg ?? draftValues?.[0] ?? last?.weightKg ?? 0,
        reps: saved?.reps ?? draftValues?.[1] ?? last?.reps ?? exercise.targetReps,
        isPr: saved?.isPr ?? false,
        last: last && { weightKg: last.weightKg, reps: last.reps },
      };
      if (op?.kind === "log") {
        Object.assign(state, { status: op.status, weightKg: op.weightKg, reps: op.reps, isPr: op.predictedPr });
      } else if (op?.kind === "undo") {
        Object.assign(state, { status: "todo", isPr: false });
      }
      return state;
    });

    return { ...exercise, sets };
  });
}

/**
 * Melhor carga que uma série precisa superar para ser PR: histórico + séries já
 * concluídas neste treino. Sem histórico não há PR (mesma regra de log_set no banco).
 */
export function currentBest(exercise: ExerciseState, exceptSetNumber?: number): number | null {
  if (!exercise.historicBestKg) return null;
  return exercise.sets.reduce(
    (best, set) =>
      set.status === "concluida" && set.reps > 0 && set.setNumber !== exceptSetNumber
        ? Math.max(best, set.weightKg)
        : best,
    exercise.historicBestKg,
  );
}

export function predictPr(exercise: ExerciseState, set: SetState) {
  const previousBest = currentBest(exercise, set.setNumber);
  return {
    isPr: set.reps > 0 && previousBest !== null && set.weightKg > previousBest,
    previousBest,
  };
}

/** Série ativa: a escolhida (se ainda estiver a fazer) ou a primeira a fazer. -1 se acabou. */
export function activeSetIndex(exercise: ExerciseState, selectedSetNumber: number | null) {
  if (selectedSetNumber !== null) {
    const selected = exercise.sets.findIndex(
      (set) => set.setNumber === selectedSetNumber && set.status === "todo",
    );
    if (selected >= 0) return selected;
  }
  return exercise.sets.findIndex((set) => set.status === "todo");
}

export function workoutTotals(exercises: ExerciseState[]) {
  let done = 0;
  let total = 0;
  let volumeKg = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      total += 1;
      if (set.status === "concluida") {
        done += 1;
        volumeKg += set.weightKg * set.reps;
      }
    }
  }
  return { done, total, volumeKg };
}

/** Próxima série a fazer a partir de um exercício (para o "A seguir" do descanso). */
export function nextTodoSet(exercises: ExerciseState[], fromIndex: number) {
  for (let index = fromIndex; index < exercises.length; index++) {
    const set = exercises[index].sets.find((item) => item.status === "todo");
    if (set) return { exercise: exercises[index], set };
  }
  return null;
}

export function hasTodoSets(exercises: ExerciseState[]) {
  return exercises.some((exercise) => exercise.sets.some((set) => set.status === "todo"));
}
