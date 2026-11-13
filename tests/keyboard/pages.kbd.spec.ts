import { test } from '@playwright/test';
import { a11yConfig } from '../../a11y.config';
import { STORAGE_STATE } from '../../lib/env';
import { gate } from '../../lib/gate';
import { formatWalk, keyboardViolations, tabTo, walkKeyboard } from '../../lib/keyboard';
import type { NormalizedViolation } from '../../lib/scan';

/**
 * Navegação só por teclado, parametrizada pelas páginas do a11y.config.ts que têm `keyboard`.
 *   - WCAG 2.1.1 Teclado: o CTA principal é alcançável com Tab
 *   - WCAG 2.1.2 Sem armadilha: Tab e Shift+Tab percorrem a página inteira e saem dela
 *   - WCAG 2.4.7 Foco visível: todo elemento focado tem indicador (outline/box-shadow)
 *   - Enter aciona o CTA (quando `afterEnter` está configurado)
 * Os achados viram violações e passam pelo baseline + gateMode, como as do axe.
 */
for (const pageConfig of a11yConfig.pages.filter((p) => p.keyboard)) {
  const kbd = pageConfig.keyboard!;
  const context = `${pageConfig.name}#teclado`;

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

      const violations: NormalizedViolation[] = keyboardViolations(context, forward, backward, kbd.cta);

      if (kbd.afterEnter && forward.ctaReached) {
        await page.reload();
        if (pageConfig.waitFor) await page.locator(pageConfig.waitFor).first().waitFor();
        await tabTo(page, kbd.cta);
        await page.keyboard.press('Enter');
        const effect = await page
          .locator(kbd.afterEnter)
          .first()
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true, () => false);
        if (!effect) {
          violations.push({
            ruleId: 'custom-kbd-enter-no-effect',
            impact: 'serious',
            context,
            target: kbd.cta,
            help: `Enter no CTA (${kbd.cta}) não produziu o efeito esperado (${kbd.afterEnter})`,
            helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
            wcag: ['wcag2a', 'wcag211'],
            html: '',
          });
        }
      }

      await gate(testInfo, [context], violations);
    });
  });
}
