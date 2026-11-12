import type { GateMode } from '../a11y.config';
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

/**
 * Aplica o modo do gate.
 * Fase 1: recebe todas as violações. A partir da Fase 3, recebe SOMENTE as novas (fora do baseline).
 */
export function applyGate(violations: NormalizedViolation[], mode: GateMode): GateResult {
  const blocking = violations.filter((v) => BLOCKING_IMPACTS[mode].includes(v.impact));
  return { mode, passed: blocking.length === 0, blocking };
}

export function formatBlocking(result: GateResult): string {
  return [
    `Gate "${result.mode}" reprovou ${result.blocking.length} violação(ões):`,
    ...result.blocking.map((v) => `  - [${v.impact}] ${v.ruleId} em ${v.context} → ${v.target}\n    ${v.help} (${v.helpUrl})`),
  ].join('\n');
}
