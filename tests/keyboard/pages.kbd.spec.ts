import { test, expect } from '@playwright/test';
import { a11yConfig } from '../../a11y.config';
import { STORAGE_STATE } from '../../lib/env';
import { formatWalk, tabTo, walkKeyboard } from '../../lib/keyboard';

/**
 * Navegação só por teclado, parametrizada pelas páginas do a11y.config.ts que têm `keyboard`.
 *   - WCAG 2.1.1 Teclado: o CTA principal é alcançável com Tab
 *   - WCAG 2.1.2 Sem armadilha: Tab e Shift+Tab percorrem a página inteira e saem dela
 *   - WCAG 2.4.7 Foco visível: todo elemento focado tem indicador (outline/box-shadow)
 *   - Enter aciona o CTA (quando `afterEnter` está configurado)
 */
for (const pageConfig of a11yConfig.pages.filter((p) => p.keyboard)) {
  const kbd = pageConfig.keyboard!;

  test.describe(pageConfig.name, () => {
    if (pageConfig.requiresAuth) test.use({ storageState: STORAGE_STATE });

    test(`teclado: ${pageConfig.name}`, { tag: ['@a11y', '@kbd'] }, async ({ page }, testInfo) => {
      await page.goto(pageConfig.path);
      if (pageConfig.waitFor) await page.locator(pageConfig.waitFor).first().waitFor();

      const forward = await walkKeyboard(page, { key: 'Tab', ctaSelector: kbd.cta });
      const backward = await walkKeyboard(page, { key: 'Shift+Tab', ctaSelector: kbd.cta });
      await testInfo.attach('ordem-de-foco.txt', {
        body: `Tab (${forward.tabbableCount} focáveis):\n${formatWalk(forward)}\n\nShift+Tab:\n${formatWalk(backward)}`,
        contentType: 'text/plain',
      });

      expect.soft(forward.escaped, `Armadilha de foco (Tab): o foco não saiu da página.\n${formatWalk(forward)}`).toBe(true);
      expect.soft(backward.escaped, `Armadilha de foco (Shift+Tab): o foco não saiu da página.\n${formatWalk(backward)}`).toBe(true);
      expect.soft(forward.ctaReached, `CTA "${kbd.cta}" não é alcançável com Tab.\n${formatWalk(forward)}`).toBe(true);
      expect.soft(forward.invisibleFocus, 'Elementos com foco sem indicador visível').toEqual([]);

      if (kbd.afterEnter && forward.ctaReached) {
        await page.reload();
        expect(await tabTo(page, kbd.cta)).toBe(true);
        await page.keyboard.press('Enter');
        await expect.soft(page.locator(kbd.afterEnter), 'Enter no CTA não produziu o efeito esperado').toBeVisible();
      }
    });
  });
}
