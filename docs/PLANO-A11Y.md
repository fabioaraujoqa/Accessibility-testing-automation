# Plano: Automação de Acessibilidade Web com Playwright

> Documento de referência para o Claude Code. Siga as fases em ordem e só avance quando os critérios de aceite da fase atual estiverem cumpridos.

## 1. Objetivo

Criar um projeto de automação que **mede a acessibilidade web** das jornadas críticas e que, depois, funcione como **gate na esteira de CI/CD**. A régua é **WCAG 2.2 nível AA**, que é a referência da ABNT NBR 17225.

## 2. Princípios de arquitetura (não negociáveis)

1. **O gate é determinístico.** Quem aprova ou reprova o build é Playwright Test + `@axe-core/playwright`. Nenhuma chamada a LLM ou MCP roda dentro do gate.
2. **O MCP é ferramenta de apoio.** O `@playwright/mcp` e os agentes do Playwright (planner, generator, healer) servem para explorar jornadas, gerar testes e fazer triagem, sempre com revisão humana antes do merge.
3. **Configuração, não código.** Páginas, jornadas, régua e modo do gate ficam em arquivos de configuração. Adicionar uma página nova não pode exigir escrever um teste novo.
4. **Baseline obrigatório.** O gate reprova apenas violações **novas** em relação ao baseline versionado. As violações que já existem viram dívida, acompanhada por métricas.
5. **Nada de segredo no repositório.** URLs, usuários e senhas vêm de variáveis de ambiente. Crie um `.env.example` e coloque `.env` e `storageState` no `.gitignore`.
6. **Automação não substitui teste manual.** O README deve deixar isso explícito.

## 3. Stack

- Node.js LTS + TypeScript
- `@playwright/test`
- `@axe-core/playwright`
- `@playwright/mcp` (uso local, via `.mcp.json`)
- `dotenv`
- Sem frameworks extras sem necessidade.

## 4. Estrutura alvo

```
a11y-automation/
├── .mcp.json                     # Playwright MCP para uso local
├── .env.example
├── a11y.config.ts                # régua, páginas, jornadas, modo do gate
├── playwright.config.ts
├── fixtures/
│   └── a11y.ts                   # fixture makeAxe + helpers de scan
├── lib/
│   ├── scan.ts                   # executa axe, anexa resultado, coleta violações
│   ├── fingerprint.ts            # identificador estável de violação
│   ├── baseline.ts               # ler/gravar/comparar baseline
│   └── gate.ts                   # aplica regra do modo do gate
├── tests/
│   ├── auth.setup.ts             # login → storageState
│   ├── pages.a11y.spec.ts        # scan parametrizado das páginas do config
│   ├── journeys/
│   │   └── *.a11y.spec.ts        # jornadas com scan a cada passo/estado
│   ├── keyboard/
│   │   └── *.kbd.spec.ts         # navegação por teclado
│   └── selftest/
│       └── gate.selftest.spec.ts # valida o próprio gate contra a página demo
├── demo/
│   ├── acessivel.html            # página sem violações
│   └── quebrada.html             # página com violações conhecidas
├── baseline/
│   └── violations.json
├── scripts/
│   ├── update-baseline.ts
│   └── report.ts                 # gera summary.md + metrics.json
├── .gitlab-ci.yml                # pipeline GitLab CI
└── README.md
```

## 5. Configuração central (`a11y.config.ts`)

O arquivo deve conter:

- `wcagTags`: `['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']`
- `gateMode`: `'report' | 'critical' | 'serious'`, sobrescrito pela env `A11Y_GATE_MODE`
  - `report`: nunca reprova, só gera relatório
  - `critical`: reprova violações novas de impacto `critical`
  - `serious`: reprova violações novas de impacto `critical` ou `serious`
- `pages`: lista de `{ name, path, requiresAuth, waitFor?, exclude? }`
- `globalExclude`: seletores excluídos de todos os scans (ex.: widgets de terceiros), **cada um com um comentário explicando o motivo**
- `disabledRules`: regras desligadas, também **com o motivo**

