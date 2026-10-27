import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, menos estáticos, service worker, ícones e manifest
    "/((?!_next/static|_next/image|sw.js|icons/|icon.svg|apple-icon.png|manifest.webmanifest).*)",
  ],
};
