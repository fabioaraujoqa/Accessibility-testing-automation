/**
 * Gera reports/summary.md e reports/metrics.json a partir da última execução (reports/results.json).
 *   npm run a11y:report
 * Não reprova nada: o gate é aplicado dentro dos testes. Este script só consolida e mede.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { a11yConfig } from '../a11y.config';
import { compare, readBaseline } from '../lib/baseline';
import { BASE_URL } from '../lib/env';
import { BLOCKING_IMPACTS } from '../lib/gate';
import { currentCommit, readRun } from '../lib/results';
import type { Impact } from '../lib/scan';

const IMPACTS: Impact[] = ['critical', 'serious', 'moderate', 'minor'];
const ICON: Record<Impact, string> = { critical: '🔴', serious: '🟠', moderate: '🟡', minor: '⚪' };

const { records, contexts, incomplete, errors, gateMode: runMode, target: runTarget } = readRun();
const target = runTarget ?? BASE_URL;
// Usa o modo com que os testes rodaram; o do ambiente só como fallback.
const gateMode = runMode ?? a11yConfig.gateMode;
const all = records.flatMap((r) => r.violations);
const { fixed } = compare(all, contexts, readBaseline());
const newOnes = all.filter((v) => v.status === 'new');
const blocking = newOnes.filter((v) => BLOCKING_IMPACTS[gateMode].includes(v.impact));
const commit = currentCommit();
const now = new Date().toISOString();

const zero = () => Object.fromEntries(IMPACTS.map((i) => [i, 0])) as Record<Impact, number>;
const countImpacts = (list: { impact: Impact }[]) => {
  const c = zero();
  for (const v of list) c[v.impact]++;
  return c;
};

/** 'wcag1410' → '1.4.10' (ignora tags de nível como 'wcag2aa'). */
const criteria = (tags: string[]) =>
  tags.flatMap((t) => {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(t);
    return m ? [`${m[1]}.${m[2]}.${m[3]}`] : [];
  });

// ─── Métricas ───────────────────────────────────────────────────────────────
const byContext = Object.fromEntries(
  [...contexts].sort().map((ctx) => {
    const list = all.filter((v) => v.context === ctx);
    return [
      ctx,
      {
        ...countImpacts(list),
        total: list.length,
        new: list.filter((v) => v.status === 'new').length,
        fixed: fixed.filter((e) => e.context === ctx).reduce((n, e) => n + e.count, 0),
        incomplete: incomplete.get(ctx)?.length ?? 0,
      },
    ];
  }),
);

const byWcag: Record<string, number> = {};
for (const v of all) for (const c of criteria(v.wcag)) byWcag[c] = (byWcag[c] ?? 0) + 1;

const withoutCritical = Object.values(byContext).filter((c) => c.critical === 0).length;

const metrics = {
  generatedAt: now,
  commit,
  target,
  gateMode: gateMode,
  gatePassed: blocking.length === 0 && errors.length === 0,
  totals: { ...countImpacts(all), total: all.length },
  new: { ...countImpacts(newOnes), total: newOnes.length },
  existing: all.length - newOnes.length,
  fixed: fixed.reduce((n, e) => n + e.count, 0),
  contextsScanned: contexts.length,
  contextsWithoutCritical: {
    count: withoutCritical,
    percent: contexts.length ? Math.round((withoutCritical / contexts.length) * 1000) / 10 : 100,
  },
  byContext,
  byWcag: Object.fromEntries(Object.entries(byWcag).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))),
  testErrors: errors.length,
};

