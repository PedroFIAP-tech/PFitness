// Deixa o Node (node --test, scripts) importar os módulos do app como o Next:
// "@/lib/x" vira <raiz>/lib/x.ts e imports sem extensão ganham .ts/.tsx.
// Uso: node --import ./scripts/test-loader.mjs ...
import { existsSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

if (!globalThis.__pfitnessLoader) {
  globalThis.__pfitnessLoader = true;
  register(import.meta.url, { data: { root: fileURLToPath(new URL("..", import.meta.url)) } });
}

let root = "";

export function initialize(data) {
  root = data.root;
}

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const isAlias = specifier.startsWith("@/");
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (root && (isAlias || (isRelative && context.parentURL?.startsWith("file:")))) {
    const base = isAlias ? root + specifier.slice(2) : fileURLToPath(new URL(specifier, context.parentURL));
    for (const extension of EXTENSIONS) {
      const candidate = base + extension;
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        try {
          return await nextResolve(pathToFileURL(candidate).href, context);
        } catch {
          // diretório ou arquivo sem extensão: tenta a próxima
        }
      }
    }
  }
  return nextResolve(specifier, context);
}
