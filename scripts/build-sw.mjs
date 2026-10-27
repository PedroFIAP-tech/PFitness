// Gera public/sw.js depois do `next build`, que é quando .next/static existe para o precache.
//
// Usa a função do @serwist/turbopack fora de uma Route Handler: a rota oficial
// exporta `dynamic`/`dynamicParams`/`revalidate`, que quebram o build com Cache
// Components, e se fosse cacheada com 'use cache' a Vercel tentaria recompilar o
// worker em runtime (sem o app/sw.ts disponível).
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createSerwistRoute } from "@serwist/turbopack";

// Versiona a página offline precacheada pelo commit do deploy
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  randomUUID();

const { generateStaticParams, GET } = createSerwistRoute({
  swSrc: "app/sw.ts",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  // public/** entra no precache; o worker de um build anterior não pode entrar junto
  globIgnores: ["**/node_modules/**/*", "public/sw.js", "public/sw.js.map"],
  useNativeEsbuild: true,
});

for (const { path: file } of await generateStaticParams()) {
  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ path: file }),
  });
  await writeFile(path.join("public", file), await response.text());
  console.log(`✓ public/${file}`);
}
