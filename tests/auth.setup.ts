import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { a11yConfig } from '../a11y.config';
import { STORAGE_STATE, getCredentials } from '../lib/env';

/**
 * Login → storageState (.auth/user.json, fora do git).
 * Credenciais vêm de A11Y_USER / A11Y_PASSWORD; seletores vêm de `auth` no a11y.config.ts.
 * Sem páginas com requiresAuth, o setup é pulado.
 */
setup('autenticação', async ({ page }) => {
  setup.skip(!a11yConfig.pages.some((p) => p.requiresAuth), 'Nenhuma página com requiresAuth no a11y.config.ts');

  const auth = a11yConfig.auth!; // garantido pela validação do config
  const { user, password } = getCredentials();

  await page.goto(auth.loginPath);
  await page.locator(auth.userField).fill(user);
  await page.locator(auth.passwordField).fill(password);
  await page.locator(auth.submit).click();
  await expect(page.locator(auth.successWaitFor), 'Login não concluído: verifique credenciais e seletores de `auth`').toBeVisible();

  await mkdir(dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
