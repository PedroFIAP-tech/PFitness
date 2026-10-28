import type { Equipment, ParsedWorkout } from "@/lib/ai/workout-schema";
import { normalizeForSearch } from "@/lib/format";
import { PLAN_LIMITS } from "@/lib/workout-rules";
import type { LibraryExercise } from "@/lib/workouts";

// Importar treino por texto: casa o que a IA leu com a biblioteca e define o
// rascunho revisado na tela. Funções puras, usadas no servidor e no cliente.

/** Limite do texto colado (caracteres). */
export const IMPORT_TEXT_MAX_LENGTH = 8000;
export const NEW_EXERCISE_NAME_MAX_LENGTH = 60;

/**
 * found: mesmo exercício e equipamento da biblioteca.
 * similar: a IA associou a um da biblioteca, mas o texto diz outra coisa (confirmar).
 * new: não existe com esse equipamento; vira exercício do usuário.
 */
export type ImportStatus = "found" | "similar" | "new";

export type NewExerciseDraft = { name: string; muscleGroup: string; equipment: string | null };

export type ImportExercise = {
  key: string;
  /** Como estava no texto */
  originalName: string;
  sets: number;
  reps: number;
  notes: string | null;
  status: ImportStatus;
  /** Exercício da biblioteca (found/similar, ou escolhido em "Trocar") */
  exercise: LibraryExercise | null;
  /** Dados para criar o exercício se ficar como novo */
  newExercise: NewExerciseDraft;
  /** "similar" só entra no salvamento depois de confirmado */
  confirmed: boolean;
};

export type ImportPlan = {
  key: string;
  title: string;
  /** 0 = domingo … 6 = sábado */
  weekday: number | null;
  exercises: ImportExercise[];
};

const STOPWORDS = new Set(["com", "c", "na", "no", "nas", "nos", "de", "do", "da", "em", "e", "a", "o"]);
const EQUIPMENT_WORDS = new Set(["barra", "w", "halter", "halteres", "maquina", "polia", "cabo", "peso", "corporal"]);

/** Sufixo do nome de um exercício novo que colide com um da biblioteca de outro equipamento. */
const EQUIPMENT_SUFFIX: Record<Equipment, string> = {
  Barra: "com barra",
  "Barra W": "com barra W",
  Halter: "com halteres",
  Máquina: "na máquina",
  Polia: "na polia",
  "Peso corporal": "com peso corporal",
};

/** Palavras que identificam o movimento: sem acento, conectivos e equipamento. */
export function exerciseTokens(name: string): string[] {
  return normalizeForSearch(name)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word) && !EQUIPMENT_WORDS.has(word));
}

const nameKey = (name: string) => exerciseTokens(name).join(" ");

/**
 * Mesmo nome, ignorando equipamento e conectivos. Também vale quando um
 * contém o outro e o menor tem pelo menos 2 palavras ("Leg press" e
 * "Leg press 45°"), mas não "Rosca" e "Rosca direta".
 */
function sameName(a: string, b: string) {
  const [short, long] = [exerciseTokens(a), exerciseTokens(b)].sort((x, y) => x.length - y.length);
  if (short.length === 0) return false;
  if (short.join(" ") === long.join(" ")) return true;
  return short.length >= 2 && short.every((word) => long.includes(word));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));
const trimTo = (text: string, max: number) => text.trim().replace(/\s+/g, " ").slice(0, max).trim();

/** Primeira letra maiúscula, como os nomes da biblioteca. */
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

/** Casa a leitura da IA com a biblioteca (globais + do usuário). */
export function matchImport(parsed: ParsedWorkout, library: LibraryExercise[]): ImportPlan[] {
  const byKey = new Map<string, LibraryExercise[]>();
  for (const exercise of library) {
    const key = nameKey(exercise.name);
    byKey.set(key, [...(byKey.get(key) ?? []), exercise]);
  }

  return parsed.fichas
    .map((plan): ImportPlan => ({
      key: crypto.randomUUID(),
      title: trimTo(plan.titulo, PLAN_LIMITS.titleMaxLength),
      weekday: plan.dia_semana !== null && plan.dia_semana >= 0 && plan.dia_semana <= 6 ? plan.dia_semana : null,
      exercises: plan.exercicios
        .filter((item) => item.nome_sugerido.trim() || item.nome_original.trim())
        .slice(0, PLAN_LIMITS.maxExercises)
        .map((item) => {
          const suggested = trimTo(item.nome_sugerido || item.nome_original, NEW_EXERCISE_NAME_MAX_LENGTH);
          const original = trimTo(item.nome_original || item.nome_sugerido, 120);
          const equipment = item.equipamento;
          const base = {
            key: crypto.randomUUID(),
            originalName: original,
            sets: clamp(item.series, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max),
            reps: clamp(item.reps, PLAN_LIMITS.reps.min, PLAN_LIMITS.reps.max),
            notes: item.observacao ? trimTo(item.observacao, PLAN_LIMITS.notesMaxLength) || null : null,
          };

          const candidates = byKey.get(nameKey(suggested)) ?? byKey.get(nameKey(original)) ?? [];
          const sameEquipment = candidates.find((candidate) => (candidate.equipment ?? null) === equipment);

          if (sameEquipment) {
            const found = sameName(original, sameEquipment.name);
            return {
              ...base,
              status: found ? "found" : "similar",
              exercise: sameEquipment,
              newExercise: { name: capitalize(suggested), muscleGroup: item.grupo_muscular, equipment },
              confirmed: found,
            } satisfies ImportExercise;
          }

          // Equipamento desconhecido: o da biblioteca é só uma sugestão
          if (equipment === null && candidates.length > 0) {
            return {
              ...base,
              status: "similar",
              exercise: candidates[0],
              newExercise: { name: capitalize(suggested), muscleGroup: item.grupo_muscular, equipment },
              confirmed: false,
            } satisfies ImportExercise;
          }

          // Novo. Se o nome é o de um exercício da biblioteca com outro equipamento, o nome ganha o equipamento.
          const collides = candidates.length > 0 || byKey.has(nameKey(suggested));
          const name =
            collides && equipment && !normalizeForSearch(suggested).includes(normalizeForSearch(EQUIPMENT_SUFFIX[equipment]))
              ? `${suggested} ${EQUIPMENT_SUFFIX[equipment]}`
              : suggested;
          return {
            ...base,
            status: "new",
            exercise: null,
            newExercise: {
              name: capitalize(trimTo(name, NEW_EXERCISE_NAME_MAX_LENGTH)),
              muscleGroup: item.grupo_muscular,
              equipment,
            },
            confirmed: true,
          } satisfies ImportExercise;
        }),
    }))
    .filter((plan) => plan.exercises.length > 0)
    .slice(0, 26);
}

/** Letras que as fichas importadas vão receber (mesma regra de save_workout_plan). */
export function previewCodes(count: number, activeCodes: string[], replace: boolean): (string | null)[] {
  const used = new Set(replace ? [] : activeCodes);
  const free = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter((code) => !used.has(code));
  return Array.from({ length: count }, (_, index) => free[index] ?? null);
}
