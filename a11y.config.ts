/**
 * Configuração central da automação de acessibilidade.
 *
 * Adicionar uma página nova = adicionar um item em `pages`. Nenhum teste novo é necessário.
 * Toda exclusão (`globalExclude`, `exclude`) e toda regra desligada (`disabledRules`)
 * DEVE ter o motivo documentado no campo `reason`.
 */

export type GateMode = 'report' | 'critical' | 'serious';

export interface Exclusion {
  /** Seletor CSS excluído do scan. */
  selector: string;
  /** Por que este trecho não é escaneado (obrigatório). */
  reason: string;
}

export interface DisabledRule {
  /** ID da regra do axe-core (ex.: 'color-contrast'). */
  id: string;
  /** Por que a regra está desligada (obrigatório). */
  reason: string;
}

export interface PageConfig {
  /** Nome estável e único; entra no fingerprint da violação (não renomeie à toa). */
  name: string;
  /** Caminho relativo à BASE_URL. */
  path: string;
  /** Exige login (usa o storageState gerado por tests/auth.setup.ts). */
  requiresAuth: boolean;
  /** Seletor que precisa estar visível antes do scan (conteúdo carregado). */
  waitFor?: string;
  /** Exclusões específicas desta página. */
  exclude?: Exclusion[];
}

export interface A11yConfig {
  wcagTags: string[];
  gateMode: GateMode;
  pages: PageConfig[];
  globalExclude: Exclusion[];
  disabledRules: DisabledRule[];
}

const GATE_MODES: readonly GateMode[] = ['report', 'critical', 'serious'];

function resolveGateMode(fallback: GateMode): GateMode {
  const fromEnv = process.env.A11Y_GATE_MODE?.trim();
  if (!fromEnv) return fallback;
  if (!GATE_MODES.includes(fromEnv as GateMode)) {
    throw new Error(`A11Y_GATE_MODE inválido: "${fromEnv}". Use: ${GATE_MODES.join(', ')}.`);
  }
  return fromEnv as GateMode;
}

export const a11yConfig: A11yConfig = {
  // Régua: WCAG 2.2 nível AA (referência da ABNT NBR 17225).
  // O axe acumula: wcag22aa só traz as regras novas da 2.2; as de 2.0/2.1 vêm das outras tags.
  wcagTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],

  // Ativação progressiva: report → critical → serious (ver README).
  gateMode: resolveGateMode('report'),

  // Enquanto não houver URL de homologação, o alvo são as páginas de demo/.
  pages: [
    { name: 'demo-acessivel', path: '/acessivel.html', requiresAuth: false, waitFor: 'main' },
    { name: 'demo-quebrada', path: '/quebrada.html', requiresAuth: false },
  ],

  globalExclude: [
    // Exemplo de formato (descomente/adapte quando houver widget de terceiro):
    // { selector: '#chat-widget-terceiro', reason: 'Widget do fornecedor X; acessibilidade tratada no contrato, chamado #123.' },
  ],

  disabledRules: [
    // Exemplo de formato:
    // { id: 'regra-x', reason: 'Falso positivo conhecido no axe-core vN (issue github.com/dequelabs/axe-core/issues/NNNN).' },
  ],
};

// Proteção contra exclusões/regras sem motivo (princípio da seção 2).
for (const item of [
  ...a11yConfig.globalExclude,
  ...a11yConfig.disabledRules,
  ...a11yConfig.pages.flatMap((p) => p.exclude ?? []),
]) {
  if (!item.reason?.trim()) {
    throw new Error(`Exclusão/regra sem motivo em a11y.config.ts: ${JSON.stringify(item)}`);
  }
}

const names = a11yConfig.pages.map((p) => p.name);
const duplicated = names.filter((n, i) => names.indexOf(n) !== i);
if (duplicated.length) {
  throw new Error(`Nomes de página duplicados em a11y.config.ts: ${duplicated.join(', ')}`);
}
