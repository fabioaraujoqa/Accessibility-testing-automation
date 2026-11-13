/**
 * Seed dos agentes do Playwright (planner/generator/healer): é o ponto de partida de todo teste gerado.
 * Usa a fixture do projeto (makeAxe) para que os specs gerados já nasçam com o padrão daqui:
 * scan de acessibilidade por estado (lib/journey.ts) e gate sobre violações novas.
 * Não contém asserções: só prepara a página. Roda no projeto `a11y`.
 */
import { test } from '../fixtures/a11y';

test.describe('seed', () => {
  test('seed', async ({ page }) => {
    // Página inicial do alvo (BASE_URL; sem ela, demo/acessivel.html).
    await page.goto('/');
  });
});
