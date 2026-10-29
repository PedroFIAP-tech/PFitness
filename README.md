# PFitness

PWA mobile-first de treino, alimentação e gamificação.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Auth + Postgres) · Serwist (service worker).

Referências de design e banco ficam em [`docs/`](docs/): [`design-notes.md`](docs/design-notes.md) (tokens, componentes, animações e as telas a construir; é a fonte de design daqui para frente), o protótipo original (`PFitness.html`), telas em PDF e o schema (`pfitness_schema.sql`, já aplicado no Supabase).

## Rodar local

Requisitos: Node 20.9+.

```bash
npm install
cp .env.example .env.local   # preencha com URL e anon key do Supabase e a OPENAI_API_KEY
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
| `20261027130000_workout_session.sql` | Treino em andamento: uma sessão ativa por usuário, `start_workout`, `log_set`/`undo_set` (série + PR + pontos juntos), `finish_workout`, `discard_workout` e `exercise_bests_before` |
| `20261028120000_food_log.sql` | Diário alimentar: `log_food` (registro + 5 pontos), `update_food_log`, `delete_food_log` (estorna os pontos), `food_day_is_open` (só hoje e ontem aceitam mudanças) e `food_id` em `v_food_log_detail` |
| `20261028140000_home_stats.sql` | Aba Hoje (só leitura): `longest_streak` (recorde, mesma regra da `current_streak`), `activity_days` (treino/alimentação por dia) e `points_by_day` (pontos por dia em America/Sao_Paulo) |
| `20261028160000_workout_import.sql` | Importar treino por texto: `plan_exercises.notes`, `workout_plans.weekday`, letras únicas só entre fichas ativas, `save_workout_plan` com dia e observação, `import_workout_plans` (exercícios novos + fichas numa transação), `ai_usage` + `claim_ai_usage` (limite diário da IA) |
| `20261029120000_profile_onboarding.sql` | Perfil e onboarding: `lanche_manha` em `meal_type`, colunas de rotina/treinos/refeições/restrições em `profiles`, `daily_goals.source`, `save_onboarding`, `log_weight`, `set_daily_goals` e `sync_achievements` (progresso e desbloqueio das conquistas) |
| `20261029140000_progress.sql` | Aba Progresso (só leitura): `load_progress` (carga máxima e 1RM estimado por exercício e semana), `training_calendar` (volume, treinos, duração e alimentação por dia) e `muscle_volume` (volume por grupo muscular) |

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `next build` e depois gera `public/sw.js` (`scripts/build-sw.mjs`) |
| `npm start` | Serve o build de produção |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Testes de `lib/**/*.test.ts` com `node:test` (Node 22.18+ roda TypeScript direto), com a IA em modo mock |
| `npm run ai:record-fixture` | Regrava a resposta real da IA para o texto de exemplo (**chama a OpenAI**; rode só quando o prompt ou o schema mudarem) |
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
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `OPENAI_API_KEY` (Production e Preview). `AI_MODEL` é opcional.
4. Faça o deploy e coloque o domínio gerado no Supabase: **Site URL** e **Redirect URLs** (`https://<seu-app>.vercel.app/auth/callback`).
5. No iPhone: abra o domínio no Safari → Compartilhar → **Adicionar à Tela de Início**.

## Estrutura

