import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type BrowserContext, type Page } from '@playwright/test';

type Account = { espace: string; email: string; password: string };
type Cookies = Awaited<ReturnType<BrowserContext['cookies']>>;

/** Identifiants générés par npm run demo:seed. */
export function demoAccount(email: string): Account {
  const file = JSON.parse(readFileSync(join(process.cwd(), '.demo-credentials.json'), 'utf8')) as { comptes: Account[] };
  const account = file.comptes.find((item) => item.email === email);
  if (!account) throw new Error(`Compte de démonstration introuvable : ${email}. Lancez npm run demo:seed.`);
  return account;
}

/**
 * Sessions déjà ouvertes, par adresse e-mail, conservées d'une exécution à l'autre (fichier
 * temporaire local, propre au serveur visé et à la génération de la démonstration) : on reste
 * ainsi loin de la limite de débit de la connexion (8 essais par adresse en 15 minutes).
 * Une session fermée ou expirée entre-temps est simplement rouverte.
 */
function sessionStore(page: Page) {
  const generated = (JSON.parse(readFileSync(join(process.cwd(), '.demo-credentials.json'), 'utf8')) as { genere_le?: string }).genere_le ?? '';
  const server = new URL(page.url() === 'about:blank' ? (process.env.E2E_BASE_URL ?? 'http://localhost:3000') : page.url()).host.replace(/\W/g, '-');
  const file = join(tmpdir(), `happi-e2e-sessions-${server}.json`);
  let data: { generated: string; sessions: Record<string, Cookies> } = { generated, sessions: {} };
  try {
    const stored = JSON.parse(readFileSync(file, 'utf8')) as typeof data;
    if (stored.generated === generated) data = stored;
  } catch {
    // Pas encore de fichier.
  }
  const save = () => writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  return {
    get: (email: string) => data.sessions[email],
    set: (email: string, cookies: Cookies) => {
      data.sessions[email] = cookies;
      save();
    },
    delete: (email: string) => {
      delete data.sessions[email];
      save();
    },
  };
}

export async function signInWith(page: Page, email: string, password: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Me connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

export async function login(page: Page, email: string) {
  const context = page.context();
  const sessions = sessionStore(page);
  const cached = sessions.get(email);
  if (cached) {
    await context.clearCookies();
    await context.addCookies(cached);
    await page.goto('/espace');
    if (!/\/connexion/.test(page.url())) return;
    sessions.delete(email);
    await context.clearCookies();
  }
  await signInWith(page, email, demoAccount(email).password);
  sessions.set(email, await context.cookies());
}


export const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** Adresse IP fictive (en-tête x-forwarded-for) : isole les compteurs de débit par IP d'un test. */
export const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

/** Trace un trait à la souris dans une zone de signature (canvas). */
export async function drawSignature(page: Page, label: string | RegExp) {
  const canvas = page.getByRole('img', { name: label });
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => [box.x + box.width * x, box.y + box.height * y] as const;
  await page.mouse.move(...at(0.15, 0.6));
  await page.mouse.down();
  for (const [x, y] of [[0.25, 0.3], [0.35, 0.7], [0.45, 0.35], [0.55, 0.65], [0.7, 0.4], [0.85, 0.6]] as const) {
    await page.mouse.move(...at(x, y), { steps: 4 });
  }
  await page.mouse.up();
}
