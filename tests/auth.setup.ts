import { test as setup } from '@playwright/test';
import { a11yConfig } from '../a11y.config';

/**
 * Login → storageState (.auth/user.json, fora do git).
 * O fluxo de login real é implementado na Fase 2. Sem páginas com requiresAuth, não faz nada.
 */
setup('autenticação', async () => {
  const needsAuth = a11yConfig.pages.some((p) => p.requiresAuth);
  setup.skip(!needsAuth, 'Nenhuma página com requiresAuth no a11y.config.ts');

  throw new Error('Há páginas com requiresAuth, mas o login ainda não foi implementado (Fase 2).');
});
