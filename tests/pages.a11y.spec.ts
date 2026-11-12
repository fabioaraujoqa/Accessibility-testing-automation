import { test, expect } from '../fixtures/a11y';
import { a11yConfig } from '../a11y.config';
import { STORAGE_STATE } from '../lib/env';
import { checkReflow, scan } from '../lib/scan';
import { applyGate, formatBlocking } from '../lib/gate';

/**
 * Scan parametrizado: um teste por página do a11y.config.ts.
 * Para adicionar uma página, edite só o config.
 */
for (const pageConfig of a11yConfig.pages) {
  test.describe(pageConfig.name, () => {
    if (pageConfig.requiresAuth) test.use({ storageState: STORAGE_STATE });

    test(`a11y: ${pageConfig.name}`, { tag: ['@a11y', '@pages'] }, async ({ page, makeAxe }, testInfo) => {
      await page.goto(pageConfig.path);
      if (pageConfig.waitFor) await page.locator(pageConfig.waitFor).first().waitFor();

      const isReflow = testInfo.project.name === 'a11y-mobile-reflow';
      const context = isReflow ? `${pageConfig.name}@320px` : pageConfig.name;

      const { violations } = await scan({ page, testInfo, makeAxe, context, exclude: pageConfig.exclude });
      if (isReflow) {
        const reflow = await checkReflow(page, context);
        for (const v of reflow) testInfo.annotations.push({ type: 'a11y', description: `${context}: ${v.ruleId}:${v.impact} — ${v.help}` });
        violations.push(...reflow);
      }

      const gate = applyGate(violations, a11yConfig.gateMode);
      expect(gate.passed, formatBlocking(gate)).toBe(true);
    });
  });
}
