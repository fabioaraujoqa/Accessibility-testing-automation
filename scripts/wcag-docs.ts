/**
 * Gera reports/REGRAS-WCAG.md a partir do axe-core INSTALADO + checagens próprias do projeto.
 * Roda automaticamente no `npm run a11y:report`: o documento sempre corresponde ao axe que rodou.
 * Não é versionado de propósito (nada para manter à mão).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import axe from 'axe-core';
import ptBR from 'axe-core/locales/pt_BR.json';
import { a11yConfig } from '../a11y.config';

type Level = 'A' | 'AA';
interface Criterion { id: string; level: Level; name: string; manual: string }

/**
 * Critérios de sucesso WCAG 2.2 níveis A e AA (55; o 4.1.1 foi removido na 2.2).
 * Nomes em tradução livre. Texto oficial: https://www.w3.org/TR/WCAG22/
 * `manual`: o que só uma pessoa consegue avaliar nesse critério.
 */
const CRITERIA: Criterion[] = [
  { id: '1.1.1', level: 'A', name: 'Conteúdo não textual', manual: 'Se o texto alternativo descreve de fato a imagem/função.' },
  { id: '1.2.1', level: 'A', name: 'Apenas áudio e apenas vídeo (pré-gravado)', manual: 'Existência e qualidade da transcrição/alternativa.' },
  { id: '1.2.2', level: 'A', name: 'Legendas (pré-gravadas)', manual: 'Existência, sincronia e fidelidade das legendas.' },
  { id: '1.2.3', level: 'A', name: 'Audiodescrição ou mídia alternativa (pré-gravada)', manual: 'Existência e qualidade da audiodescrição.' },
  { id: '1.3.1', level: 'A', name: 'Informações e relações', manual: 'Se a estrutura (títulos, listas, tabelas) corresponde ao que se vê.' },
  { id: '1.3.2', level: 'A', name: 'Sequência significativa', manual: 'Se a ordem de leitura do leitor de tela faz sentido.' },
  { id: '1.3.3', level: 'A', name: 'Características sensoriais', manual: 'Instruções que dependem só de forma, cor, posição ou som.' },
  { id: '1.4.1', level: 'A', name: 'Uso de cor', manual: 'Informação transmitida apenas por cor (ex.: campo com erro só em vermelho).' },
  { id: '1.4.2', level: 'A', name: 'Controle de áudio', manual: 'Áudio que toca sozinho por mais de 3 s sem controle.' },
  { id: '2.1.1', level: 'A', name: 'Teclado', manual: 'Todas as funcionalidades (não só o CTA) operáveis por teclado.' },
  { id: '2.1.2', level: 'A', name: 'Sem armadilha de teclado', manual: 'Componentes complexos (iframes, players, editores).' },
  { id: '2.1.4', level: 'A', name: 'Atalhos de teclado por caractere', manual: 'Atalhos de uma tecla só podem ser desligados/remapeados.' },
  { id: '2.2.1', level: 'A', name: 'Tempo ajustável', manual: 'Sessões e timers: aviso e possibilidade de estender.' },
  { id: '2.2.2', level: 'A', name: 'Pausar, parar, ocultar', manual: 'Carrosséis e animações automáticas com controle de pausa.' },
  { id: '2.3.1', level: 'A', name: 'Três flashes ou abaixo do limite', manual: 'Conteúdo que pisca mais de 3 vezes por segundo.' },
  { id: '2.4.1', level: 'A', name: 'Ignorar blocos', manual: 'Se o link "pular para o conteúdo" funciona de fato.' },
  { id: '2.4.2', level: 'A', name: 'Página com título', manual: 'Se o título descreve a página/etapa.' },
  { id: '2.4.3', level: 'A', name: 'Ordem do foco', manual: 'Se a ordem do foco é lógica (o teste de teclado anexa a ordem para revisão).' },
  { id: '2.4.4', level: 'A', name: 'Finalidade do link (em contexto)', manual: 'Links genéricos ("clique aqui", "saiba mais").' },
  { id: '2.5.1', level: 'A', name: 'Gestos de acionamento', manual: 'Gestos multiponto/de trajetória com alternativa simples.' },
  { id: '2.5.2', level: 'A', name: 'Cancelamento de acionamento', manual: 'Ação disparada no "down" do ponteiro sem como cancelar.' },
  { id: '2.5.3', level: 'A', name: 'Rótulo no nome', manual: 'Se o nome acessível contém o texto visível do rótulo.' },
  { id: '2.5.4', level: 'A', name: 'Acionamento por movimento', manual: 'Funções ativadas por chacoalhar/inclinar o aparelho.' },
  { id: '3.1.1', level: 'A', name: 'Idioma da página', manual: 'Se o idioma declarado é o correto.' },
  { id: '3.2.1', level: 'A', name: 'Em foco', manual: 'Mudança de contexto inesperada ao receber foco.' },
  { id: '3.2.2', level: 'A', name: 'Em entrada', manual: 'Mudança de contexto inesperada ao preencher/selecionar.' },
  { id: '3.2.6', level: 'A', name: 'Ajuda consistente', manual: 'Mecanismos de ajuda na mesma posição relativa entre páginas.' },
  { id: '3.3.1', level: 'A', name: 'Identificação do erro', manual: 'Se o erro é identificado e descrito em texto.' },
  { id: '3.3.2', level: 'A', name: 'Rótulos ou instruções', manual: 'Se rótulos/instruções são claros e suficientes.' },
  { id: '3.3.7', level: 'A', name: 'Entrada redundante', manual: 'Pedir de novo dado já informado na mesma jornada.' },
  { id: '4.1.2', level: 'A', name: 'Nome, função, valor', manual: 'Componentes customizados: estado e mudanças anunciados corretamente.' },
  { id: '1.2.4', level: 'AA', name: 'Legendas (ao vivo)', manual: 'Legendas em transmissões ao vivo.' },
  { id: '1.2.5', level: 'AA', name: 'Audiodescrição (pré-gravada)', manual: 'Existência e qualidade da audiodescrição.' },
  { id: '1.3.4', level: 'AA', name: 'Orientação', manual: 'Conteúdo travado em retrato ou paisagem.' },
  { id: '1.3.5', level: 'AA', name: 'Identificar o propósito de entrada', manual: 'Se o autocomplete corresponde ao dado pedido.' },
  { id: '1.4.3', level: 'AA', name: 'Contraste (mínimo)', manual: 'Texto sobre imagem/gradiente (o axe marca como "revisão manual").' },
  { id: '1.4.4', level: 'AA', name: 'Redimensionar texto', manual: 'Zoom de texto a 200% sem perda de conteúdo.' },
  { id: '1.4.5', level: 'AA', name: 'Imagens de texto', manual: 'Texto renderizado como imagem.' },
  { id: '1.4.10', level: 'AA', name: 'Refluxo', manual: 'Perda de conteúdo/função em 320 px (além da rolagem horizontal).' },
  { id: '1.4.11', level: 'AA', name: 'Contraste não textual', manual: 'Contraste de bordas de campos, ícones e indicador de foco (3:1).' },
  { id: '1.4.12', level: 'AA', name: 'Espaçamento de texto', manual: 'Conteúdo cortado ao aumentar espaçamento de linhas/letras.' },
  { id: '1.4.13', level: 'AA', name: 'Conteúdo em hover ou foco', manual: 'Tooltips/popovers: dispensáveis, hoverable e persistentes.' },
  { id: '2.4.5', level: 'AA', name: 'Várias formas', manual: 'Mais de um caminho para achar uma página (menu, busca, mapa).' },
  { id: '2.4.6', level: 'AA', name: 'Cabeçalhos e rótulos', manual: 'Se títulos e rótulos descrevem o conteúdo.' },
  { id: '2.4.7', level: 'AA', name: 'Foco visível', manual: 'Se o indicador de foco é perceptível (não só se existe).' },
  { id: '2.4.11', level: 'AA', name: 'Foco não obscurecido (mínimo)', manual: 'Elemento focado escondido por header fixo, banner de cookies etc.' },
  { id: '2.5.7', level: 'AA', name: 'Movimentos de arrastar', manual: 'Arrastar com alternativa de clique simples.' },
  { id: '2.5.8', level: 'AA', name: 'Tamanho do alvo (mínimo)', manual: 'Casos de exceção (inline, essencial, equivalente).' },
  { id: '3.1.2', level: 'AA', name: 'Idioma das partes', manual: 'Trechos em outro idioma marcados com lang.' },
  { id: '3.2.3', level: 'AA', name: 'Navegação consistente', manual: 'Menus na mesma ordem entre páginas.' },
  { id: '3.2.4', level: 'AA', name: 'Identificação consistente', manual: 'Mesma função com o mesmo nome entre páginas.' },
  { id: '3.3.3', level: 'AA', name: 'Sugestão de erro', manual: 'Se a mensagem de erro sugere como corrigir.' },
  { id: '3.3.4', level: 'AA', name: 'Prevenção de erros (legais, financeiros, dados)', manual: 'Revisar/confirmar/desfazer antes de transações.' },
  { id: '3.3.8', level: 'AA', name: 'Autenticação acessível (mínimo)', manual: 'Login sem teste cognitivo (CAPTCHA, memorizar), colar senha permitido.' },
  { id: '4.1.3', level: 'AA', name: 'Mensagens de status', manual: 'Se mensagens de sucesso/erro/carregando são anunciadas sem mover o foco.' },
];

