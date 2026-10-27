"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; notice?: string } | undefined;

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Preencha email e senha." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };

  await ensureProfile(supabase, data.user);
  redirect("/hoje");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !password) return { error: "Preencha nome, email e senha." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });
  if (error) return { error: authErrorMessage(error) };

  // Com "Confirm email" ligado no Supabase, a sessão só nasce depois do link
  if (!data.session || !data.user) {
    return { notice: `Enviamos um link de confirmação para ${email}. Abra o email para ativar a conta.` };
  }

  await ensureProfile(supabase, data.user);
  redirect("/hoje");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu email antes de entrar. O link está na sua caixa de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com esse email.";
    case "weak_password":
      return "Senha fraca. Use uma senha mais longa.";
    case "email_address_invalid":
      return "Email inválido.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas. Espere um pouco e tente de novo.";
    case "signup_disabled":
      return "Cadastro desativado no momento.";
    case "email_provider_disabled":
      return "Login com email está desativado no momento.";
    default:
      return "Algo deu errado. Tente de novo.";
  }
}
