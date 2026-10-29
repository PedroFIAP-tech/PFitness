# PFitness: notas de design

Fonte única de design do app daqui para frente. Tudo aqui foi extraído do protótipo `docs/PFitness.html` (e conferido com o PDF das telas) durante a construção das etapas 1 a 7. **Não é preciso abrir o PFitness.html de novo.**

- Os **tokens** já vivem em `app/globals.css` (`@theme`) e são registrados em `lib/cn.ts`. Use os utilitários (`bg-lime`, `text-fg/52`, `rounded-card`…) em vez de valores soltos.
- As **telas já construídas** (seção 5) têm o código como referência mais fiel. Esta nota só resume o que importa para manter a consistência.
- A **tela que falta**, Progresso (seção 6), está descrita em detalhe, com medidas, cores, fórmulas e interações do protótipo.

---

## 1. Fundamentos

### Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `bg` | `#05070a` | Fundo do app |
| `fg` | `#e9efea` | Texto; opacidades para hierarquia (`fg/72` subtítulo, `fg/60`, `fg/52` label, `fg/45` meta, `fg/40` eixos, `fg/30` desabilitado) |
| `lime` | `oklch(0.9 0.2 128)` (≈ `#C8FF4A`) | Cor de ação e destaque, proteína, progresso, "hoje" |
| `on-lime` | `#071003` | Texto sobre lime |
| `cyan` | `oklch(0.86 0.14 215)` | Carboidrato |
| `amber` | `oklch(0.86 0.15 70)` | Gordura, PR, streak, "novo", acima da meta |
| `danger` | `oklch(0.72 0.17 25)` | Remover, erros |
| `line` | `rgb(255 255 255 / 0.08)` | Bordas de card |

- Lime com alfa é a base dos estados: `lime/6–8` fundo sutil, `lime/10–14` selecionado, `lime/25–30` borda de card de destaque, `lime/45–60` borda ativa.
- **Glow:** `0 0 Npx oklch(0.9 0.2 128 / a)`, com N de 8 a 40 e a de 0,35 a 0,8. Elementos acesos (barra de hoje, anel, linha do gráfico) ganham glow; os apagados, não.
- **Sombras de texto** em números grandes: `0 0 16–24px oklch(0.9 0.2 128 / .35–.5)`.
- **Fundo de painel escuro** (roletas, segmentados): `black/35–40`, borda `white/6–7`.

### Tipografia (`next/font` em `app/layout.tsx`)

| Família | Classe | Uso |
| --- | --- | --- |
| Chakra Petch | `font-display` | Títulos de tela (30px/600), nomes de ficha, botões (caixa alta, 700), letras A–E |
| Geist | `font-sans` | Texto corrido, nomes de alimento e exercício (13–16px) |
| Geist Mono | `font-mono` | Números, labels técnicos, eixos, chips de valor |

- **Label técnico** (`<Label>`): mono, 10,5px, 500, `tracking-label` (0,14em), caixa alta, `fg/52`. Variações de 9,5px com 0,16em aparecem dentro de cards ("CONSUMIDO", "RESTAM").
- **Números grandes:** mono 600, letter-spacing −0,03 a −0,05em, `tabular-nums`. Escala usada:
  - 56px: timer do descanso;
  - 40–44px: kcal, streak, pontos, peso;
  - 36px: carga;
  - 26–34px: stats;
  - 20–22px: stats pequenos.
- **Botões:** Chakra Petch 700, caixa alta, `tracking-button` (0,16em), 13–15px.

### Medidas

- **Tela:** coluna de no máximo 448px (`max-w-md`), padding lateral de 16px e gap de 12–14px entre cards.
- **Topo:** `safe-area-inset-top` + 20px nas abas, + 14px nas telas cheias.
- **Raios:**
  - `field` 16px: inputs;
  - `button` 18px: botões;
  - `card` 22px: cards;
  - `hero` 24px: card de destaque e tab bar;
  - sheets: 28px no topo;
  - chips: 11–13px;
  - barras: 3–6px.
