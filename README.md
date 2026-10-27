# PFitness

PWA mobile-first de treino, alimentação e gamificação.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Auth + Postgres) · Serwist (service worker).

Referências de design e banco ficam em [`docs/`](docs/): protótipo navegável (`PFitness.html`), telas em PDF e o schema (`pfitness_schema.sql`, já aplicado no Supabase).

## Rodar local

Requisitos: Node 20.9+.

```bash
npm install
cp .env.example .env.local   # preencha com URL e anon key do Supabase
npm run dev                  # http://localhost:3000
```

No `npm run dev` o service worker fica desligado. Para testar o PWA (instalação, cache offline) rode o build de produção:

```bash
npm run build && npm start
```

### Configuração do Supabase Auth

Em **Authentication → Sign In / Providers → Email**:

- **Enable Email provider**: ligado (sem isso nenhum login por email funciona).
- **Confirm email**: desligado durante o desenvolvimento e ligado em produção. Com ele ligado, o cadastro mostra "Enviamos um link de confirmação" e a conta só é ativada pelo link do email.

Em **Authentication → URL Configuration**:

- **Site URL**: a URL principal do app (em produção, o domínio da Vercel).
- **Redirect URLs**: `http://localhost:3000/auth/callback` e `https://<seu-app>.vercel.app/auth/callback`. O link de confirmação de email volta para essa rota.

### Migrations

O schema base está em [`docs/pfitness_schema.sql`](docs/pfitness_schema.sql). As mudanças posteriores ficam em [`supabase/migrations/`](supabase/migrations/). Rode cada arquivo novo, em ordem, no **SQL Editor** do Supabase:

| Arquivo | O que faz |
| --- | --- |
| `20261027120000_save_workout_plan.sql` | Função que salva a ficha e os exercícios dela numa única transação (usada em Salvar ficha) |

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `next build` e depois gera `public/sw.js` (`scripts/build-sw.mjs`) |
| `npm start` | Serve o build de produção |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run icons` | Regenera os PNGs do PWA a partir de `app/icon.svg` |
| `npm run db:types` | Regenera `types/database.ts` a partir do banco (veja abaixo) |

Para regenerar os tipos depois de mudar o schema, faça login no CLI do Supabase uma vez e rode o script com o ref do projeto (o subdomínio de `NEXT_PUBLIC_SUPABASE_URL`):

```bash
npx supabase login
SUPABASE_PROJECT_REF=<ref> npm run db:types
```

## Deploy na Vercel

1. Suba o repositório no GitHub e importe em [vercel.com/new](https://vercel.com/new). O preset Next.js é detectado sozinho.
2. Deixe o **Build Command** padrão (`npm run build`). Ele também gera o service worker; trocar por `next build` deixa o PWA sem `sw.js`.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production e Preview).
4. Faça o deploy e coloque o domínio gerado no Supabase: **Site URL** e **Redirect URLs** (`https://<seu-app>.vercel.app/auth/callback`).
5. No iPhone: abra o domínio no Safari → Compartilhar → **Adicionar à Tela de Início**.

## Estrutura

```
app/
  (auth)/login/          login e cadastro (server actions em (auth)/actions.ts)
  (tabs)/                abas com tab bar: hoje, treinos, dieta, progresso, perfil
  (focus)/               telas cheias sem tab bar: nova/editar ficha, treino em andamento
  auth/callback/         destino do link de confirmação de email
  ~offline/              fallback do service worker sem rede
  sw.ts  manifest.ts  icon.svg  apple-icon.png
components/
  ui/                    Card, Button, IconButton, Label, StatNumber, Input, Segmented,
                         Stepper, Chip, Sheet (bottom sheet), Toast, ícones
  app-shell/             AppShell, TabBar, Screen/ScreenHeader, FocusHeader
lib/
  supabase/              clientes browser/server e renovação de sessão do proxy
  auth.ts                usuário e perfil da sessão (getSessionUser, getCurrentProfile)
  profile.ts             ensureProfile: cria perfil e metas no primeiro login
  workouts.ts            fichas, biblioteca de exercícios, badge HOJE, última vez/carga
  date.ts                datas em America/Sao_Paulo
types/database.ts        tipos do schema
supabase/migrations/     SQL aplicado depois do schema base
proxy.ts                 protege as rotas e renova a sessão (o antigo middleware.ts)
scripts/                 build do service worker e geração de ícones
```

## Convenções

- **Datas:** o default `current_date` do banco é UTC e, depois das 21h no Brasil, gravaria o dia seguinte. Ao gravar colunas `date` (`valid_from`, `eaten_on`, `logged_on`), envie sempre `todayInAppTimeZone()` de `lib/date.ts`.
- **Sessão e Cache Components:** ler a sessão usa `cookies()`, então todo componente que chama `getSessionUser()`/`getCurrentProfile()` precisa ficar dentro de um `<Suspense>` (fora dele o build falha). O resto da página é pré-renderizado e aparece na hora.
- **Design tokens:** cores, raios, sombras e tipografia ficam em `@theme` no `app/globals.css`. Use os utilitários (`bg-lime`, `text-fg/52`, `rounded-card`, `shadow-button`, `font-display`…) em vez de valores soltos. Ao criar um token novo, registre-o também em `lib/cn.ts`.
- **Service worker:** é gerado depois do `next build` porque a rota oficial do `@serwist/turbopack` não é compatível com Cache Components. Detalhes em `scripts/build-sw.mjs`.
