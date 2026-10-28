// Configuração da IA por variáveis de ambiente (só no servidor).

/** Leituras por usuário por dia: AI_DAILY_LIMIT (padrão 10; claim_ai_usage aceita 1 a 100). */
export const DEFAULT_AI_DAILY_LIMIT = 10;

export function getAiDailyLimit(): number {
  const value = Number(process.env.AI_DAILY_LIMIT?.trim());
  return Number.isInteger(value) && value >= 1 && value <= 100 ? value : DEFAULT_AI_DAILY_LIMIT;
}

/** "openai" (padrão) ou "mock" (respostas gravadas, para testes: não chama nenhuma API). */
export function getAiProviderName(): string {
  return process.env.AI_PROVIDER?.trim() || "openai";
}

/** Há o necessário para chamar a IA? (o mock não precisa de chave) */
export function isAiConfigured(): boolean {
  const provider = getAiProviderName();
  if (provider === "mock") return true;
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  return false;
}