- **Alvo de toque:** mínimo de 48px. Chips têm visual de 34px dentro de uma área de 48px; botões de ícone têm 48×48.
- **Card padrão:** padding 16px, `linear-gradient(180deg, white/5, white/1.8)`, borda `white/8` e `inset 0 1px 0 white/5`.
- **Card de destaque** (`Card variant="accent"`):
  - padding 18px;
  - `linear-gradient(160deg, lime/9, white/2 55%)`;
  - borda `lime/25`;
  - sombra `0 20px 50px -20px lime/25`;
  - **cantoneiras** de 10×10px com traço de 1,5px `lime/80` a 8px dos cantos;
  - letra gigante ao fundo: Chakra 150px, `lime/6`.

---

## 2. Componentes (em `components/ui` e `components/app-shell`)

| Componente | Medidas e comportamento do protótipo |
| --- | --- |
| **Tab bar** | Barra de 66px, raio 24, `rgb(15 18 21 / .78)` + blur 22px e saturate 140%, borda `white/9`. 5 colunas com ícone de 22px e label Geist 10,5px. Indicador: traço de 30×2px lime com glow, no topo, que desliza (`left` em 0,45s `ease-snap`). Faixa de gradiente atrás (`bg` 0 → 92%). |
| **ScreenHeader** | Eyebrow (label) + título Chakra 30px, com uma ação opcional à direita (avatar de 46–48px ou botão). |
| **FocusHeader** | Telas cheias: botão de voltar 48px, label central e ação à direita; sticky com `bg/85` e blur. |
| **Button** | `lg` 60px (CTA principal), `md` 54px, `sm` 48px. Primário lime com `shadow-button`; ao pressionar, `scale(.97)` e glow maior. Variantes secondary (`white/6`), ghost (texto lime) e danger (`danger/10`, borda `danger/35`). |
| **Chip** | 34px, raio 11, 13px. Ativo: `lime/14`, borda `lime/60`, texto lime. Inativo: `white/4`, borda `white/8`, `fg/75`. |
| **Segmented** | Trilho `black/35` com padding 4; o indicador (borda `lime/55`, `lime/14`, glow) desliza entre as opções. Aceita `null`, sem indicador. |
| **Stepper** | − valor + com 48px de altura, raio 14, `black/35`; valor mono 18px e rótulo de 8,5px embaixo. Aceita `step` e `format`. |
| **WheelPicker** | 176px de altura; linhas de 44px; ±2 vizinhos com `scale(1 − d·0.27)` e `opacity 1 − d·0.45`; faixa central de 54px com borda lime (mais forte arrastando). Labels no canto ("KG", "±2,5") e "ARRASTE ↕" embaixo. Gradiente de fade em cima e embaixo. |
| **Sheet** | Fundo `black/60` + blur, painel `rgb(12 15 18 / .97)`, raio 28 no topo, alça de 40×5px. `tall` = 84dvh. Sobe com `sheet-up` (0,42s, `ease-sheet`). Fecha tocando fora ou com Esc. Header com eyebrow, título, botão à esquerda e ação. |
| **Toast** | Topo central, `rgb(16 20 14 / .92)` + blur, borda `lime/45` (erro: `danger/45`), raio 16, 13px. Some em 2,2 s. |
| **HoldButton** | Segurar para finalizar: o preenchimento cresce durante o toque. |
| **CountUp** | Número que conta de 0 ao valor (1,1 s, desacelerando) ao aparecer; o leitor de tela lê o valor final. |
| **Barras de progresso** | Macro: 6px, raio 3. Kcal: 12px, **segmentada** (`repeating-linear-gradient(90deg, transparent 0 10px, #0a0d10 10px 12px)` por cima). XP: 8px, segmentos de 18px. Crescem com `bar-x`. |
| **Anéis e gauge** | Paths SVG com `pathLength=100`, `stroke-dasharray:100` e `dashoffset = 100 − %`. Enchem com `ring` (1,4 s). Traço do fundo `white/7`. Gauge da Hoje: arco de 280×156 com marcas tracejadas (`.25 4.75`). |
| **Hexágono** (selos) | `clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)`, com duas camadas: borda em gradiente lime e miolo `radial(lime/28 → #0a0d10)`. Bloqueado: `white/10` e texto `fg/35`. |
| **Medalha 3D** (`components/achievements`) | No sheet de detalhe da conquista, o hexágono vira uma peça metálica em CSS 3D (`perspective 700px`, `preserve-3d`, sem Three.js). **Frente** = o selo idêntico; **verso** = o mesmo hexágono com o nome (Chakra 15px/700); **espessura** de 12px com 11 camadas de hexágono empilhadas (lime metálico escuro; bloqueada: cinza). De frente e parada fica igual ao selo plano. Ao girar: faixa especular (`white/45`, `skewX(-20deg)`) cruzando a face perto de 12° e borda com um segundo gradiente (20deg) aparecendo conforme o ângulo. Bloqueada: sem reflexo nem brilho. Embaixo, "ARRASTE PARA GIRAR" (mono 9,5px `fg/35`) e, no iOS, o botão "ATIVAR MOVIMENTO" (permissão do giroscópio). |
| **Chama** (streak) | Gota com `border-radius: 50% 0 50% 50%`, `linear-gradient(45deg, #FFD66B, #FF9A2E 55%, #FF5A1F)`, glow laranja e núcleo `#FFF2C2` animado ao contrário. |

