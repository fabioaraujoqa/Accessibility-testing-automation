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
um `journey.scan('<estado>')` depois de cada interação relevante e um `journey.expectGate()` no final.
Use `toMatchAriaSnapshot` em componentes críticos para travar papel, nome e ordem
(gere com `npx playwright test <arquivo> --update-snapshots` e revise o diff).

## Projetos do Playwright

| Projeto | O que faz |
|---|---|
| `setup` | Login → `.auth/user.json` (só quando alguma página tem `requiresAuth`) |
| `a11y` | Scan axe das páginas e jornadas (desktop) |
| `a11y-mobile-reflow` | Scan em 320×640 + checagem própria de rolagem horizontal (WCAG 1.4.10, que o axe não cobre) |
| `a11y-kbd` | Navegação só por teclado (WCAG 2.1.1, 2.1.2, 2.4.7), que o axe não cobre |

<!-- Seções de baseline/gate, CI, MCP/agentes e glossário são completadas nas próximas fases. -->
