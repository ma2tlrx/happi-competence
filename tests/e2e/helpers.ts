import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';

type Account = { espace: string; email: string; password: string };

/** Identifiants générés par npm run demo:seed. */
export function demoAccount(email: string): Account {
  const file = JSON.parse(readFileSync(join(process.cwd(), '.demo-credentials.json'), 'utf8')) as { comptes: Account[] };
  const account = file.comptes.find((item) => item.email === email);
  if (!account) throw new Error(`Compte de démonstration introuvable : ${email}. Lancez npm run demo:seed.`);
  return account;
}

export async function login(page: Page, email: string) {
  const { password } = demoAccount(email);
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Me connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

export const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