---

## 3. Animações

| Protótipo | Token no app | Uso |
| --- | --- | --- |
| `pfIn` (0,5s, sobe 16px) | `animate-screen-in` / `animate-item-in` (0,35s) | Entrada de tela e de itens |
| `pfUp` | `animate-slide-up` | Pílula do treino, painéis |
| `pfFade` | `animate-fade-in` | Fundos de sheet, áreas de gráfico |
| `pfSheet` | `animate-sheet-up` | Bottom sheets |
| `pfRing` | `animate-ring` | Anéis, gauge e anel de XP enchendo |
| `pfBarX` | `animate-bar-x` | Barras horizontais crescendo (com `origin-left`) |
| `pfBarY` | `animate-bar-y` | Barras verticais subindo (com `origin-bottom`), em cascata de 0,04–0,05s por barra |
| `pfDraw` | `animate-draw` | Linha SVG se desenhando: `pathLength=1`, `dasharray:1`, `dashoffset` de 1 → 0 em 1,5s `cubic-bezier(.3,.7,.2,1)` |
| `pfFlame` | `animate-flame` | Chama |
| `pfGlow` | `animate-glow-pulse` | Pulso de opacidade (dia pendente, ponto final do gráfico) |
| `pfPart` / `pfRingOut` / `pfBurst` / `pfFloat` | `animate-particle`, `ring-out`, `burst`, `float-up` | Série concluída e novo PR |
| `pfPop` | `animate-pop` | Check, selos aparecendo |
| `pfBump` | `animate-bump` | Número que acabou de subir (streak) |
| `pfBlink` | `animate-blink` | Ponto "ao vivo" |
| `pfPulse` | `animate-pulse-ring` | Anel pulsando nos últimos segundos do descanso |
| `pfShine` | `animate-shine` | Brilho passando no selo do resumo |
| `pfToast` | `animate-toast-in` | Toast |
| `pfScan` | `animate-scan` | Varredura (leitura da IA) |

- **Medalha 3D** (`lib/medal-motion.ts`, loop de `requestAnimationFrame` escrevendo só `transform`/`opacity`, sem render do React):
  - **arrastar** gira no eixo Y (0,5°/px); ao soltar, continua com inércia (atrito exponencial) e uma mola leva até a face mais próxima (frente ou verso);
  - **toque duplo** volta para a frente;
  - **desbloqueio:** a peça cresce e entra girando 3 voltas, desacelera (1,7s, ease-out forte) e para de frente com flash radial lime/branco e anel saindo;
  - **inclinar o celular** inclina a peça até 8° e move o reflexo (DeviceOrientation);
  - **`prefers-reduced-motion`:** sem entrada girando (só o flash em fade), sem inércia e sem inclinação; o arraste continua.