```
app/
  (auth)/login/          login e cadastro (server actions em (auth)/actions.ts)
  (tabs)/                abas com tab bar: hoje (streak, treino do dia, alimentação, pontos),
                         treinos, dieta (diário + sheet de alimento),
                         progresso (mês, peso, carga, volume por grupo, calendário), perfil
  (focus)/               telas cheias sem tab bar: onboarding, nova/editar ficha, importar
                         texto, treino em andamento, resumo do treino
  auth/callback/         destino do link de confirmação de email
  ~offline/              fallback do service worker sem rede
  sw.ts  manifest.ts  icon.svg  apple-icon.png
components/
  ui/                    Card, Button, IconButton, Label, StatNumber, Input, Segmented,
                         Stepper, Chip, Sheet (bottom sheet), Toast, WheelPicker (roleta),
                         HoldButton, ícones
  app-shell/             AppShell, TabBar, Screen/ScreenHeader, FocusHeader
  workout/               Iniciar/Continuar (com conflito), pílula do treino, fila de séries
lib/
  ai/                    IA no servidor: provedor (OpenAI), schema zod e prompt da importação
  supabase/              clientes browser/server e renovação de sessão do proxy
  auth.ts                usuário e perfil da sessão (getSessionUser, getCurrentProfile)
  profile.ts             ensureProfile: cria perfil e metas no primeiro login
  workouts.ts            fichas, biblioteca de exercícios, badge HOJE, última vez/carga
  workout-session.ts     treino em andamento e resumo (servidor)
  workout-model.ts       regras do treino: estado, PR, totais (servidor e cliente)
  workout-sync.ts        fila offline das séries (cliente)
  workout-import.ts      casamento da leitura da IA com a biblioteca (encontrado/parecido/novo)
  home.ts                aba Hoje: tudo buscado em paralelo (servidor)
  diet.ts                dia do diário: itens, meta vigente, catálogo e recentes (servidor)
  diet-model.ts          regras da dieta: refeições, porções, totais, dias abertos (servidor e cliente)
  progress.ts            aba Progresso: tudo buscado em paralelo (servidor)
  progress-model.ts      escalas dos gráficos, tendência, barras, calendário (servidor e cliente)
  nutrition-calc.ts      metas calculadas (Mifflin-St Jeor) e meta adaptativa, com testes
  profile-data.ts        aba Perfil e valores do onboarding (servidor)
  profile-model.ts       opções e limites do onboarding/Perfil (servidor e cliente)
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
- **Treino em andamento:** o banco é a fonte da verdade das séries concluídas/puladas. Elas passam por uma fila no `localStorage` (`lib/workout-sync.ts`) que reenvia quando a conexão volta; as funções do banco são idempotentes, então reenviar não duplica. Os kg/reps ajustados, o exercício atual e o descanso (guardado como horário de término) também ficam no aparelho, para retomar o treino depois de fechar o app.

- **Dieta:** o dia aberto fica na URL (`/dieta?dia=YYYY-MM-DD`; sem o parâmetro é hoje). Dá para consultar qualquer dia passado, mas só hoje e ontem aceitam adicionar, editar e remover; a regra vale no banco (`food_day_is_open`) e na tela (`isDayOpen`). A dieta funciona só online: sem conexão os botões ficam desligados.

- **Importar treino por texto (IA):** `/treinos/importar` manda o texto (até 8.000 caracteres) para a IA em `lib/ai/`, que devolve JSON validado com zod; o servidor casa cada exercício com a biblioteca por nome normalizado **e** equipamento (`lib/workout-import.ts`). A chave fica só no servidor (`OPENAI_API_KEY`); o provedor e o modelo mudam por `AI_PROVIDER`/`AI_MODEL` (padrão `gpt-6-luna`, ~US$ 0,002 por importação). O raciocínio do modelo fica desligado (`AI_REASONING_EFFORT=none`): para extrair texto não muda o resultado e a leitura cai de ~20 s para ~7 s. Cada leitura conta no limite diário por usuário, `AI_DAILY_LIMIT` (padrão 10, de 1 a 100), controlado por `claim_ai_usage` (a única função `security definer`: o usuário só lê `ai_usage`, então não consegue zerar o próprio limite).
- **IA nos testes:** testes automáticos e de interface **não chamam a OpenAI**. Com `AI_PROVIDER=mock`, `lib/ai/mock.ts` devolve a resposta real gravada em `lib/ai/fixtures/workout-import-example.ts` (lida a partir de `workout-import-example.txt`). Marcadores no texto simulam falhas: `[mock:invalid]`, `[mock:unavailable]`, `[mock:empty]`; `AI_MOCK_DELAY_MS` controla a espera (padrão 800 ms). Para testar a interface: `AI_PROVIDER=mock npm start`. O `npm test` já liga o mock. A API real só é chamada pelo app em uso normal e por `npm run ai:record-fixture`.
- **Badge HOJE:** a ficha com o dia da semana de hoje; sem ela, a sequência entre as fichas sem dia; se todas têm dia e nenhuma é hoje, é dia de descanso (a aba Hoje mostra a próxima com "Treinar mesmo assim").

- **Onboarding e metas:** no primeiro acesso (`profiles.onboarded_at` nulo) a aba Hoje manda para `/onboarding`; o Perfil tem "Refazer onboarding". As metas são calculadas em `lib/nutrition-calc.ts`, sem IA:
  - TMB por Mifflin-St Jeor (10·kg + 6,25·cm − 5·idade, +5 homens, −161 mulheres, −78 "outro").
  - Fator de atividade = base da rotina + 0,05 por treino na semana, teto 1,9:

    | Rotina | Base | 3×/sem | 5×/sem |
    | --- | --- | --- | --- |
    | Sedentária | 1,20 | 1,35 | 1,45 |
    | Moderada | 1,35 | 1,50 | 1,60 |
    | Ativa | 1,50 | 1,65 | 1,75 |

  - Objetivo (`GOAL_KCAL_ADJUSTMENT`): ganhar massa +300, perder gordura −400, manter 0; kcal arredondadas para múltiplos de 50 (piso 1.200).
  - Proteína 2,0 g/kg (2,2 para perder gordura), gordura 0,9 g/kg, carbo com o restante (mínimo 50 g).
  - Metas e peso são gravados com a data de hoje (`daily_goals`/`weight_logs`, um registro por dia); os dias anteriores ficam no histórico. `daily_goals.source` diz se a meta é padrão, calculada ou personalizada.
- **Meta adaptativa:** com ≥ 4 pesagens em ≥ 14 dias nas últimas 3 semanas (descartando as que diferem mais de 3 kg das vizinhas), a tendência do peso é comparada ao esperado (+0,25 kg/sem para massa, −0,5% do peso/sem para perder, 0 para manter, tolerância ±0,15). Fora da tolerância, o Perfil sugere ±100–200 kcal; "Ignorar" esconde por 7 dias.
- **Progresso:** o dia de um treino é o dia (America/Sao_Paulo) em que ele foi concluído. Carga semanal de segunda a domingo, por maior carga ou 1RM estimado (Epley: kg × (1 + reps/30)); o calendário pinta cada dia pelo volume relativo ao maior dia do período (quartis) e marca dias só com alimentação; a linha tracejada do peso é a mesma regressão da meta adaptativa (`weightRegression`). Medidas e fórmulas da tela em `docs/design-notes.md`.
- **Refeições:** `profiles.meal_plan` guarda as refeições escolhidas e os horários; a Dieta mostra só elas, na ordem do usuário, com a meta de cada uma (pesos: almoço e jantar 3, café 2, lanches e ceia 1).

## Pendências

- **Travar `point_events` antes da parte de competição.** Hoje o RLS (`own_rows`) deixa o próprio usuário inserir pontos direto pela API. Antes de rankings/competição, revogar `insert`/`update`/`delete` dessa tabela para `authenticated` e gravar pontos só pelas funções (`log_set`, `finish_workout`…), que então passam a ser `security definer` com checagem explícita de `auth.uid()`.
- **Travar `user_achievements` antes da competição.** Como em `point_events`, o RLS (`own_rows`) deixa o usuário inserir conquistas direto. Antes de rankings, gravar só por `sync_achievements` (que então vira `security definer`).
- **Rever a regra da sequência antes da competição.** Hoje o dia conta com um treino concluído ou com qualquer alimento registrado, então registrar 1 item já mantém a streak. Uma regra mais justa: alimentação só conta com ≥ 70% da meta de kcal do dia. A regra vive em `current_streak` (schema base) e `longest_streak` (`20261028140000_home_stats.sql`), e as duas precisam mudar juntas; `activity_days` usa a mesma definição para a faixa dos 7 dias.
- **Teto de pontos por alimento antes da competição.** Hoje cada alimento registrado vale +5 sem limite, então dá para farmar pontos com dezenas de itens de 1 g. Antes de rankings, limitar em `log_food` (ex.: pontos só para os 10 primeiros itens do dia) e incluir `food_logs` no travamento acima (`update`/`delete` só pelas funções).
