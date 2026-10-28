import { AiError } from "./errors";
import { WORKOUT_IMPORT_FIXTURE } from "./fixtures/workout-import-example";
import type { StructuredProvider } from "./types";

/** Resposta gravada de cada schema (gerada com `npm run ai:record-fixture`). */
const FIXTURES: Record<string, unknown> = {
  fichas_de_treino: WORKOUT_IMPORT_FIXTURE.output,
};

/**
 * Provedor de testes (AI_PROVIDER=mock): devolve a resposta real gravada, sem
 * chamar nenhuma API. Marcadores no texto simulam falhas:
 * "[mock:invalid]" → resposta fora do formato, "[mock:unavailable]" → serviço fora,
 * "[mock:empty]" → nenhuma ficha.
 */
export function createMockProvider(delayMs = 800): StructuredProvider {
  return {
    model: "mock",
    async generate({ input, schemaName }) {
      // Atraso curto para a tela de carregamento aparecer nos testes de interface
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (input.includes("[mock:invalid]")) throw new AiError("invalid_response", "mock: resposta inválida");
      if (input.includes("[mock:unavailable]")) throw new AiError("unavailable", "mock: serviço fora");
      if (input.includes("[mock:empty]")) return { fichas: [] };
      if (!(schemaName in FIXTURES)) throw new AiError("not_configured", `mock: sem fixture para ${schemaName}`);
      // Cópia: quem chama não altera a fixture
      return structuredClone(FIXTURES[schemaName]);
    },
  };
}
