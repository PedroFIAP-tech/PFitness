import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Usuário da sessão atual, a partir das claims verificadas do JWT.
 * Sem sessão, redireciona para /login. Lê cookies: use dentro de <Suspense>.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect("/login");

  const { sub, email, user_metadata } = data.claims;
  return { id: sub, email, user_metadata };
});

/** Perfil do usuário logado; cria perfil e metas padrão se ainda não existirem. */
export const getCurrentProfile = cache(async () => {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  return ensureProfile(supabase, user);
});
