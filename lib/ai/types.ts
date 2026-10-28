import type { z } from "zod";

export type StructuredRequest<T> = {
  instructions: string;
  input: string;
  schema: z.ZodType<T>;
  /** Nome do schema visto pelo modelo */
  schemaName: string;
};

/** Um provedor de IA que devolve JSON no formato de um schema zod. */
export type StructuredProvider = {
  model: string;
  /** Devolve o JSON da resposta; quem chama valida com o schema. */
  generate<T>(request: StructuredRequest<T>): Promise<unknown>;
};
