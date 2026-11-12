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
cp .env.example .env        # opcional; sem BASE_URL o alvo são as páginas de demo/
npm run a11y                # todos os testes
npm run a11y:pages          # só o scan de páginas (desktop + 320px)
npx playwright show-report  # relatório HTML (JSON do axe anexado em cada teste)
```

Modo do gate: `A11Y_GATE_MODE=report|critical|serious` (padrão `report`, que nunca reprova).

## Adicionar uma página

Edite apenas `pages` em [a11y.config.ts](a11y.config.ts):

```ts
{ name: 'extrato', path: '/conta/extrato', requiresAuth: true, waitFor: '[data-testid="lista-extrato"]' }
```

Exclusões (`globalExclude`, `exclude`) e regras desligadas (`disabledRules`) exigem o campo `reason`.
O config recusa itens sem motivo.

## Projetos do Playwright

| Projeto | O que faz |
|---|---|
| `setup` | Login → `storageState` (só quando alguma página tem `requiresAuth`) |
| `a11y` | Scan axe das páginas e jornadas (desktop) |
| `a11y-mobile-reflow` | Scan em 320×640 + checagem própria de rolagem horizontal (WCAG 1.4.10, que o axe não cobre) |

<!-- Seções de baseline/gate, CI, MCP/agentes e glossário são completadas nas próximas fases. -->
