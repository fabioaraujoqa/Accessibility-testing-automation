# Automação de acessibilidade web

Playwright Test + `@axe-core/playwright`, régua **WCAG 2.2 nível AA** (referência da ABNT NBR 17225).
Especificação completa: [docs/PLANO-A11Y.md](docs/PLANO-A11Y.md).

> ⚠️ **Automação não substitui teste manual.** O axe detecta uma parte dos problemas de WCAG
> (ex.: alt ausente, contraste, rótulos, ARIA inválido). Ele **não** avalia se o texto alternativo faz sentido,
> se a ordem de leitura é lógica, se os rótulos são claros, nem a experiência real com leitor de tela, zoom ou
> navegação por voz. Auditoria manual e testes com tecnologia assistiva continuam necessários.

## Rodar localmente

```bash
npm ci
npx playwright install chromium
npm run a11y                # todos os testes
npm run a11y:pages          # só o scan de páginas (desktop + 320px)
npm run a11y:journeys       # só as jornadas
npm run a11y:kbd            # só os testes de teclado
npm run a11y:report         # gera reports/summary.md + reports/metrics.json (após os testes)
npx playwright show-report  # relatório HTML (JSON do axe e ordem de foco anexados em cada teste)
```

Os testes rodam no seu computador, num Chromium headless (sem janela).
Para ver o navegador: `npx playwright test --headed` ou o modo interativo `npx playwright test --ui`.

Modo do gate: `A11Y_GATE_MODE=report|critical|serious` (padrão `report`, que nunca reprova).

## Alvo: demo ou o seu site

| `BASE_URL` | O que é escaneado |
|---|---|
| vazia | `demo/` servido em `http://localhost:4173` (sobe sozinho). Rodam também os autotestes do demo. |
| definida | `site.pages` do [a11y.config.ts](a11y.config.ts). Os testes do demo são pulados. |

Para rodar no seu site:

1. Crie o `.env` a partir do modelo (`cp .env.example .env`) e preencha `BASE_URL=https://...`.
   O `.env` não vai para o git. O `.env.example` é só o modelo versionado; mantenha-o sem valores reais.
2. Liste as páginas em `site.pages` no [a11y.config.ts](a11y.config.ts).
3. Se alguma página exige login: preencha `site.auth` (seletores da tela de login) e
   `A11Y_USER` / `A11Y_PASSWORD` no `.env`. Use um usuário de teste, nunca uma conta real.
4. `npm run a11y` e `npx playwright show-report`.

Para uma rodada pontual sem mexer no `.env`: `BASE_URL=https://... npm run a11y`.

## Adicionar uma página

Edite apenas `site.pages` em [a11y.config.ts](a11y.config.ts):

```ts
{ name: 'extrato', path: '/conta/extrato', requiresAuth: true, waitFor: '[data-testid="lista-extrato"]' },
{ name: 'login', path: '/login', requiresAuth: false, keyboard: { cta: 'button[type="submit"]' } },
```

- `waitFor`: seletor que precisa aparecer antes do scan (conteúdo carregado).
- `keyboard`: inclui a página no teste de teclado (CTA alcançável, sem armadilha de foco, foco visível).
  `afterEnter` (opcional): seletor que deve aparecer após acionar o CTA com Enter.
- `name` é o identificador estável da página nos relatórios e no baseline: não renomeie à toa.

Exclusões (`globalExclude`, `exclude`) e regras desligadas (`disabledRules`) exigem o campo `reason`.
O config recusa itens sem motivo.

## Adicionar uma jornada

Jornadas cobrem **estados** que um scan de página não vê: menu aberto, modal, erro de validação, sucesso.
Copie [tests/journeys/cadastro.a11y.spec.ts](tests/journeys/cadastro.a11y.spec.ts) (o modelo) e mantenha
um `journey.scan('<estado>')` depois de cada interação relevante e um `await journey.expectGate()` no final.
Use `toMatchAriaSnapshot` em componentes críticos para travar papel, nome e ordem
(gere com `npx playwright test <arquivo> --update-snapshots` e revise o diff).

## Projetos do Playwright

| Projeto | O que faz |
|---|---|
| `setup` | Login → `.auth/user.json` (só quando alguma página tem `requiresAuth`) |
| `a11y` | Scan axe das páginas e jornadas (desktop) |
| `a11y-mobile-reflow` | Scan em 320×640 + checagem própria de rolagem horizontal (WCAG 1.4.10, que o axe não cobre) |
| `a11y-kbd` | Navegação só por teclado (WCAG 2.1.1, 2.1.2, 2.4.7), que o axe não cobre |

## Baseline e gate

O gate reprova **apenas violações novas** em relação ao baseline versionado em
[baseline/violations.json](baseline/violations.json). O que já existe vira dívida, acompanhada pelas métricas.

| Modo (`A11Y_GATE_MODE`) | Reprova quando há violação **nova** de impacto |
|---|---|
| `report` | nunca (só relatório) |
| `critical` | `critical` |
| `serious` | `critical` ou `serious` |

**Identidade de uma violação (fingerprint):** `regra | página/estado | seletor normalizado`. Índices voláteis
(`:nth-child`) e classes geradas por CSS-in-JS são removidos ([lib/fingerprint.ts](lib/fingerprint.ts)).
A comparação conta ocorrências: se o baseline aceita 1 e agora há 2, 1 é nova. Quando o axe troca o
seletor de um elemento (o que acontece quando surge outro parecido), a ocorrência é casada pela
regra + página/estado. Limitação: corrigir uma ocorrência e criar outra da mesma regra, na mesma página
e no mesmo PR, se compensam. O total continua visível no `summary.md`.

Problemas de teclado (armadilha de foco, CTA inalcançável, foco invisível, Enter sem efeito) e de
reflow em 320 px viram violações `custom-*` e seguem as mesmas regras de baseline e gate.

**Atualizar o baseline é uma ação explícita e manual:**

```bash
npm run a11y:baseline              # roda a suíte em modo report e regrava o baseline
npm run a11y:baseline -- --no-run  # usa o último reports/results.json
git diff baseline/                 # o diff vai para code review
```

Só os contextos (página/estado) escaneados na execução são substituídos; os demais são mantidos.
Rode-o quando: (a) for adotar o gate num sistema pela primeira vez, (b) corrigir violações (para
"travar" a melhoria), ou (c) aceitar conscientemente uma dívida nova, com justificativa no MR.

**Relatórios** (`npm run a11y:report`, depois dos testes):

- `reports/summary.md`: tabela por página/estado com violações por impacto, novas em destaque, corrigidas
  e regras que o axe não conseguiu decidir (revisão manual).
- `reports/metrics.json`: totais por impacto, por página/estado, por critério WCAG, % de contextos sem
  `critical`, data, commit, alvo e modo do gate. Pode alimentar um dashboard externo.

## Glossário de impactos do axe

| Impacto | Significado |
|---|---|
| `critical` | Bloqueia o acesso: a pessoa não consegue concluir a tarefa (ex.: botão sem nome, imagem funcional sem alt). |
| `serious` | Dificulta muito ou exige contorno (ex.: contraste insuficiente, idioma da página ausente). |
| `moderate` | Causa incômodo ou confusão, mas há caminho (ex.: estrutura de landmarks incompleta). |
| `minor` | Irritação leve; melhoria de qualidade. |

<!-- Seções de CI (estratégia de ativação), MCP/agentes são completadas nas próximas fases. -->
