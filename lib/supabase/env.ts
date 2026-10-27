// Acesso literal a process.env para o Next inlinar as variáveis NEXT_PUBLIC_ no bundle do browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (veja .env.example).",
  );
}

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;
