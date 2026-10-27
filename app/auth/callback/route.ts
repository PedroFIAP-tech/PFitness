import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino do link de confirmação de email. Aceita os dois formatos do Supabase:
 * `?code=` (PKCE, template padrão) e `?token_hash=&type=` (template customizado).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: null };

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?erro=link", origin));
  }

  await ensureProfile(supabase, data.user);
  return NextResponse.redirect(new URL("/hoje", origin));
}