- **Easing padrão:** `ease-snap` = `cubic-bezier(.2,.8,.2,1)`. Sheets usam `cubic-bezier(.2,.9,.2,1)`.
- **Ao pressionar:** `scale(.9–.98)` em 0,15s (`active:scale-…`).
- **Contagem de entrada:** os números grandes de cada tela contam de 0 ao valor ao abrir (`CountUp`/`useTween`). Com as abas preservadas (Activity), isso repete ao voltar para a aba.
- **Transições de valor:** larguras e alturas animam em 0,5–0,9s `ease-snap` quando o dado muda (`transition-[width]`, `transition-[height]`).

---

## 4. Texto e formatação

- **Números:** pt-BR (`formatNumber`): `1.582` e `42,5`. Peso e carga com até 1 casa (`fk`). Variação com sinal: `+1,2 kg` ou `−0,4 kg`, usando o sinal de menos tipográfico "−".
- **Datas** no fuso America/Sao_Paulo (`lib/date.ts`):
  - eyebrow: "QUA · 28 OUT";
  - curta: "26 out";
  - com ano: "12 mar 2026";
  - mês: "out 2026".
- **Dias da semana:**
  - iniciais D S T Q Q S S (0 = domingo);
  - abreviados SEG, TER… (`WEEKDAYS` em `lib/workout-rules.ts`);
  - no calendário do Progresso, a semana começa na **segunda**: S T Q Q S S D.
- **Unidades** separadas e menores: o número em mono grande e a unidade em 11–14px `fg/50` ("78,4 kg", "kcal", "kg máx.").
- **Textos combinados com o usuário** (diferentes do protótipo):
  - a streak diz "Treino ou dieta todo dia · recorde N", porque a regra é "ou";
  - "Pullover" e afins viram exercício novo quando o equipamento não bate.

---

## 5. Telas já construídas (o código é a referência)

| Tela | Rota / código | Pontos de design que valem para as próximas |
| --- | --- | --- |
| 01 Hoje | `app/(tabs)/hoje` | Card de streak com faixa de 7 dias (treino = lime sólido; só dieta = `lime/7` com borda `lime/30`; hoje pendente = contorno pulsando). Treino do dia em card accent. Gauge de kcal com 3 anéis. Pontos com 7 barras (hoje lime com glow, demais `lime/26`, mínimo de 5% de altura). |
| 02 Treinos | `app/(tabs)/treinos` | Card de ficha que expande (`grid-rows` 0fr → 1fr), letra em quadrado de 54px, badge HOJE (lime sólido, mono 9,5px). |
| 03 Editar ficha | `app/(focus)/treinos/[id]/editar` | Itens com setas ↑↓, steppers e observação; biblioteca em sheet `tall` com busca e chips de grupo. |
| 04 Treino em andamento | `app/(focus)/treino/[planId]` | Topo com tempo / volume / séries, barra de progresso por exercício, roletas de kg e reps, linhas de série com arrastar (→ concluir, ← pular) e partículas. |
| 05 Descanso | `rest-timer.tsx` | Sheet com anel de 236px e marcas, timer 56px, "A seguir", −15s / PULAR / +15s. Minimizado vira pílula no topo. |
| 06 Novo PR | `pr-overlay.tsx` | Overlay âmbar com raios, burst e ganho em kg. |
| 07 Resumo | `app/(focus)/treino/resumo` | Hexágono com a letra, raios girando, grade de stats 2×2, lista de PRs, pontos com contagem e streak subindo. **Card "Conquista nova"** (entre os PRs e os pontos, só se houver): card com borda `lime/30` e gradiente lime como o de pontos, label mono 9,5px lime "CONQUISTA NOVA" ("CONQUISTAS NOVAS" se várias), e uma linha por conquista com o selo `md`, nome Chakra 17px/600, descrição 12px `fg/60` e chevron. Entra com `screen-in` (delay 0,7s). 1,8s depois o sheet da medalha abre sozinho com a entrada girando; com várias, o eyebrow diz "CONQUISTA NOVA · 1 DE 2" e o botão "PRÓXIMA" (pílula lime como o HOJE da Dieta) passa para a seguinte. Tocar numa linha abre de novo. |
| 08 Dieta | `app/(tabs)/dieta` | Card do dia (kcal 42px + barra segmentada + 3 barras de macro), cards de refeição com itens, meta por refeição, navegação de dias. |
| 09 Adicionar alimento | `food-sheet.tsx` | Sheet de 84% com busca, chips de recentes, lista, quantidade com roleta e chips 50/100/150/200/300, "1.582 → 1.820 kcal no dia". |
| 11 Perfil | `app/(tabs)/perfil` | Avatar com anel de XP de 80px, 3 stats (peso com −/+), objetivo segmentado, metas com steppers, conquistas em hexágonos 3×3 com sheet de detalhe (medalha 3D). Conquista nova (desbloqueada fora do treino) abre sozinha girando, 0,45s depois da tela. |
| Onboarding | `app/(focus)/onboarding` | Progresso de 6 segmentos no topo, cards de escolha com check redondo, metas com explicação. |
| 10 Progresso | `app/(tabs)/progresso` | Construída a partir da seção 6, com os extras pedidos depois: resumo do mês (4 blocos), período 1A, linha tracejada de tendência, "Registrar peso" (sheet com roleta), seletor "kg máx. / 1RM est." e "+" com todos os exercícios, volume por grupo muscular (4 semanas, barras horizontais). Seletores compactos de cabeçalho usam `PillToggle`. |
| Importar treino | `app/(focus)/treinos/importar` | Textarea grande, card de leitura com varredura e mensagens, revisão com badges NOVO (âmbar) e CONFIRMAR (lime). |