## 6. Fases

### Fase 1: Fundação e scanner (POC)

**Tarefas**
- Criar o projeto (TypeScript, Playwright Test, axe, dotenv) e o `.env.example` com `BASE_URL`, `A11Y_USER`, `A11Y_PASSWORD` e `A11Y_GATE_MODE`.
- Criar `playwright.config.ts` com:
  - projeto `setup` (auth) e projeto `a11y` (dependente do setup quando `requiresAuth`);
  - projeto `a11y-mobile-reflow` com viewport de 320×640, para o critério 1.4.10;
  - `webServer` servindo `demo/` localmente, para os autotestes;
  - reporter `html` + `json` + `junit` (o `junit` é para o widget de testes do Merge Request no GitLab).
- Criar `fixtures/a11y.ts` com `makeAxe()` já configurado a partir do `a11y.config.ts`.
- Criar `lib/scan.ts`: roda o axe, anexa o JSON completo ao relatório (`testInfo.attach`) e retorna as violações normalizadas.
- Criar `tests/pages.a11y.spec.ts`, parametrizado pelas `pages` do config.
- Criar `demo/acessivel.html` e `demo/quebrada.html`. A página quebrada deve ter: imagem sem alt, input sem label, contraste baixo, botão sem nome acessível e `lang` ausente.

**Critérios de aceite**
- `npx playwright test --project=a11y` roda contra as páginas demo.
- `acessivel.html` passa sem violações e `quebrada.html` mostra as violações esperadas.
- O relatório HTML mostra o JSON do axe anexado em cada teste.

### Fase 2: Autenticação e jornadas com estados

**Tarefas**
- `tests/auth.setup.ts`: faz login usando as variáveis de ambiente e salva o `storageState` (fora do git).
- Criar um modelo de jornada em `tests/journeys/`, com scan **depois de cada interação relevante**: modal aberto, erro de validação de formulário, menu expandido, mensagem de sucesso.
- Criar `tests/keyboard/`: percorrer a jornada só com `Tab`/`Shift+Tab`/`Enter` e verificar se:
  - o foco chega ao CTA principal;
  - não existe armadilha de foco (o foco não fica preso);
  - o foco é visível (o elemento focado tem outline ou estilo de foco).
- Usar `expect(locator).toMatchAriaSnapshot()` em 1 ou 2 componentes críticos, para travar nome, papel e ordem.

**Critérios de aceite**
- Uma jornada de exemplo funcionando contra o demo, com pelo menos 3 scans em estados diferentes.
- O teste de teclado falha na `quebrada.html` (crie um caso de armadilha de foco ou de CTA inalcançável).

### Fase 3: Baseline, fingerprint e métricas

**Tarefas**
- `lib/fingerprint.ts`: identificador estável = `ruleId + pageName/state + seletor alvo normalizado` (sem índices voláteis tipo `nth-child` quando for possível).
- `lib/baseline.ts`: ler, comparar e gravar `baseline/violations.json`, separando os resultados em **novas**, **existentes** e **corrigidas**.
- `scripts/update-baseline.ts` + script npm `a11y:baseline`. Atualizar o baseline é ação explícita e manual, e o diff vai para code review.
- `lib/gate.ts`: aplica o `gateMode` **somente sobre as violações novas**.
- `scripts/report.ts`: depois da execução, gera:
  - `reports/summary.md`: tabela por página com violações por impacto, as novas em destaque e as corrigidas;
  - `reports/metrics.json`: totais por impacto, por página, por critério WCAG, % de páginas sem `critical`, data e commit.

**Critérios de aceite**
- Com o baseline gerado a partir da `quebrada.html`, uma nova execução passa em qualquer modo.
- Ao introduzir uma violação nova no demo, a execução reprova nos modos `critical`/`serious` (conforme o impacto) e passa em `report`.
- Ao corrigir uma violação, o `summary.md` lista como "corrigida".

### Fase 4: Gate na esteira (GitLab CI)

