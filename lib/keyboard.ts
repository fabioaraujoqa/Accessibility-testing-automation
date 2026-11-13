import type { Page } from '@playwright/test';

/** Um passo da navegação por teclado: qual elemento recebeu o foco e se o foco está visível. */
export interface FocusStep {
  step: number;
  key: string;
  /** Descrição legível do elemento focado (ex.: 'button#cta-continuar "Continuar"'). */
  element: string;
  /** Foco saiu do documento (voltou ao <body> / barra do navegador). */
  leftDocument: boolean;
  /** O elemento focado é o CTA principal. */
  isCta: boolean;
  /** Há indicador visual de foco (outline ou box-shadow). */
  focusVisible: boolean;
}

export interface KeyboardWalk {
  key: 'Tab' | 'Shift+Tab';
  steps: FocusStep[];
  /** Quantos elementos focáveis visíveis a página tem (limite do percurso = isso + folga). */
  tabbableCount: number;
  /** Chegou ao fim da página (o foco saiu do documento). Se false, há armadilha de foco. */
  escaped: boolean;
  ctaReached: boolean;
  /** Elementos que receberam foco sem indicador visível. */
  invisibleFocus: string[];
}

const TABBABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable="true"]';

async function countTabbables(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    return [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.checkVisibility({ visibilityProperty: true }),
    ).length;
  }, TABBABLE);
}

async function describeFocus(page: Page, ctaSelector: string | undefined) {
  return page.evaluate((cta) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) {
      return { element: '<body>', leftDocument: true, isCta: false, focusVisible: true };
    }
    const style = getComputedStyle(el);
    const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const hasShadow = style.boxShadow !== 'none';
    const id = el.id ? `#${el.id}` : '';
    const label = (el.getAttribute('aria-label') ?? el.textContent ?? (el as HTMLInputElement).name ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return {
      element: `${el.tagName.toLowerCase()}${id}${label ? ` "${label}"` : ''}`,
      leftDocument: false,
      isCta: cta ? el.matches(cta) : false,
      focusVisible: hasOutline || hasShadow,
    };
  }, ctaSelector);
}

/**
 * Posiciona o ponto de partida da navegação sequencial no início (Tab) ou no fim (Shift+Tab) do <body>.
 * blur() não basta: o Chromium guarda o último elemento focado como ponto de partida.
 * Usa um sentinela com tabindex=-1 (recebe foco programático, mas nunca entra na ordem de Tab).
 */
async function placeStartingPoint(page: Page, key: 'Tab' | 'Shift+Tab') {
  await page.evaluate((atEnd) => {
    document.getElementById('__a11y-kbd-start')?.remove();
    const sentinel = document.createElement('span');
    sentinel.id = '__a11y-kbd-start';
    sentinel.tabIndex = -1;
    if (atEnd) document.body.append(sentinel);
    else document.body.prepend(sentinel);
    sentinel.focus();
  }, key === 'Shift+Tab');
}

/**
 * Percorre a página só com Tab (ou Shift+Tab), a partir do topo, registrando cada foco.
 * Para quando o foco sai do documento (fim normal) ou quando estoura o limite (armadilha).
 * Não faz asserções: só coleta fatos, para o teste decidir.
 */
export async function walkKeyboard(
  page: Page,
  options: { key?: 'Tab' | 'Shift+Tab'; ctaSelector?: string; slack?: number } = {},
): Promise<KeyboardWalk> {
  const key = options.key ?? 'Tab';
  const tabbableCount = await countTabbables(page);
  const maxSteps = tabbableCount + (options.slack ?? 5);

  await placeStartingPoint(page, key);

  const steps: FocusStep[] = [];
  let escaped = false;
  for (let step = 1; step <= maxSteps; step++) {
    await page.keyboard.press(key);
    const info = await describeFocus(page, options.ctaSelector);
    steps.push({ step, key, ...info });
    if (info.leftDocument) {
      escaped = true;
      break;
    }
  }

  await page.evaluate(() => document.getElementById('__a11y-kbd-start')?.remove());

  const invisibleFocus = [...new Set(steps.filter((s) => !s.leftDocument && !s.focusVisible).map((s) => s.element))];
  return { key, steps, tabbableCount, escaped, ctaReached: steps.some((s) => s.isCta), invisibleFocus };
}

/** Leva o foco até o CTA só com Tab. Retorna false se não conseguir. */
export async function tabTo(page: Page, ctaSelector: string): Promise<boolean> {
  const walk = await walkKeyboard(page, { ctaSelector });
  const idx = walk.steps.findIndex((s) => s.isCta);
  if (idx < 0) return false;
  // walkKeyboard passou do CTA; refaz até ele.
  await placeStartingPoint(page, 'Tab');
  for (let i = 0; i <= idx; i++) await page.keyboard.press('Tab');
  return true;
}

export function formatWalk(walk: KeyboardWalk): string {
  return walk.steps
    .map((s) => `${String(s.step).padStart(2)}. ${s.key.padEnd(9)} → ${s.element}${s.isCta ? '  ◀ CTA' : ''}${!s.leftDocument && !s.focusVisible ? '  ⚠ foco invisível' : ''}`)
    .join('\n');
}