---

## 6. Tela 10: Progresso (especificação do protótipo; construída)

**Estrutura:** coluna com gap de 12px e entrada `screen-in`. Cabeçalho seguido de três cards padrão (padding 16, raio 22).

### 6.1 Cabeçalho

- Eyebrow: "Objetivo · ganhar massa", com o objetivo do perfil. O `<Label>` deixa o texto em caixa alta.
- Título: "Progresso", Chakra 30px/600.

### 6.2 Card "Peso corporal"

- **Linha do topo:** label "PESO CORPORAL" à esquerda e, à direita, um **seletor 1M / 3M / 6M**.
  - Trilho com padding 3px, raio 10, `black/35`, borda `white/6`, gap de 2px.
  - Cada botão tem 40×30px, raio 7 e mono 11px/600.
  - Ativo: `lime/14`, borda `lime/50`, texto lime. Inativo: transparente, `fg/60`.

  O botão visual é menor que 48px: no app, aumentar a área de toque mantendo o visual.
- **Linha de valores** (margin-top 12, alinhada embaixo, gap 10):
  - **Peso grande:** mono 42px/600, −0,05em, mais "kg" em mono 14px `fg/50`. Mostra o último peso, ou o ponto tocado. Ao abrir, conta até o valor.
  - **Subtítulo** (flex 1): mono 12px `fg/50`, padding-bottom 4. Mostra "hoje" (ou a data da última pesagem) ou a data do ponto tocado, como "12 out".
  - **À direita, em coluna:**
    - variação: mono 15px/600 **lime** ("+3,8 kg");
    - abaixo, Geist 11px `fg/50`: "no último mês", "em 3 meses" ou "em 6 meses".

    Variação = último − primeiro do período. Para perder gordura, uma queda é o resultado bom; o protótipo sempre usa lime.
