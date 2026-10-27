"use client";

import { useSearchParams } from "next/navigation";
import { FormMessage } from "./form-message";

/** Aviso quando o link de confirmação de email é inválido ou expirou (/login?erro=link). */
export function LinkErrorNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("erro") !== "link") return null;

  return (
    <FormMessage tone="error">
      Link inválido ou expirado. Entre com email e senha ou crie a conta de novo.
    </FormMessage>
  );
}
