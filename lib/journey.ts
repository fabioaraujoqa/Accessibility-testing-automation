import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { a11yConfig } from '../a11y.config';
import type { MakeAxe, MakeAxeOptions } from '../fixtures/a11y';
import { applyGate, formatBlocking } from './gate';
import { scan, type NormalizedViolation, type ScanResult } from './scan';

/**
 * Modelo de jornada: escaneia a página depois de cada interação relevante
 * (modal aberto, erro de validação, menu expandido, sucesso...) e aplica o gate
 * sobre todos os estados no final.
 *
 * Uso:
 *   const journey = createJourney({ page, testInfo, makeAxe, name: 'cadastro' });
 *   await journey.scan('inicial');
 *   await page.getByRole('button', { name: 'Menu' }).click();
 *   await journey.scan('menu-expandido');
 *   journey.expectGate();
 */
export function createJourney(opts: { page: Page; testInfo: TestInfo; makeAxe: MakeAxe; name: string }) {
  const violations: NormalizedViolation[] = [];
  const states: string[] = [];

  return {
    violations,
    states,

    /** Escaneia o estado atual. O contexto vira '<jornada>/<estado>' (entra no fingerprint na Fase 3). */
    async scan(state: string, axeOptions: MakeAxeOptions = {}): Promise<ScanResult> {
      return test.step(`scan a11y: ${state}`, async () => {
        const result = await scan({ ...opts, ...axeOptions, context: `${opts.name}/${state}` });
        violations.push(...result.violations);
        states.push(state);
        return result;
      });
    },

    /** Aplica o gate sobre as violações de todos os estados escaneados. */
    expectGate() {
      const gate = applyGate(violations, a11yConfig.gateMode);
      expect(gate.passed, formatBlocking(gate)).toBe(true);
    },
  };
}
