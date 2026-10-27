import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "./env";

const PUBLIC_PATHS = ["/login", "/auth", "/~offline"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Renova o token de sessão a cada requisição e protege as rotas do app:
 * sem sessão → /login; com sessão em /login → /hoje.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Cabeçalhos anti-cache que o Supabase exige quando grava cookies de sessão
  let sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        sessionHeaders = { ...sessionHeaders, ...headers };
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Nada entre createServerClient e getClaims: é essa chamada que renova o token.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return redirectWithSession(request, "/login", response, sessionHeaders);
  }
  if (isAuthenticated && pathname === "/login") {
    return redirectWithSession(request, "/hoje", response, sessionHeaders);
  }
  return response;
}

function redirectWithSession(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
  sessionHeaders: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const [key, value] of Object.entries(sessionHeaders)) {
    redirect.headers.set(key, value);
  }
  return redirect;
}