- **Gráfico:** área relativa de 178px de altura, margin-top 14.
  - **Área de desenho:** `left 0`, `right 38px` (espaço dos rótulos Y), `top 0`, `bottom 22px` (espaço dos rótulos X); `touch-action: pan-y`; cursor crosshair.
  - **Grade:** 3 linhas tracejadas horizontais (`1px dashed white/8`) em 8%, 50% e 92% da altura.
  - **Rótulos Y:** à direita, mono 10px `fg/40`, centralizados verticalmente em 8% (topo), 50% (meio) e 92% (base). Valores:
    - topo = `min + (max − min)·0,92`;
    - meio = `(max + min)/2`;
    - base = `min + (max − min)·0,08`;
    - todos com 1 casa.
  - **SVG:** `viewBox 0 0 287 154`, `preserveAspectRatio="none"`, `overflow: visible`, ocupando toda a área.
  - **Escala Y:** `min = menor peso − 0,3`, `max = maior peso + 0,3`; `y = 154·(0,08 + (1 − (v − min)/(max − min))·0,84)`, deixando 8% de folga em cima e embaixo.
  - **Escala X:** no protótipo, pelo índice (`i/(n−1)·287`). **No app, pela data:** pesagens espaçadas aparecem espaçadas.
  - **Área:** a linha fechada até a base (`L287 154 L0 154 Z`), preenchida com um gradiente vertical `#C8FF4A` de 0,26 → 0 de opacidade. Entra com `pfFade` 1s, delay 0,4s.
  - **Linha:** stroke lime 2,2, cantos e pontas redondos, `drop-shadow(0 0 4px lime/70)`. Desenha-se com `pfDraw` (`pathLength=1`, `dasharray 1`, 1,5s `cubic-bezier(.3,.7,.2,1)`).
  - **Ponto final** (sem scrub): círculo de 10px lime com glow de 12px, pulsando (`glow-pulse`), em `left 100%` e no Y do último ponto.
  - **Scrub** (arrastar ou tocar):
    - o ponto mais próximo do dedo vira o selecionado;
    - aparece uma linha vertical de 1px `white/40`, de cima a baixo, e um marcador de 14px (`#05070a`, borda de 2,5px lime e glow de 14px);
    - o número grande e o subtítulo passam a mostrar aquela pesagem;
    - soltar, cancelar ou sair da área limpa o scrub.

    Nos eventos, `pointerdown` captura o ponteiro, e o `pointermove` só conta com botão pressionado (ou mouse).
  - **Rótulos X:** mono 10px `fg/40` na base. Início à esquerda; meio centralizado em `(100% − 38px)/2`; "hoje" alinhado em `right: 38px`. Formato "26 out".
  - **Pontos por período no protótipo** (pesagem a cada 3 dias): 11 (1M), 31 (3M) e 61 (6M). Trocar o período limpa o scrub.
- **Estados vazios (app):**
  - sem pesagens: texto e link "Registre seu peso no Perfil";
  - com uma pesagem só: o ponto, sem linha.

### 6.3 Card "Evolução de carga"

- Label "EVOLUÇÃO DE CARGA".
- **Chips de exercício:** linha com rolagem horizontal, saindo pelas margens (`margin 12px −16px 0`, `padding 0 16px`), gap 6.
  - Chip de 34px, padding 0 13px, raio 11, Geist 13px/500, sem quebra de linha.
  - Ativo: `lime/14`, borda `lime/60`, texto lime. Inativo: `white/4`, borda `white/8`, `fg/75`.
  - Ao pressionar: `scale(.95)`.

  No protótipo são 4 exercícios: Supino reto, Agachamento, Terra, Desenvolvimento.
- **Linha de valores** (margin-top 14, baseline, gap 10):
  - carga: mono 36px/600, −0,05em, mais "kg máx." em mono 13px `fg/50`;
  - à direita (margin-left auto): variação em mono 14px/600 **lime** ("+10 kg") e o período "12 sem." em Geist 11px `fg/50`.
- **Barras:** 12, uma por semana. Container de 128px de altura, margin-top 14, gap 5, alinhado embaixo.
  - Cada coluna tem flex 1 e, de cima para baixo, o valor e a barra (gap 5).
    - **Valor:** mono 9,5px/600 lime, 10px de altura. Aparece **só na primeira e na última**.
    - **Barra:** largura toda, raio `5px 5px 2px 2px`.
  - **Altura:** `(v − mín)/(máx − mín)·82 + 18` %, com `mín = menor valor × 0,75`. Assim a menor barra tem pelo menos 18%.
  - **Cor:**
    - última (esta semana): lime com glow `0 0 14px lime/60`;
    - semana com o maior valor: `lime/60`;
    - demais: `lime/22`.
  - **Entrada:** `bar-y` 0,8s com delay de `i·0,04s`. A altura e a cor animam ao trocar de exercício (0,5s e 0,3s).
