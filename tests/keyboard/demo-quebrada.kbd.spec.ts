import { test, expect } from '@playwright/test';
import { IS_DEMO_TARGET } from '../../lib/env';
import { formatWalk, walkKeyboard } from '../../lib/keyboard';

/**
 * Regressão do próprio detector de teclado: em demo/quebrada.html ele PRECISA encontrar
 * os três problemas plantados. Se este teste falhar, o detector parou de detectar.
 */
test.describe('detector de teclado (demo-quebrada)', () => {
  test.skip(!IS_DEMO_TARGET, 'Autoteste do demo.');

  test('detecta armadilha de foco, CTA inalcançável e foco invisível', { tag: ['@kbd', '@selftest'] }, async ({ page }, testInfo) => {
    await page.goto('/quebrada.html');

    const forward = await walkKeyboard(page, { key: 'Tab', ctaSelector: '#cta-continuar' });
    const backward = await walkKeyboard(page, { key: 'Shift+Tab', ctaSelector: '#cta-continuar' });
    await testInfo.attach('ordem-de-foco.txt', {
      body: `Tab:\n${formatWalk(forward)}\n\nShift+Tab:\n${formatWalk(backward)}`,
      contentType: 'text/plain',
    });

    expect.soft(forward.escaped, 'deveria detectar armadilha (Tab)').toBe(false);
    expect.soft(backward.escaped, 'deveria detectar armadilha (Shift+Tab)').toBe(false);
    expect.soft(forward.ctaReached, 'deveria detectar CTA inalcançável').toBe(false);
    expect.soft(forward.invisibleFocus.length, 'deveria detectar foco invisível').toBeGreaterThan(0);
    expect(forward.steps.at(-1)?.element, 'a armadilha deveria ser o campo CEP').toContain('input#cep');
  });
});