// ─── summary.md ─────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md: string[] = [];
md.push('# Relatório de acessibilidade (WCAG 2.2 AA)', '');
md.push(
  `**Resultado do gate:** ${metrics.gatePassed ? '✅ aprovado' : '⛔ reprovado'} · modo \`${gateMode}\``,
  '',
  `Alvo: ${target} · Commit: \`${commit ?? 'n/d'}\` · Gerado em: ${now}`,
  '',
  `| Ocorrências | Novas | No baseline | Corrigidas | Contextos sem critical |`,
  `|---:|---:|---:|---:|---:|`,
  `| ${all.length} | **${newOnes.length}** | ${metrics.existing} | ${metrics.fixed} | ${withoutCritical}/${contexts.length} (${metrics.contextsWithoutCritical.percent}%) |`,
  '',
);

md.push('## Por página / estado', '');
md.push(`| Página/estado | ${IMPACTS.map((i) => `${ICON[i]} ${i}`).join(' | ')} | Novas | Corrigidas | Revisão manual |`);
md.push(`|---|${IMPACTS.map(() => '---:').join('|')}|---:|---:|---:|`);
for (const [ctx, c] of Object.entries(byContext)) {
  md.push(`| ${esc(ctx)} | ${IMPACTS.map((i) => c[i]).join(' | ')} | ${c.new ? `**${c.new}**` : 0} | ${c.fixed} | ${c.incomplete} |`);
}
md.push('');

md.push(`## 🆕 Violações novas (${newOnes.length})`, '');
if (!newOnes.length) md.push('Nenhuma violação nova em relação ao baseline.', '');
else {
  md.push('| | Impacto | Regra | Página/estado | Elemento | Critério | Como corrigir |', '|---|---|---|---|---|---|---|');
  for (const v of [...newOnes].sort((a, b) => IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact))) {
    const blocks = BLOCKING_IMPACTS[gateMode].includes(v.impact) ? '⛔' : '';
    md.push(`| ${blocks} | ${ICON[v.impact]} ${v.impact} | \`${v.ruleId}\` | ${esc(v.context)} | \`${esc(v.target)}\` | ${criteria(v.wcag).join(', ') || '-'} | [${esc(v.help)}](${v.helpUrl}) |`);
  }
  md.push('', `⛔ = reprova no modo \`${gateMode}\`.`, '');
}

md.push(`## ✅ Corrigidas desde o baseline (${metrics.fixed})`, '');
if (!fixed.length) md.push('Nenhuma.', '');
else {
  md.push('| Impacto | Regra | Página/estado | Elemento | Qtde |', '|---|---|---|---|---:|');
  for (const e of fixed) md.push(`| ${ICON[e.impact]} ${e.impact} | \`${e.ruleId}\` | ${esc(e.context)} | \`${esc(e.target)}\` | ${e.count} |`);
  md.push('', 'Rode `npm run a11y:baseline` para remover as corrigidas do baseline (e reduzir a dívida).', '');
}

if (incomplete.size) {
  md.push('## 🔎 Revisão manual necessária (axe inconclusivo)', '');
  md.push('O axe não conseguiu decidir estas regras (ex.: contraste sobre imagem/gradiente). Verifique manualmente.', '');
  for (const [ctx, rules] of incomplete) md.push(`- **${esc(ctx)}**: ${rules.map((r) => `\`${r}\``).join(', ')}`);
  md.push('');
}

if (errors.length) {
  md.push(`## ⚠️ Testes com erro (${errors.length})`, '');
  md.push('Falharam antes do scan (página fora do ar, timeout, login inválido...). Os contextos abaixo NÃO foram medidos.', '');
  for (const e of errors) md.push(`- ${esc(e.title)}: ${esc(e.message)}`);
  md.push('');
}

md.push('---', '_Automação cobre parte dos critérios WCAG. Ela não substitui auditoria manual nem testes com tecnologia assistiva._', '');

mkdirSync('reports', { recursive: true });
writeFileSync('reports/summary.md', md.join('\n'));
writeFileSync('reports/metrics.json', JSON.stringify(metrics, null, 2) + '\n');
console.log(`✔ reports/summary.md e reports/metrics.json gerados (${all.length} ocorrência(s), ${newOnes.length} nova(s), ${metrics.fixed} corrigida(s)).`);
