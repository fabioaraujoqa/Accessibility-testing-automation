import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, DEMO_PORT, DEMO_URL, IS_DEMO_TARGET } from './lib/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Scan de acessibilidade é determinístico: retry só mascararia instabilidade da página.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  outputDir: 'test-results',

  reporter: [
    // No GitHub Actions, o reporter `github` anota as falhas direto no código do PR.
    process.env.GITHUB_ACTIONS ? ['github'] : ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    // junit: alimenta o widget de testes do Merge Request no GitLab (artifacts:reports:junit).
    ['junit', { outputFile: 'reports/junit.xml' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // Autotestes: garantem que o gate e os detectores continuam funcionando (contra demo/).
      name: 'selftest',
      testMatch: /selftest\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Login → storageState. Só faz algo quando alguma página tem requiresAuth.
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'a11y',
      testMatch: /.*\.a11y\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // WCAG 1.4.10 (Reflow): conteúdo utilizável em 320 px de largura CSS sem rolagem horizontal.
      name: 'a11y-mobile-reflow',
      testMatch: /pages\.a11y\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
      },
    },
    {
      // Navegação só por teclado: CTA alcançável, sem armadilha de foco, foco visível.
      name: 'a11y-kbd',
      testMatch: /.*\.kbd\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Servidor local de demo/: só sobe quando o alvo é o demo (sem BASE_URL).
  webServer: !IS_DEMO_TARGET ? undefined : {
    command: `node scripts/serve-demo.mjs`,
    url: `${DEMO_URL}/acessivel.html`,
    env: { DEMO_PORT: String(DEMO_PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
