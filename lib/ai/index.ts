import "server-only";
import { AiError } from "./errors";
import { createOpenAIProvider } from "./openai";
import type { StructuredProvider } from "./types";
import {
  ParsedWorkoutSchema,
  workoutImportInstructions,
  type LibraryHint,
  type ParsedWorkout,
} from "./workout-schema";

export { AiError, type AiErrorCode } from "./errors";

/**
 * Provedor configurado por variáveis de ambiente (só no servidor):
 * AI_PROVIDER (padrão "openai"), AI_MODEL e AI_REASONING_EFFORT (opcionais) e
 * OPENAI_API_KEY.
 */
function getProvider(): StructuredProvider {
  const provider = process.env.AI_PROVIDER?.trim() || "openai";
  const model = process.env.AI_MODEL?.trim() || undefined;

  switch (provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) throw new AiError("not_configured", "OPENAI_API_KEY ausente");
      return createOpenAIProvider(apiKey, model, process.env.AI_REASONING_EFFORT?.trim() || undefined);
    }
    default:
      throw new AiError("not_configured", `AI_PROVIDER desconhecido: ${provider}`);
  }
}

/** Lê um treino em texto livre e devolve as fichas (validadas com zod). */
export async function parseWorkoutText(text: string, library: LibraryHint[]): Promise<ParsedWorkout> {
  const provider = getProvider();
  const raw = await provider.generate({
    instructions: workoutImportInstructions(library),
    input: `TEXTO DO TREINO:\n"""\n${text}\n"""`,
    schema: ParsedWorkoutSchema,
    schemaName: "fichas_de_treino",
  });

  const parsed = ParsedWorkoutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError("invalid_response", "Resposta fora do formato", { cause: parsed.error });
  }
  return parsed.data;
}