/** Checagens próprias do projeto (o que o axe não cobre). Mantenha em sincronia com lib/. */
const CUSTOM: { criterion: string; rule: string; how: string }[] = [
  { criterion: '1.4.10', rule: 'custom-reflow-horizontal-scroll', how: 'Projeto `a11y-mobile-reflow` (320×640): reprova se a largura do documento passa da viewport (rolagem horizontal).' },
  { criterion: '2.1.1', rule: 'custom-kbd-cta-unreachable', how: 'Percorre a página só com Tab; reprova se o CTA configurado (`keyboard.cta`) nunca recebe foco.' },
  { criterion: '2.1.1', rule: 'custom-kbd-enter-no-effect', how: 'Leva o foco ao CTA com Tab, pressiona Enter e espera o efeito configurado (`keyboard.afterEnter`).' },
  { criterion: '2.1.2', rule: 'custom-kbd-focus-trap', how: 'Tab e Shift+Tab precisam sair da página em até (nº de focáveis + 5) passos; se não saem, há armadilha.' },
  { criterion: '2.4.7', rule: 'custom-kbd-focus-not-visible', how: 'Em cada parada do Tab, verifica se o elemento focado tem outline ou box-shadow.' },
  { criterion: '4.1.2', rule: 'toMatchAriaSnapshot', how: 'Nas jornadas, trava papel, nome e ordem de componentes críticos (regressão, não detecção).' },
  { criterion: '2.4.3', rule: 'ordem-de-foco.txt', how: 'A ordem de foco é anexada ao relatório para revisão humana (não é julgada automaticamente).' },
];

