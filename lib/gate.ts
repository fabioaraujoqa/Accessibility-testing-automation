import { expect, type TestInfo } from '@playwright/test';
import { a11yConfig, type GateMode } from '../a11y.config';
import { compare, type ClassifiedViolation } from './baseline';
import type { Impact, NormalizedViolation } from './scan';

/** Impactos que reprovam o build em cada modo. */
export const BLOCKING_IMPACTS: Record<GateMode, readonly Impact[]> = {
  report: [],
  critical: ['critical'],
  serious: ['critical', 'serious'],
};

export interface GateResult {
  mode: GateMode;
  passed: boolean;
  blocking: NormalizedViolation[];
}

/** Aplica o modo do gate. Deve receber SOMENTE as violações novas (fora do baseline). */
export function applyGate(newViolations: NormalizedViolation[], mode: GateMode): GateResult {
  const blocking = newViolations.filter((v) => BLOCKING_IMPACTS[mode].includes(v.impact));
  return { mode, passed: blocking.length === 0, blocking };
}

export function formatBlocking(result: GateResult): string {
  return [
    `Gate "${result.mode}" reprovou ${result.blocking.length} violação(ões) NOVA(S) (fora do baseline):`,
    ...result.blocking.map((v) => `  - [${v.impact}] ${v.ruleId} em ${v.context} → ${v.target}\n    ${v.help} (${v.helpUrl})`),
    '',
    'Corrija-as. Se for dívida aceita de forma consciente, rode `npm run a11y:baseline` e leve o diff ao code review.',
  ].join('\n');
}

/** Nome do anexo lido por scripts/report.ts e scripts/update-baseline.ts. */
export const RECORD_ATTACHMENT = 'a11y-record';

export interface A11yRecord {
  /** Modo do gate com que o teste rodou (o relatório usa este, não o do ambiente de quem gera o relatório). */
  gateMode: GateMode;
  /** URL base escaneada. */
  target: string;
  contexts: string[];
  violations: ClassifiedViolation[];
}

/**
 * Ponto único de decisão de um teste:
 *   1. compara as violações dos contextos escaneados com o baseline (novas × existentes);
 *   2. anexa o registro (para relatório e atualização do baseline);
 *   3. aplica o gateMode SOMENTE sobre as novas.
 */
export async function gate(testInfo: TestInfo, contexts: string[], violations: NormalizedViolation[]) {
  const { newViolations, existing, fixed } = compare(violations, contexts);

  const record: A11yRecord = { gateMode: a11yConfig.gateMode, target: testInfo.project.use.baseURL ?? '', contexts, violations: [...newViolations, ...existing] };
  await testInfo.attach(`${RECORD_ATTACHMENT}.json`, { body: JSON.stringify(record, null, 2), contentType: 'application/json' });

  testInfo.annotations.push({
    type: 'a11y-gate',
    description: `${contexts.join(', ')}: ${newViolations.length} nova(s), ${existing.length} no baseline, ${fixed.reduce((n, e) => n + e.count, 0)} corrigida(s) · modo ${a11yConfig.gateMode}`,
  });

  const result = applyGate(newViolations, a11yConfig.gateMode);
  expect(result.passed, formatBlocking(result)).toBe(true);
}
