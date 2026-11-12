import type { Page, TestInfo } from '@playwright/test';
import type { AxeResults, ImpactValue, Result } from 'axe-core';
import type { MakeAxe, MakeAxeOptions } from '../fixtures/a11y';

export type Impact = Exclude<ImpactValue, null>;

/** Uma ocorrência de violação (uma regra × um elemento), em formato estável e serializável. */
export interface NormalizedViolation {
  ruleId: string;
  impact: Impact;
  /** Página/estado onde ocorreu (ex.: 'checkout' ou 'checkout/modal-aberto'). */
  context: string;
  /** Seletor do elemento (shadow DOM / iframes unidos por ' >>> '). */
  target: string;
  help: string;
  helpUrl: string;
  /** Tags WCAG da regra (ex.: 'wcag2aa', 'wcag143'). */
  wcag: string[];
  html: string;
  failureSummary?: string;
}

export interface ScanResult {
  context: string;
  violations: NormalizedViolation[];
  /** Resultado bruto do axe (também anexado ao relatório). */
  raw: AxeResults;
}

export interface ScanOptions extends MakeAxeOptions {
  page: Page;
  testInfo: TestInfo;
  makeAxe: MakeAxe;
  /** Identificador da página/estado escaneado. */
  context: string;
}

const flattenTarget = (target: unknown): string =>
  Array.isArray(target) ? target.map(flattenTarget).join(' >>> ') : String(target);

export function normalizeViolations(context: string, results: Result[]): NormalizedViolation[] {
  return results.flatMap((rule) =>
    rule.nodes.map((node) => ({
      ruleId: rule.id,
      // O impacto do nó pode ser mais específico que o da regra.
      impact: (node.impact ?? rule.impact ?? 'minor') as Impact,
      context,
      target: flattenTarget(node.target),
      help: rule.help,
      helpUrl: rule.helpUrl,
      wcag: rule.tags.filter((t) => t.startsWith('wcag')),
      html: node.html,
      failureSummary: node.failureSummary,
    })),
  );
}

/** Roda o axe, anexa o JSON completo ao relatório e devolve as violações normalizadas. */
export async function scan({ page, testInfo, makeAxe, context, ...axeOptions }: ScanOptions): Promise<ScanResult> {
  const raw = await makeAxe(axeOptions).analyze();
  const violations = normalizeViolations(context, raw.violations);

  const slug = context.replace(/[^\w-]+/g, '_');
  await testInfo.attach(`axe-${slug}.json`, {
    body: JSON.stringify(raw, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach(`violacoes-${slug}.json`, {
    body: JSON.stringify(violations, null, 2),
    contentType: 'application/json',
  });

  testInfo.annotations.push({
    type: 'a11y',
    description: `${context}: ${violations.length} ocorrência(s) em ${raw.violations.length} regra(s)${
      raw.violations.length ? ` [${raw.violations.map((v) => `${v.id}:${v.impact}`).join(', ')}]` : ''
    }`,
  });

  return { context, violations, raw };
}

/**
 * WCAG 1.4.10 (Reflow): o axe não detecta rolagem horizontal. Esta checagem complementa o scan
 * no projeto a11y-mobile-reflow (320 px). Retorna uma violação no mesmo formato das do axe.
 */
export async function checkReflow(page: Page, context: string): Promise<NormalizedViolation[]> {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  if (scrollWidth <= viewportWidth) return [];
  return [
    {
      ruleId: 'custom-reflow-horizontal-scroll',
      impact: 'serious',
      context,
      target: 'html',
      help: `Conteúdo exige rolagem horizontal em ${viewportWidth}px (largura do documento: ${scrollWidth}px)`,
      helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
      wcag: ['wcag21aa', 'wcag1410'],
      html: '<html>',
    },
  ];
}
