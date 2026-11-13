import 'dotenv/config';

/** Porta do servidor estático de demo/ (autotestes e alvo padrão enquanto não há homologação). */
export const DEMO_PORT = Number(process.env.DEMO_PORT ?? 4173);
export const DEMO_URL = `http://localhost:${DEMO_PORT}`;

/** Alvo dos scans. Sem BASE_URL, usa as páginas de demo/. */
export const BASE_URL = process.env.BASE_URL?.trim() || DEMO_URL;

/** true quando o alvo são as páginas de demo/ (sem BASE_URL). Specs do demo só rodam nesse caso. */
export const IS_DEMO_TARGET = BASE_URL === DEMO_URL;

/** storageState gerado por tests/auth.setup.ts (fora do git). */
export const STORAGE_STATE = '.auth/user.json';

/**
 * Credenciais do usuário de teste. Sempre de variáveis de ambiente.
 * Só no alvo demo há um valor fictício de fallback (a página demo/login.html aceita qualquer valor).
 */
export function getCredentials(): { user: string; password: string } {
  const user = process.env.A11Y_USER?.trim();
  const password = process.env.A11Y_PASSWORD;
  if (user && password) return { user, password };
  if (IS_DEMO_TARGET) return { user: 'usuario-demo', password: 'senha-demo' };
  throw new Error('Defina A11Y_USER e A11Y_PASSWORD (.env local ou CI/CD Variables) para páginas com requiresAuth.');
}
