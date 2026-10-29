import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 * Lê cookies, então em páginas precisa ficar dentro de um <Suspense>.
 * Crie um por requisição; não reaproveite entre requisições.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // O supabase-js lê a sessão (e confere a expiração com Date.now()) antes de
  // cada consulta. Com partialPrefetching, os cookies já resolvem no prerender
  // de runtime, onde Date.now() não é aceito: connection() espera a requisição.
  await connection();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies; o proxy já renova a sessão.
        }
      },
    },
  });
}
