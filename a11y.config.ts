/**
 * Configuração central da automação de acessibilidade.
 *
 * - Com BASE_URL definida (.env ou CI/CD Variables): escaneia `site` (o seu sistema).
 * - Sem BASE_URL: escaneia `demo` (páginas de demo/ servidas localmente) — autotestes.
 *
 * Adicionar uma página nova = adicionar um item em `site.pages`. Nenhum teste novo é necessário.
 * Toda exclusão (`globalExclude`, `exclude`) e toda regra desligada (`disabledRules`)
 * DEVE ter o motivo documentado no campo `reason`.
 */
import { IS_DEMO_TARGET } from './lib/env';

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

export interface KeyboardCheck {
  /** Seletor do CTA principal, que precisa ser alcançável só com Tab. */
  cta: string;
  /** Opcional: seletor que deve ficar visível depois de acionar o CTA com Enter. */
  afterEnter?: string;
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
  /** Se definido, a página também passa pelo teste de navegação por teclado. */
  keyboard?: KeyboardCheck;
}

export interface AuthConfig {
  /** Caminho da tela de login (relativo à BASE_URL). */
  loginPath: string;
  /** Seletores dos campos e do botão. Usuário/senha vêm de A11Y_USER / A11Y_PASSWORD. */
  userField: string;
  passwordField: string;
  submit: string;
  /** Seletor visível somente após login bem-sucedido. */
  successWaitFor: string;
}

export interface Target {
  pages: PageConfig[];
  /** Obrigatório se alguma página tiver requiresAuth. */
  auth?: AuthConfig;
}

export interface A11yConfig extends Target {
  wcagTags: string[];
  gateMode: GateMode;
  globalExclude: Exclusion[];
  disabledRules: DisabledRule[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEU SITE (usado quando BASE_URL está definida)
// ─────────────────────────────────────────────────────────────────────────────
const site: Target = {
  pages: [
    // Exemplos — ajuste para as jornadas críticas do seu sistema:
    { name: 'home', path: '/', requiresAuth: false },
    // { name: 'login', path: '/login', requiresAuth: false, keyboard: { cta: 'button[type="submit"]' } },
    // { name: 'extrato', path: '/conta/extrato', requiresAuth: true, waitFor: '[data-testid="extrato"]' },
  ],
  // auth: {
  //   loginPath: '/login',
  //   userField: '#usuario',
  //   passwordField: '#senha',
  //   submit: 'button[type="submit"]',
  //   successWaitFor: '[data-testid="menu-usuario"]',
  // },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO (usado sem BASE_URL; páginas em demo/)
// ─────────────────────────────────────────────────────────────────────────────
const demo: Target = {
  pages: [
    {
      name: 'demo-acessivel',
      path: '/acessivel.html',
      requiresAuth: false,
      waitFor: 'main',
      keyboard: { cta: '#cta-continuar', afterEnter: '#resumo-erros' },
    },
    { name: 'demo-quebrada', path: '/quebrada.html', requiresAuth: false, keyboard: { cta: '#cta-continuar' } },
    { name: 'demo-area-logada', path: '/area-logada.html', requiresAuth: true, waitFor: '#saudacao' },
  ],
  auth: {
    loginPath: '/login.html',
    userField: '#usuario',
    passwordField: '#senha',
    submit: 'button[type="submit"]',
    successWaitFor: '#saudacao',
  },
};

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

  ...(IS_DEMO_TARGET ? demo : site),

  globalExclude: [
    // Exemplo de formato (descomente/adapte quando houver widget de terceiro):
    // { selector: '#chat-widget-terceiro', reason: 'Widget do fornecedor X; acessibilidade tratada no contrato, chamado #123.' },
  ],

  disabledRules: [
    // Exemplo de formato:
    // { id: 'regra-x', reason: 'Falso positivo conhecido no axe-core vN (issue github.com/dequelabs/axe-core/issues/NNNN).' },
  ],
};

// ─── Validações (falham cedo, antes de qualquer teste) ───────────────────────
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

if (a11yConfig.pages.some((p) => p.requiresAuth) && !a11yConfig.auth) {
  throw new Error('Há páginas com requiresAuth, mas `auth` não está configurado em a11y.config.ts.');
}