// ─── Regras do axe ──────────────────────────────────────────────────────────
axe.configure({ locale: ptBR as unknown as axe.Locale });
const rules = axe.getRules(a11yConfig.wcagTags);
const NOT_RUN = /^(experimental|deprecated)$/;
const runs = (r: (typeof rules)[number]) => !r.tags.some((t) => NOT_RUN.test(t));
const disabled = new Set(a11yConfig.disabledRules.map((r) => r.id));

const toCriterion = (tag: string) => {
  const m = /^wcag(\d)(\d)(\d+)$/.exec(tag);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
};
const criteriaOf = (tags: string[]) => tags.map(toCriterion).filter((c): c is string => !!c);
const levelOf = (tags: string[]) =>
  tags.includes('wcag22aa') ? '2.2 AA' : tags.includes('wcag21aa') ? '2.1 AA' : tags.includes('wcag21a') ? '2.1 A' : tags.includes('wcag2aa') ? '2.0 AA' : '2.0 A';

const axeByCriterion = new Map<string, string[]>();
for (const r of rules.filter(runs)) {
  if (disabled.has(r.ruleId)) continue;
  for (const c of criteriaOf(r.tags)) axeByCriterion.set(c, [...(axeByCriterion.get(c) ?? []), r.ruleId]);
}

// ─── Markdown ───────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md: string[] = [];
const covered = CRITERIA.filter((c) => axeByCriterion.has(c.id) || CUSTOM.some((x) => x.criterion === c.id && x.rule.startsWith('custom-')));

