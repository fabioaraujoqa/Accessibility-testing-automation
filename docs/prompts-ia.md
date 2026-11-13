# Prompts de IA para acessibilidade (MCP + agentes do Playwright)

A IA é **ferramenta de apoio**, nunca parte do gate. Quem aprova ou reprova o build é só o
Playwright Test + axe-core. Use estes prompts no Claude Code, na raiz do repositório.

## Regras (valem para todos os prompts)

1. **Todo teste gerado ou alterado por IA passa por revisão humana antes do merge.** No MR/PR, diga que
   o teste teve apoio de IA.
2. **A IA nunca afrouxa o gate:** não remove scans, não adiciona `exclude`/`disabledRules`, não regrava o
   baseline e não troca asserções por versões mais fracas. Se achar que é falso positivo, ela **propõe** e
   um humano decide (com motivo no `a11y.config.ts`).
3. **Só ambiente de teste e usuário de teste.** Nunca aponte o MCP para produção com conta real. O
   servidor MCP consegue executar código no navegador (`browser_run_code_unsafe`) e ler cookies e storage.
4. **Achado de IA não é violação confirmada.** Ele vira item de auditoria manual ou teste automatizado,
   depois de alguém verificar.

## Configuração

- [.mcp.json](../.mcp.json) declara dois servidores:
  - `playwright` (`@playwright/mcp`): navegador controlado pela IA, para exploração.
  - `playwright-test`: o test runner do projeto, usado pelos agentes (mesma versão do `@playwright/test`).
- [.claude/agents/](../.claude/agents/) tem os agentes gerados por `npx playwright init-agents --loop=claude`:
  `playwright-test-planner`, `playwright-test-generator` e `playwright-test-healer`.
- Na primeira vez, o Claude Code pede para aprovar os servidores MCP do projeto. Confira com `/mcp` e veja
  os agentes com `/agents`.
- Os agentes partem de [tests/seed.spec.ts](../tests/seed.spec.ts), que usa a fixture `makeAxe` do projeto.

---

## 1. Exploração assistida (o que o axe não pega)

Use o servidor `playwright`. Troque `<URL>` e `<JORNADA>`.

```text
Use o MCP "playwright" para explorar a jornada "<JORNADA>" a partir de <URL> (ambiente de teste).
Navegue como um usuário faria e, em cada tela e em cada estado relevante (menu aberto, modal,
erro de formulário, sucesso), faça browser_snapshot e analise a árvore de acessibilidade.

Procure SOMENTE o que o axe-core não detecta automaticamente:
- links e botões com nome genérico ("clique aqui", "saiba mais", "ver") ou repetido com destinos diferentes;
- ordem de leitura ilógica (a ordem do snapshot não segue a ordem visual/lógica);
- rótulos ambíguos ou que não descrevem o campo; instruções que dependem de cor/posição;
- headings fora de ordem ou que não descrevem a seção; página sem h1;
- mensagens de erro/sucesso que não são anunciadas (sem role=alert/status ou live region);
- foco: ao abrir modal/menu o foco vai para ele? ao fechar, volta ao gatilho?
- nome acessível que não contém o texto visível (WCAG 2.5.3).

Não invente: todo achado precisa citar o trecho do snapshot como evidência. Se não houver
evidência, não reporte. Não altere nenhum arquivo do repositório.

Responda com uma tabela: Tela/estado | Critério WCAG 2.2 | Evidência (trecho do snapshot) |
Severidade sugerida (critical/serious/moderate/minor) | Sugestão de correção.
No final, liste o que precisa de verificação manual com leitor de tela.
```

## 2. Geração de spec de jornada (planner → generator)

Use os agentes. Troque `<JORNADA>`, `<URL_OU_CAMINHO>` e `<arquivo>`.

```text
Use o agente playwright-test-planner para planejar a jornada "<JORNADA>" a partir de
<URL_OU_CAMINHO>, partindo do seed tests/seed.spec.ts. Liste os estados relevantes
(inicial, menu expandido, modal aberto, erro de validação, sucesso...) e salve o plano em specs/.

Depois use o agente playwright-test-generator para gerar tests/journeys/<arquivo>.a11y.spec.ts
seguindo EXATAMENTE o padrão de tests/journeys/cadastro.a11y.spec.ts:
- importar test/expect de '../../fixtures/a11y' e createJourney de '../../lib/journey';
- `const journey = createJourney({ page, testInfo, makeAxe, name: '<jornada>' })`;
- `await journey.scan('inicial')` (página inteira) e, depois de cada interação relevante,
  `await journey.scan('<estado>', { include: '<seletor do trecho que mudou>' })`;
- antes de cada scan, esperar o estado com expect(...).toBeVisible()/toHaveAttribute(...);
- locators por papel/rótulo (getByRole, getByLabel), sem seletores CSS frágeis nem waitForTimeout;
- toMatchAriaSnapshot em 1 ou 2 componentes críticos;
- terminar com `await journey.expectGate()`;
- nenhuma credencial no código (login vem do projeto setup / storageState).

Rode o teste gerado e mostre o resultado. Não altere a11y.config.ts, baseline/ nem lib/.
```

## 3. Triagem de violações para o dev

Use depois de uma execução (`npm run a11y && npm run a11y:report`).

```text
Leia reports/summary.md e, para detalhes, o anexo axe-*.json do teste correspondente no relatório
(reports/results.json). Para cada violação NOVA, explique para um dev:
1. o critério WCAG 2.2 e o que ele exige, em uma frase;
2. quem é afetado e como (ex.: usuário de leitor de tela não sabe o que o botão faz);
3. a correção, com código antes/depois baseado no HTML real da violação;
4. como verificar manualmente que ficou certo (teclado, leitor de tela, zoom...).

Ordene por impacto (critical primeiro). Agrupe ocorrências com a mesma causa (ex.: mesmo componente).
Não sugira exclude/disableRules; se suspeitar de falso positivo, explique o porquê e marque
"para decisão humana". Não altere arquivos.
```

## 4. Manutenção de teste quebrado (healer)

```text
Use o agente playwright-test-healer para corrigir tests/journeys/<arquivo>.a11y.spec.ts, que quebrou
por mudança de interface. Pode ajustar locators e esperas. NÃO pode remover ou reduzir scans
(journey.scan), remover journey.expectGate(), trocar toMatchAriaSnapshot por algo mais fraco,
marcar o teste como skip/fixme, nem mexer em a11y.config.ts, baseline/ ou lib/.
Se o teste quebrou porque a interface ficou MENOS acessível (ex.: botão perdeu o nome), não "conserte"
o teste: reporte o problema.
```
