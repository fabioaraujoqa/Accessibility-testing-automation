import { test, expect } from '../../fixtures/a11y';
import { IS_DEMO_TARGET } from '../../lib/env';
import { compare, toEntries, type Baseline } from '../../lib/baseline';
import { applyGate } from '../../lib/gate';
import { scan } from '../../lib/scan';

/**
 * Teste de regressão do PRÓPRIO gate, contra demo/quebrada.html.
 * Independe do A11Y_GATE_MODE do ambiente e do baseline versionado: monta baselines em memória.
 * Se este teste falhar, o gate deixou de proteger o build (ex.: upgrade do axe mudou regras/seletores).
 */
const EXPECTED = ['button-name', 'color-contrast', 'html-has-lang', 'image-alt', 'label'];
const EXPECTED_CRITICAL = ['button-name', 'image-alt', 'label'];
const CONTEXT = 'selftest-quebrada';

const baselineOf = (entries: Baseline['entries']): Baseline => ({ _comment: '', updatedAt: '', commit: null, entries });
const ids = (list: { ruleId: string }[]) => [...new Set(list.map((v) => v.ruleId))].sort();

test.describe('autoteste do gate', () => {
  test.skip(!IS_DEMO_TARGET, 'Autoteste do demo.');

  test('página acessível não gera violações', { tag: ['@selftest'] }, async ({ page, makeAxe }, testInfo) => {
    await page.goto('/acessivel.html');
    const { violations } = await scan({ page, testInfo, makeAxe, context: 'selftest-acessivel' });
    expect(violations).toEqual([]);
  });

  test('reprova a quebrada conforme o modo e respeita o baseline', { tag: ['@selftest'] }, async ({ page, makeAxe }, testInfo) => {
    await page.goto('/quebrada.html');
    const { violations } = await scan({ page, testInfo, makeAxe, context: CONTEXT });

    await test.step('detecta as 5 violações plantadas', () => {
      expect(ids(violations)).toEqual(EXPECTED);
    });

    await test.step('sem baseline: report passa, critical e serious reprovam', () => {
      const { newViolations } = compare(violations, [CONTEXT], baselineOf([]));
      expect(newViolations).toHaveLength(violations.length);
      expect(applyGate(newViolations, 'report').passed).toBe(true);
      expect(ids(applyGate(newViolations, 'critical').blocking)).toEqual(EXPECTED_CRITICAL);
      expect(ids(applyGate(newViolations, 'serious').blocking)).toEqual(EXPECTED);
    });

    const baseline = baselineOf(toEntries(violations));

    await test.step('com baseline: nada é novo, nenhum modo reprova', () => {
      const { newViolations, existing } = compare(violations, [CONTEXT], baseline);
      expect(newViolations).toEqual([]);
      expect(existing).toHaveLength(violations.length);
      expect(applyGate(newViolations, 'serious').passed).toBe(true);
    });

    await test.step('violação nova (link vazio, serious) é detectada como nova', async () => {
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.href = '/novo';
        document.querySelector('main')!.append(a);
      });
      const after = (await scan({ page, testInfo, makeAxe, context: CONTEXT })).violations;
      const { newViolations } = compare(after, [CONTEXT], baseline);
      expect(ids(newViolations)).toEqual(['link-name']);
      expect(applyGate(newViolations, 'critical').passed).toBe(true);
      expect(applyGate(newViolations, 'serious').passed).toBe(false);
    });

    await test.step('violação corrigida (img ganha alt) aparece como corrigida', async () => {
      await page.evaluate(() => document.querySelector('img')!.setAttribute('alt', 'Banco Demo'));
      const after = (await scan({ page, testInfo, makeAxe, context: CONTEXT })).violations;
      const { fixed } = compare(after, [CONTEXT], baseline);
      expect(ids(fixed)).toEqual(['image-alt']);
    });
  });
});
