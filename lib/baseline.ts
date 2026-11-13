import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fingerprint, normalizeTarget } from './fingerprint';
import type { Impact, NormalizedViolation } from './scan';

/** Arquivo do baseline. A11Y_BASELINE_FILE permite apontar outro (ex.: baseline vazio no autoteste do gate). */
export const BASELINE_FILE = process.env.A11Y_BASELINE_FILE ?? 'baseline/violations.json';

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  context: string;
  /** Seletor já normalizado. */
  target: string;
  impact: Impact;
  help: string;
  /** Quantas ocorrências com este fingerprint são dívida aceita. */
  count: number;
}

export interface Baseline {
  /** Explicação para quem abrir o arquivo no code review. */
  _comment: string;
  updatedAt: string;
  commit: string | null;
  entries: BaselineEntry[];
}

export type ViolationStatus = 'new' | 'existing';
export type ClassifiedViolation = NormalizedViolation & { fingerprint: string; status: ViolationStatus };

export interface Comparison {
  /** Fora do baseline (ou acima da contagem aceita): são estas que o gate avalia. */
  newViolations: ClassifiedViolation[];
  /** Já conhecidas (dívida). */
  existing: ClassifiedViolation[];
  /** No baseline, mas não encontradas agora (só para contextos escaneados). */
  fixed: BaselineEntry[];
}

const EMPTY: Baseline = { _comment: '', updatedAt: '', commit: null, entries: [] };

export function readBaseline(file = BASELINE_FILE): Baseline {
  if (!existsSync(file)) return EMPTY;
  return JSON.parse(readFileSync(file, 'utf8')) as Baseline;
}

/**
 * Compara as violações de UM OU MAIS contextos escaneados com o baseline.
 * Comparação por multiconjunto: se o baseline aceita 1 ocorrência de um fingerprint e agora há 2, 1 é nova.
 */
export function compare(current: NormalizedViolation[], scannedContexts: string[], baseline = readBaseline()): Comparison {
  const contexts = new Set(scannedContexts);
  const remaining = new Map<string, number>();
  for (const e of baseline.entries) if (contexts.has(e.context)) remaining.set(e.fingerprint, e.count);

  const newViolations: ClassifiedViolation[] = [];
  const existing: ClassifiedViolation[] = [];
  const unmatched: ClassifiedViolation[] = [];

  // 1ª passada: fingerprint exato.
  for (const v of current) {
    const fp = fingerprint(v);
    const left = remaining.get(fp) ?? 0;
    if (left > 0) {
      remaining.set(fp, left - 1);
      existing.push({ ...v, fingerprint: fp, status: 'existing' });
    } else {
      unmatched.push({ ...v, fingerprint: fp, status: 'new' });
    }
  }

  // 2ª passada: mesma regra + mesmo contexto, seletor diferente. O axe muda o seletor de um
  // elemento quando surge outro parecido (ex.: 'img' vira 'img[width="40"]'). Casa por contagem.
  // Limitação conhecida: corrigir uma ocorrência e criar outra da mesma regra na mesma página
  // no mesmo PR se compensam (o total no summary.md continua visível).
  const byRuleContext = new Map<string, string[]>();
  for (const e of baseline.entries) {
    if (!contexts.has(e.context)) continue;
    const key = `${e.ruleId}|${e.context}`;
    byRuleContext.set(key, [...(byRuleContext.get(key) ?? []), e.fingerprint]);
  }
  for (const v of unmatched) {
    const fp = byRuleContext.get(`${v.ruleId}|${v.context}`)?.find((f) => (remaining.get(f) ?? 0) > 0);
    if (fp) {
      remaining.set(fp, remaining.get(fp)! - 1);
      existing.push({ ...v, status: 'existing' });
    } else {
      newViolations.push(v);
    }
  }

  const fixed = baseline.entries
    .filter((e) => contexts.has(e.context) && (remaining.get(e.fingerprint) ?? 0) > 0)
    .map((e) => ({ ...e, count: remaining.get(e.fingerprint)! }));

  return { newViolations, existing, fixed };
}

/** Agrupa violações em entradas de baseline (ordenadas, para diffs limpos no code review). */
export function toEntries(violations: NormalizedViolation[]): BaselineEntry[] {
  const map = new Map<string, BaselineEntry>();
  for (const v of violations) {
    const fp = fingerprint(v);
    const entry = map.get(fp);
    if (entry) entry.count++;
    else map.set(fp, { fingerprint: fp, ruleId: v.ruleId, context: v.context, target: normalizeTarget(v.target), impact: v.impact, help: v.help, count: 1 });
  }
  return sortEntries([...map.values()]);
}

const sortEntries = (entries: BaselineEntry[]) =>
  entries.sort((a, b) => a.context.localeCompare(b.context) || a.ruleId.localeCompare(b.ruleId) || a.target.localeCompare(b.target));

/**
 * Substitui no baseline somente os contextos escaneados nesta execução; mantém os demais
 * (ex.: rodar só o demo não apaga a dívida do site, e vice-versa).
 */
export function mergeBaseline(previous: Baseline, scannedContexts: string[], violations: NormalizedViolation[], commit: string | null): Baseline {
  const contexts = new Set(scannedContexts);
  const kept = previous.entries.filter((e) => !contexts.has(e.context));
  return {
    _comment:
      'Dívida de acessibilidade aceita. O gate só reprova violações FORA desta lista. ' +
      'Gerado por `npm run a11y:baseline`; nunca edite à mão sem revisão. Todo diff deste arquivo passa por code review.',
    updatedAt: new Date().toISOString(),
    commit,
    entries: sortEntries([...kept, ...toEntries(violations)]),
  };
}

export function writeBaseline(baseline: Baseline, file = BASELINE_FILE) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(baseline, null, 2) + '\n');
}
