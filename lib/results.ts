import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { JSONReport, JSONReportSuite, JSONReportTest } from '@playwright/test/reporter';
import type { GateMode } from '../a11y.config';
import { RECORD_ATTACHMENT, type A11yRecord } from './gate';
import { INCOMPLETE_ANNOTATION } from './scan';

/** Saída do reporter json do Playwright (ver playwright.config.ts). */
export const RESULTS_FILE = 'reports/results.json';

export interface RunData {
  /** Registros do gate de todos os testes (violações classificadas por contexto). */
  records: A11yRecord[];
  /** Contextos efetivamente escaneados nesta execução. */
  contexts: string[];
  /** Regras "incompletas" do axe por contexto (revisão manual). */
  incomplete: Map<string, string[]>;
  /** Modo do gate da execução (lido dos registros; null se não houve registro). */
  gateMode: GateMode | null;
  /** URL base escaneada (lida dos registros). */
  target: string | null;
  /** Testes que falharam por erro (timeout, página fora do ar...) e não por gate. */
  errors: { title: string; message: string }[];
}

function allTests(suite: JSONReportSuite): (JSONReportTest & { title: string })[] {
  return [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests.map((t) => ({ ...t, title: spec.title }))),
    ...(suite.suites ?? []).flatMap(allTests),
  ];
}

export function readRun(file = RESULTS_FILE): RunData {
  if (!existsSync(file)) {
    throw new Error(`${file} não encontrado. Rode os testes antes (npm run a11y).`);
  }
  const report = JSON.parse(readFileSync(file, 'utf8')) as JSONReport;
  const records: A11yRecord[] = [];
  const incomplete = new Map<string, string[]>();
  const errors: RunData['errors'] = [];

  for (const test of report.suites.flatMap(allTests)) {
    const result = test.results.at(-1);
    if (!result) continue;

    let hasRecord = false;
    for (const att of result.attachments) {
      if (att.name === `${RECORD_ATTACHMENT}.json` && att.body) {
        records.push(JSON.parse(Buffer.from(att.body, 'base64').toString('utf8')) as A11yRecord);
        hasRecord = true;
      }
    }
    for (const ann of test.annotations) {
      if (ann.type === INCOMPLETE_ANNOTATION && ann.description) {
        const { context, rules } = JSON.parse(ann.description) as { context: string; rules: string[] };
        incomplete.set(context, rules);
      }
    }
    // Falha sem registro = o teste quebrou antes do gate (não é violação de acessibilidade).
    if (!hasRecord && (result.status === 'failed' || result.status === 'timedOut')) {
      errors.push({ title: `[${test.projectName}] ${test.title}`, message: (result.error?.message ?? '').split('\n')[0] });
    }
  }

  const modes = [...new Set(records.map((r) => r.gateMode))];
  if (modes.length > 1) throw new Error(`${file} mistura modos de gate (${modes.join(', ')}). Rode a suíte de novo.`);

  return { gateMode: modes[0] ?? null, target: records[0]?.target ?? null, records, contexts: [...new Set(records.flatMap((r) => r.contexts))], incomplete, errors };
}

export function currentCommit(): string | null {
  if (process.env.CI_COMMIT_SHORT_SHA) return process.env.CI_COMMIT_SHORT_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}
