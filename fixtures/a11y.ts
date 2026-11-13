import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { a11yConfig, type Exclusion } from '../a11y.config';

export interface MakeAxeOptions {
  /** Exclusões adicionais (ex.: as da página), somadas às globais. */
  exclude?: Exclusion[];
  /**
   * Limita o scan a um ou mais trechos da página (ex.: o modal aberto).
   * Nas jornadas, use nos estados depois do inicial para não repetir a dívida da página inteira.
   */
  include?: string | string[];
}

export type MakeAxe = (options?: MakeAxeOptions) => AxeBuilder;

interface A11yFixtures {
  /** Cria um AxeBuilder já configurado com a régua, exclusões e regras desligadas do a11y.config.ts. */
  makeAxe: MakeAxe;
}

export const test = base.extend<A11yFixtures>({
  makeAxe: async ({ page }, use) => {
    await use((options = {}) => {
      let builder = new AxeBuilder({ page }).withTags(a11yConfig.wcagTags);

      for (const { selector } of [...a11yConfig.globalExclude, ...(options.exclude ?? [])]) {
        builder = builder.exclude(selector);
      }
      for (const selector of [options.include ?? []].flat()) builder = builder.include(selector);

      const disabled = a11yConfig.disabledRules.map((r) => r.id);
      if (disabled.length) builder = builder.disableRules(disabled);

      return builder;
    });
  },
});

export { expect } from '@playwright/test';
