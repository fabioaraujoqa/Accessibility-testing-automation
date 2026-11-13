// spec: specs/login-area-logada.md (Cenário 1)
// seed: tests/seed.spec.ts
//
// Gerado com apoio dos agentes do Playwright (planner + generator) e revisado:
//  - adicionados os scans de acessibilidade por estado e o gate (o generator só grava interações);
//  - URL absoluta (localhost:4173) trocada por caminho relativo ao baseURL;
//  - skip fora do alvo demo, tags e toMatchAriaSnapshot no formulário de login.

import { test, expect } from '../../fixtures/a11y';
import { IS_DEMO_TARGET } from '../../lib/env';
import { createJourney } from '../../lib/journey';

test.describe('jornada: login → área logada (demo)', () => {
  test.skip(!IS_DEMO_TARGET, 'Jornada do demo; com BASE_URL definida rodam só as jornadas do seu site.');

  test('login com credenciais válidas leva à área logada', { tag: ['@a11y', '@journey'] }, async ({ page, makeAxe }, testInfo) => {
    const journey = createJourney({ page, testInfo, makeAxe, name: 'jornada-login' });

    // 1. Tela de login
    await page.goto('/login.html');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    const usuario = page.getByRole('textbox', { name: 'Usuário' });
    const senha = page.getByRole('textbox', { name: 'Senha' });
    const entrar = page.getByRole('button', { name: 'Entrar' });
    await expect(usuario).toBeVisible();
    await expect(senha).toBeVisible();
    await expect(entrar).toBeVisible();
    await journey.scan('login-inicial');
    // Trava nome, papel e ordem do formulário de login (componente crítico).
    await expect(page.locator('#form-login')).toMatchAriaSnapshot(`
      - text: Usuário
      - textbox "Usuário"
      - text: Senha
      - textbox "Senha"
      - button "Entrar"
    `);

    // 2. Preencher usuário e senha (credenciais fictícias: o login do demo aceita qualquer valor)
    await usuario.fill('usuario-demo');
    await senha.fill('senha-demo');

    // 3. Enviar
    await entrar.click();

    // 4. Área logada (outra página: scan da página inteira). O h1 é preenchido por script: esperar o texto.
    await expect(page).toHaveURL(/\/area-logada\.html$/);
    await expect(page.getByRole('heading', { name: 'Olá, usuario-demo' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Últimos lançamentos' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Data' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Descrição' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Valor' })).toBeVisible();
    await journey.scan('area-logada');

    await journey.expectGate();
  });
});