md.push(
  '# Regras WCAG verificadas pela automação',
  '',
  `> Gerado automaticamente (\`npm run a11y:report\`) a partir do **axe-core ${axe.version}** instalado e das checagens próprias do projeto.`,
  '',
  `Régua: **WCAG 2.2 nível AA** (referência da ABNT NBR 17225) · tags do axe: ${a11yConfig.wcagTags.map((t) => `\`${t}\``).join(', ')}`,
  '',
  '## Resumo',
  '',
  `- **${CRITERIA.length}** critérios de sucesso WCAG 2.2 A + AA.`,
  `- **${covered.length}** têm alguma verificação automática (axe ou checagem própria). **${CRITERIA.length - covered.length}** são só manuais.`,
  `- **${rules.filter(runs).length}** regras do axe rodam a cada scan (${rules.length - rules.filter(runs).length} existem para a régua, mas são experimentais/depreciadas e não rodam por padrão).`,
  '- **Ter verificação automática não significa cobertura total do critério.** O axe testa o que é objetivo',
  '  (o atributo existe? o contraste calculado passa?); a qualidade (o alt descreve a imagem? o erro é compreensível?) é sempre humana.',
  '',
  '## Como a verificação funciona',
  '',
  '1. **O Playwright abre a página num Chromium real** (headless), espera o `waitFor` do config e, nas jornadas, executa as interações (abrir menu, modal, enviar formulário...).',
  '2. **O axe-core é injetado na página** e roda sobre o DOM já renderizado (depois do JavaScript), com estilos computados. Cada regra seleciona elementos (ex.: todo `<img>`) e aplica *checks* (ex.: tem `alt`? tem `aria-label`? é decorativo?).',
  '3. **Cada regra retorna, por elemento, um de quatro resultados:**',
  '   - `violations`: falhou. Vira violação com impacto (`critical`, `serious`, `moderate`, `minor`) e entra no baseline/gate.',
  '   - `passes`: passou.',
  '   - `incomplete`: o axe não conseguiu decidir (ex.: contraste de texto sobre imagem). **Não entra no gate**; aparece em "Revisão manual" no `summary.md`.',
  '   - `inapplicable`: não há elementos para a regra na página.',
  '4. **Checagens próprias** cobrem o que o axe não testa: reflow em 320 px e navegação por teclado (tabela abaixo). Elas geram violações `custom-*` no mesmo formato.',
  '5. **O gate** compara as violações com o baseline e reprova só as **novas**, conforme o `A11Y_GATE_MODE`. Ver o README.',
  '',
  '### Checagens próprias do projeto',
  '',
  '| Critério | Regra | Como verifica |',
  '|---|---|---|',
  ...CUSTOM.map((c) => `| ${c.criterion} | \`${c.rule}\` | ${esc(c.how)} |`),
  '',
  '## Cobertura por critério WCAG 2.2 (A e AA)',
  '',
  'Legenda: 🤖 verificação automática (parcial) · 👤 somente manual. A coluna "Sempre manual" lista o que a automação não avalia mesmo quando há regra.',
  '',
  '| Critério | Nível | Nome | | Verificação automática | Sempre manual |',
  '|---|---|---|---|---|---|',
);
for (const c of CRITERIA) {
  const axeRules = (axeByCriterion.get(c.id) ?? []).map((r) => `\`${r}\``);
  const custom = CUSTOM.filter((x) => x.criterion === c.id).map((x) => `\`${x.rule}\``);
  const auto = [...axeRules, ...custom];
  const isAuto = axeRules.length > 0 || custom.some((x) => x.includes('custom-'));
  md.push(`| ${c.id} | ${c.level} | ${c.name} | ${isAuto ? '🤖' : '👤'} | ${auto.join(', ') || '-'} | ${esc(c.manual)} |`);
}
md.push(
  '',
  '## Regras do axe executadas',
  '',
  `Descrições da tradução oficial pt-BR do axe-core (as não traduzidas aparecem em inglês). O impacto de cada ocorrência é definido pelo axe no momento do scan.`,
  '',
  '| Regra | Critérios | Introduzida em | O que verifica |',
  '|---|---|---|---|',
);
for (const r of rules.filter(runs).sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
  const off = disabled.has(r.ruleId) ? ' ⚠️ **desligada no a11y.config.ts**' : '';
  md.push(`| [\`${r.ruleId}\`](${r.helpUrl.split('?')[0]}) | ${criteriaOf(r.tags).join(', ') || '-'} | WCAG ${levelOf(r.tags)} | ${esc(r.description)}${off} |`);
}
md.push(
  '',
  '### Existem para a régua, mas não rodam',
  '',
  '| Regra | Motivo | Critérios |',
  '|---|---|---|',
  ...rules
    .filter((r) => !runs(r))
    .map((r) => `| \`${r.ruleId}\` | ${r.tags.find((t) => NOT_RUN.test(t))} | ${criteriaOf(r.tags).join(', ') || '-'} |`),
  '',
  'Regras experimentais podem ser ligadas explicitamente no `makeAxe` se o time decidir (com motivo no config).',
  '',
);

mkdirSync('reports', { recursive: true });
writeFileSync('reports/REGRAS-WCAG.md', md.join('\n'));
console.log(`✔ reports/REGRAS-WCAG.md gerado (axe-core ${axe.version}: ${rules.filter(runs).length} regras executadas; ${covered.length}/${CRITERIA.length} critérios com verificação automática).`);
