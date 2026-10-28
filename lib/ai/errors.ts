/** Falhas da IA que viram mensagens para o usuário. */
export type AiErrorCode =
  | "not_configured"
  | "model_unavailable"
  | "invalid_response"
  | "rate_limited"
  | "unavailable";

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiError";
  }
}
