import "server-only";
import OpenAI, { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AiError } from "./errors";
import type { StructuredRequest, StructuredProvider } from "./types";

/** Modelo padrão: o mais barato da OpenAI com structured outputs (out/2026). */
export const OPENAI_DEFAULT_MODEL = "gpt-6-luna";

/**
 * Raciocínio desligado: extrair texto não precisa "pensar", e a leitura cai de
 * ~20 s para ~7 s com o mesmo resultado (medido com um treino de 5 dias).
 * "off" omite o parâmetro, para modelos sem raciocínio.
 */
export const OPENAI_DEFAULT_REASONING_EFFORT = "none";

type ReasoningEffort = "none" | "low" | "medium" | "high";

const TIMEOUT_MS = 60_000;

export function createOpenAIProvider(
  apiKey: string,
  model = OPENAI_DEFAULT_MODEL,
  reasoningEffort: string = OPENAI_DEFAULT_REASONING_EFFORT,
): StructuredProvider {
  const client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });

  return {
    model,
    async generate<T>({ instructions, input, schema, schemaName }: StructuredRequest<T>): Promise<unknown> {
      try {
        const response = await client.responses.parse({
          model,
          instructions,
          input,
          text: { format: zodTextFormat(schema, schemaName) },
          ...(reasoningEffort !== "off" && { reasoning: { effort: reasoningEffort as ReasoningEffort } }),
        });
        if (response.output_parsed == null) {
          throw new AiError("invalid_response", "Resposta sem JSON (recusa ou texto livre)");
        }
        return response.output_parsed;
      } catch (error) {
        throw toAiError(error, model);
      }
    },
  };
}

function toAiError(error: unknown, model: string): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof APIError) {
    // 404/403 com a chave válida: a conta não tem acesso ao modelo
    if (error.status === 404 || error.status === 403 || error.code === "model_not_found") {
      return new AiError("model_unavailable", `Sem acesso ao modelo ${model}`, { cause: error });
    }
    if (error.status === 401) return new AiError("not_configured", "Chave da OpenAI inválida", { cause: error });
    // Ex.: AI_REASONING_EFFORT com um valor que o modelo não aceita
    if (error.status === 400 && error.param?.startsWith("reasoning")) {
      return new AiError("not_configured", `Parâmetro de raciocínio inválido para ${model}`, { cause: error });
    }
    if (error.status === 429) return new AiError("rate_limited", "Limite da OpenAI atingido", { cause: error });
  }
  // JSON que não bate com o schema cai aqui (erro de parse do helper)
  if (error instanceof SyntaxError || (error instanceof Error && /parse|schema|zod/i.test(error.message))) {
    return new AiError("invalid_response", "Resposta fora do formato", { cause: error });
  }
  return new AiError("unavailable", "Falha ao chamar a OpenAI", { cause: error });
}
