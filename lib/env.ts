import 'dotenv/config';

/** Porta do servidor estático de demo/ (autotestes e alvo padrão enquanto não há homologação). */
export const DEMO_PORT = Number(process.env.DEMO_PORT ?? 4173);
export const DEMO_URL = `http://localhost:${DEMO_PORT}`;

/** Alvo dos scans. Sem BASE_URL, usa as páginas de demo/. */
export const BASE_URL = process.env.BASE_URL?.trim() || DEMO_URL;

/** storageState gerado por tests/auth.setup.ts (fora do git). */
export const STORAGE_STATE = '.auth/user.json';
