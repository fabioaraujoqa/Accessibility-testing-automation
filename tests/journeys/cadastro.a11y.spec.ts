import { test, expect } from '../../fixtures/a11y';
import { IS_DEMO_TARGET } from '../../lib/env';
import { createJourney } from '../../lib/journey';

/**
 * Jornada de exemplo (demo/acessivel.html): cadastro com menu, modal, erro de validação e sucesso.
 * MODELO para jornadas reais: copie este arquivo, troque URL/locators e mantenha um scan por estado.
 * Prefira locators por papel/nome (getByRole/getByLabel): eles próprios já validam a acessibilidade.
 */
test.describe('jornada: cadastro (demo)', () => {
  test.skip(!IS_DEMO_TARGET, 'Jornada do demo; com BASE_URL definida rodam só as jornadas do seu site.');

  test('cadastro com menu, modal, erro e sucesso', { tag: ['@a11y', '@journey'] }, async ({ page, makeAxe }, testInfo) => {
    const journey = createJourney({ page, testInfo, makeAxe, name: 'jornada-cadastro' });

    await page.goto('/acessivel.html');
    await journey.scan('inicial');

    // Estado 1: menu expandido
    const botaoMenu = page.getByRole('button', { name: 'Menu' });
    await botaoMenu.click();
    await expect(botaoMenu).toHaveAttribute('aria-expanded', 'true');
    await journey.scan('menu-expandido');
    // Trava papel, nome e ordem do menu (componente crítico de navegação).
    await expect(page.getByRole('navigation', { name: 'Principal' })).toMatchAriaSnapshot(`
      - navigation "Principal":
        - button "Menu" [expanded]
        - list:
          - listitem:
            - link "Início":
              - /url: "#conteudo"
          - listitem:
            - link "Ajuda":
              - /url: "#ajuda"
          - listitem:
            - link "Entrar":
              - /url: login.html
    `);

    // Estado 2: modal aberto
    const abrirTermos = page.getByRole('button', { name: 'Ler os termos de uso' });
    await abrirTermos.click();
    const modal = page.getByRole('dialog', { name: 'Termos de uso' });
    await expect(modal).toBeVisible();
    await journey.scan('modal-aberto');
    // Esc fecha o modal e o foco volta para quem o abriu.
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(abrirTermos).toBeFocused();

    // Estado 3: erro de validação
    await page.getByRole('button', { name: 'Continuar' }).click();
    const resumo = page.getByRole('alert');
    await expect(resumo).toBeVisible();
    await expect(resumo).toBeFocused();
    await expect(page.getByLabel('Nome completo')).toHaveAttribute('aria-invalid', 'true');
    await journey.scan('erro-validacao');
    // Trava a estrutura do resumo de erros (anunciado por leitor de tela via role=alert).
    await expect(resumo).toMatchAriaSnapshot(`
      - alert:
        - heading "Corrija os campos abaixo" [level=2]
        - list:
          - listitem:
            - link "Informe seu nome completo.":
              - /url: "#nome"
          - listitem:
            - link "Informe um e-mail válido, por exemplo nome@dominio.com.":
              - /url: "#email"
    `);

    // Estado 4: sucesso
    await page.getByLabel('Nome completo').fill('Maria da Silva');
    await page.getByLabel('E-mail').fill('maria@exemplo.com');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('status')).toHaveText(/sucesso/);
    await journey.scan('sucesso');

    expect(journey.states.length).toBeGreaterThanOrEqual(3);
    await journey.expectGate();
  });
});
