import type { NormalizedViolation } from './scan';

/**
 * Normaliza o seletor para que pequenas mudanças de layout não mudem a identidade da violação.
 *  - remove índices voláteis (:nth-child, :nth-of-type, :nth-last-*)
 *  - troca classes geradas por CSS-in-JS / CSS Modules por um curinga
 * Ajuste a lista conforme o framework do seu front-end.
 */
const VOLATILE_PATTERNS: [RegExp, string][] = [
  [/:nth-(?:last-)?(?:child|of-type)\([^)]*\)/g, ''],
  [/\.(?:css|sc|jsx|svelte|emotion|styled)-[A-Za-z0-9_-]{4,}/g, '.*'], // emotion, styled-components, styled-jsx, svelte
  [/\.([A-Za-z][\w-]*)__[\w-]+___[A-Za-z0-9_-]{5}/g, '.$1'], // CSS Modules: Componente__classe___hash
];

export function normalizeTarget(target: string): string {
  let out = target;
  for (const [pattern, replacement] of VOLATILE_PATTERNS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, ' ').trim();
}

/** Identificador estável: regra + página/estado + seletor normalizado. */
export function fingerprint(v: Pick<NormalizedViolation, 'ruleId' | 'context' | 'target'>): string {
  return `${v.ruleId}|${v.context}|${normalizeTarget(v.target)}`;
}

/** Conta ocorrências por fingerprint (o mesmo seletor normalizado pode aparecer mais de uma vez). */
export function countByFingerprint<T extends Pick<NormalizedViolation, 'ruleId' | 'context' | 'target'>>(items: T[]) {
  const counts = new Map<string, number>();
  for (const v of items) {
    const fp = fingerprint(v);
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }
  return counts;
}