**Tarefas**
- Criar o `.gitlab-ci.yml` na raiz:
  1. usar a imagem oficial `mcr.microsoft.com/playwright:<versão>-noble`, **com a mesma versão do `@playwright/test` do `package.json`**;
  2. criar os stages `selftest` → `a11y` → `report`;
  3. rodar `npm ci` + os testes, com `A11Y_GATE_MODE`, `BASE_URL`, `A11Y_USER` e `A11Y_PASSWORD` vindos das **CI/CD Variables** do projeto. Usuário e senha devem ser *masked* e *protected*;
  4. publicar como `artifacts` (com `when: always` e `expire_in` definido) o `playwright-report/`, o `reports/summary.md` e o `reports/metrics.json`;
  5. adicionar um reporter `junit` no Playwright e publicar em `artifacts:reports:junit`, para os resultados aparecerem no widget de testes do Merge Request;
  6. criar regras (`rules`) para rodar em Merge Requests e na branch principal;
  7. opcional: postar o `summary.md` como comentário no MR via API do GitLab, usando um token de projeto numa variável mascarada (`A11Y_BOT_TOKEN`). Se não houver token, pular sem falhar.
- Documentar no README como configurar as variáveis em *Settings → CI/CD → Variables*.
- Criar `tests/selftest/gate.selftest.spec.ts`, que garante que o gate continua reprovando a página quebrada. É um teste de regressão do próprio gate. Ele roda no stage `selftest`.

**Estratégia de ativação (documentar no README)**
1. Semanas 1 e 2: `report`
2. Depois: `critical`
3. Depois: `serious`
4. Reduzir o baseline aos poucos, com meta por trimestre

**Critérios de aceite**
- O pipeline roda do zero num runner limpo.
- Os artefatos ficam disponíveis mesmo quando o job falha.

### Fase 5: Apoio com IA (MCP + agentes)

**Tarefas**
- Criar o `.mcp.json` com o Playwright MCP:
  ```json
  { "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } } }
  ```
- Rodar `npx playwright init-agents` para o Claude Code. Confira a opção correta com `npx playwright init-agents --help`.
- Criar `docs/prompts-ia.md` com prompts prontos para:
  1. **Exploração assistida:** navegar uma jornada via MCP, fazer snapshot de acessibilidade e apontar o que o axe não pega (nomes genéricos como "clique aqui", ordem de leitura ilógica, rótulos ambíguos, headings fora de ordem).
  2. **Geração:** pedir ao planner/generator um spec de jornada que use a fixture `makeAxe` e escaneie cada estado.
  3. **Triagem:** a partir do JSON do axe, explicar cada violação para o dev (critério WCAG, impacto, correção sugerida com código).
- Documentar no README que **os testes gerados por agentes passam por revisão humana** antes do merge.

**Critérios de aceite**
- O MCP funciona localmente no Claude Code.
- Existe pelo menos 1 spec de jornada gerado com apoio dos agentes, revisado e passando.

## 7. Scripts npm esperados

| Script | Ação |
|---|---|
| `a11y` | roda todos os testes de acessibilidade |
| `a11y:pages` | só o scan de páginas |
| `a11y:journeys` | só as jornadas |
| `a11y:kbd` | só os testes de teclado |
| `a11y:baseline` | regrava o baseline |
| `a11y:report` | gera summary.md + metrics.json |
| `a11y:selftest` | valida o gate contra o demo |

## 8. README deve conter

- O que o projeto mede e o que **não** mede (limites da automação)
- Como rodar localmente
- Como adicionar uma página ou jornada (só editando o config)
- Como funcionam o baseline e o gate, e como fazer a ativação progressiva
- Como usar o MCP e os agentes, e a regra de revisão humana
- Glossário de impactos do axe (`minor`, `moderate`, `serious`, `critical`)

## 9. Fora do escopo (por enquanto)

- Apps nativos iOS/Android (ficam na LambdaTest e nas ferramentas nativas)
- Dashboard visual: por enquanto, o `metrics.json` pode alimentar uma ferramenta externa
- Testes com usuários reais
