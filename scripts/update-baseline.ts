/**
 * Regrava o baseline (dívida aceita) a partir de uma execução completa.
 *
 *   npm run a11y:baseline              → roda os testes em modo report e regrava o baseline
 *   npm run a11y:baseline -- --no-run  → usa o último reports/results.json
 *
 * Ação EXPLÍCITA e MANUAL: o diff de baseline/violations.json vai para code review.
 * Só os contextos escaneados nesta execução são substituídos; os demais são mantidos.
 */
import { spawnSync } from 'node:child_process';
import { BASELINE_FILE, mergeBaseline, readBaseline, writeBaseline } from '../lib/baseline';
import { currentCommit, readRun } from '../lib/results';

if (!process.argv.includes('--no-run')) {
  console.log('▶ Executando os testes em modo report (nenhum teste reprova por violação)...\n');
  const run = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2).filter((a) => a !== '--no-run')], {
    stdio: 'inherit',
    env: { ...process.env, A11Y_GATE_MODE: 'report' },
  });
  if (run.error) throw run.error;
}

const { records, contexts, errors } = readRun();

if (errors.length) {
  console.error('\n✖ Há testes que falharam por erro (não por violação). Corrija antes de regravar o baseline:');
  for (const e of errors) console.error(`  - ${e.title}: ${e.message}`);
  process.exit(1);
}

const previous = readBaseline();
const violations = records.flatMap((r) => r.violations);
const next = mergeBaseline(previous, contexts, violations, currentCommit());

const before = new Map(previous.entries.map((e) => [e.fingerprint, e.count]));
const after = new Map(next.entries.map((e) => [e.fingerprint, e.count]));
const added = [...after].filter(([fp, n]) => n > (before.get(fp) ?? 0));
const removed = [...before].filter(([fp, n]) => n > (after.get(fp) ?? 0));

writeBaseline(next);

console.log(`\n✔ ${BASELINE_FILE} atualizado (${contexts.length} contexto(s) escaneado(s), ${next.entries.length} entrada(s) no total).`);
console.log(`  + ${added.length} entrada(s) adicionada(s)/aumentada(s)`);
for (const [fp] of added) console.log(`    + ${fp}`);
console.log(`  - ${removed.length} entrada(s) removida(s)/reduzida(s) (corrigidas)`);
for (const [fp] of removed) console.log(`    - ${fp}`);
console.log('\nRevise o diff (git diff baseline/) e leve ao code review.');