- **Eixo:** linha com space-between, margin-top 8, mono 10px `fg/40`: "sem 1", "sem 6", "esta sem.".
- **Valores** = carga máxima da semana (no protótipo, em progressão: Supino 32,5 → 42,5; Agachamento 60 → 85; Terra 80 → 110; Desenvolvimento 20 → 32,5).
- **App:**
  - semanas sem treino daquele exercício ficam com a barra vazia;
  - a variação é a última semana com dado menos a primeira;
  - sem histórico: "Conclua treinos para ver a evolução".

### 6.4 Card "Consistência"

- **Topo:** label "CONSISTÊNCIA" à esquerda; à direita, "18 semanas" em mono 11px `fg/55`.
- **Totais** (margin-top 12, gap 18). Cada um em coluna com gap 5: número em mono 26px/600 e legenda em Geist 11px `fg/55`.
  - treinos no período, com o número em **lime**: "treinos";
  - streak atual, número em `fg`: "streak atual";
  - recorde, número em `fg`: "recorde".
- **Meses:** grade de 18 colunas (gap 4, margin `16px 0 6px 18px`), mono 10px `fg/45`. Cada mês começa na coluna da semana em que ele inicia e ocupa 3 colunas (`grid-column: n / span 3`).
- **Grade de dias:** flex com gap 4.
  - **Coluna de dias da semana:** 14px de largura, 7 linhas, mono 9px `fg/40`. Só aparecem S (seg), Q (qua), S (sex) e D (dom), nas linhas 1, 3, 5 e 7.
  - **Células:** grade de **7 linhas × 18 colunas** com `grid-auto-flow: column`, gap 4 e 126 células. Cada célula é um botão `aspect-ratio 1` com raio 3.
  - **Cor por nível de volume:**

    | Nível | Fundo | Sombra |
    | --- | --- | --- |
    | 0 | `white/5` | — |
    | 1 | `lime/20` | — |
    | 2 | `lime/42` | — |
    | 3 | `lime/68` | `0 0 5px lime/40` |
    | 4 | `lime` | `0 0 9px lime/70` |

  - **Dias futuros** (o resto da última semana): transparentes e não clicáveis.
  - **Hoje:** `outline 1px lime` com `offset 1px`. O **dia selecionado** usa outline branco.
  - **Ao pressionar:** `scale(.75)`.
- **Rodapé** (margin-top 14, space-between, gap 10):
  - **Info:** mono 12px `fg/70`. Sem seleção: "Toque em um dia para ver detalhes". Com seleção:
    - "Seg, 26 out · Treino A · 6,1 t" (o volume em toneladas, com 1 casa);
    - "Seg, 26 out · descanso";
    - "Qua, 29 out · hoje · treino pendente".

    Formato: dia da semana abreviado (Seg, Ter, Qua, Qui, Sex, Sáb, Dom) + data curta.
  - **Legenda:** "menos", 5 quadrados de 9×9px (raio 2) com as cores dos níveis 0 a 4 (o último com glow de 6px), e "mais". Mono 10px `fg/40`, gap 3.
- **App (combinado no plano do Progresso):**
  - o nível vem do volume do dia em relação ao maior volume do usuário no período, em quartis de 1 a 4;
  - dia **só com alimentação** ganha contorno fraco (`lime/30`), como na faixa da Hoje, com info "só alimentação";
  - "treinos" conta os dias com treino concluído;
  - streak e recorde vêm de `current_streak` e `longest_streak`.

### 6.5 Dados do protótipo (só para referência visual)

- **Peso:** 61 pesagens, uma a cada 3 dias, subindo de ~74,6 para 78,4 kg com uma leve oscilação.
- **Calendário:** 126 dias a partir de uma segunda-feira, com treinos seg, ter, qua e sex (às vezes sáb) e algumas faltas aleatórias; nível de 1 a 4 aleatório.
- **Fichas por dia da semana** no protótipo: seg A, ter B, qua C, sex D, sáb A.
