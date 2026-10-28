import { z } from "zod";

// Formato que a IA devolve ao ler um treino em texto. Os nomes dos campos
// ficam em português porque o modelo os vê no JSON Schema.

export const MUSCLE_GROUPS = ["Peito", "Costas", "Pernas", "Ombros", "Bíceps", "Tríceps", "Abdômen"] as const;
export const EQUIPMENT = ["Barra", "Barra W", "Halter", "Máquina", "Polia", "Peso corporal"] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * Schema enviado ao modelo (structured outputs, modo strict). Sem limites
 * numéricos aqui: valores fora da faixa são ajustados depois, em vez de
 * derrubar a leitura inteira.
 */
export const ParsedWorkoutSchema = z.object({
  fichas: z.array(
    z.object({
      titulo: z.string(),
      dia_semana: z.number().int().nullable(),
      exercicios: z.array(
        z.object({
          nome_original: z.string(),
          nome_sugerido: z.string(),
          grupo_muscular: z.enum(MUSCLE_GROUPS),
          equipamento: z.enum(EQUIPMENT).nullable(),
          series: z.number().int(),
          reps: z.number().int(),
          observacao: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export type ParsedWorkout = z.infer<typeof ParsedWorkoutSchema>;

/** Exercício da biblioteca mostrado ao modelo como vocabulário. */
export type LibraryHint = { name: string; equipment: string | null };

export function workoutImportInstructions(library: LibraryHint[]): string {
  const vocabulary = library.map((item) => `- ${item.name} — ${item.equipment ?? "sem equipamento"}`).join("\n");

  return `Você converte textos de treino de musculação (colados do WhatsApp, enviados por personal trainers etc.) em fichas estruturadas. Responda só com o JSON pedido.

FICHAS
- Cada dia ou treino do texto vira uma ficha. Em "Segunda – Costas", titulo = "Costas" (só o foco, sem o dia) e dia_semana = 1.
- titulo sem símbolos soltos nem parênteses: "Perna (/posterior)" → "Perna posterior". Se o texto não der um foco, use os grupos dos exercícios (ex.: "Peito e Tríceps").
- dia_semana: domingo 0, segunda 1, terça 2, quarta 3, quinta 4, sexta 5, sábado 6. Sem dia no texto (ex.: "Treino A"), use null.
- Subtítulos dentro de um mesmo dia (ex.: "Bíceps", "Tríceps", "Ombro") NÃO viram fichas: só indicam o grupo_muscular dos exercícios abaixo deles.
- Ignore links, emojis, separadores e linhas sem exercício. Uma seção que só tem um link não gera exercício.

EXERCÍCIOS
- nome_original: o nome como está no texto, sem séries, repetições ou observações.
- series e reps: "3x12" → series 3, reps 12. Faixa "3x8-12" → reps 12 e observacao "8–12 reps". "Até a falha" → reps 12 e observacao "até a falha". Sem séries no texto → 3; sem repetições → 12.
- observacao: indicações extras como "cada perna", "(deitado no banco de frente)", "drop set", cadência ou pegada. Escreva sem parênteses, começando em minúscula. Sem indicação → null.
- equipamento: Barra, Barra W, Halter, Máquina, Polia ou Peso corporal. Use o que o texto disser ("halter" → Halter; "máquina", "guiado", "smith", "cadeira", "mesa", "leg press" → Máquina; "polia", "cabo", "corda", "cross" → Polia). Se o texto não disser, infira pelo jeito mais comum de fazer o exercício na academia (puxada e remada baixa → Polia; elevação lateral → Halter). Se não der para saber, null.
- grupo_muscular: Peito, Costas, Pernas, Ombros, Bíceps, Tríceps ou Abdômen. Glúteos, panturrilha, adutores e abdutores → Pernas.
- nome_sugerido: nome padronizado em português, com a primeira letra maiúscula.
  - Se for o mesmo exercício de um item da BIBLIOTECA (mesmo movimento E mesmo equipamento), use exatamente o nome da biblioteca.
  - Se o movimento existe na biblioteca mas com outro equipamento, NÃO use o nome da biblioteca: inclua o equipamento no nome (ex.: texto "Stiff halter", biblioteca "Stiff — Barra" → "Stiff com halteres").

BIBLIOTECA (nome — equipamento)
${vocabulary}`;
}
