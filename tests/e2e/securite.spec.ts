import { expect, test } from '@playwright/test';

import { RATE_LIMITS } from '../../src/lib/security/rate-limit-core';

import { createAccount, deleteAccounts, type Account } from './fixtures';
import { randomIp, signInWith } from './helpers';
import { totp, totpStep } from './totp';

/**
 * Double authentification (activation par code TOTP calculé ici, puis reconnexion avec code)
 * et limitation de débit de la connexion. Comptes et adresses jetables : les compteurs des
 * comptes de démonstration ne sont jamais touchés.
 */
const users: string[] = [];
let account: Account;
test.beforeAll(async () => {
  account = await createAccount(users, 'Prudente', 'participant', Math.random().toString(16).slice(2, 8), 'Securite');
});
test.afterAll(async () => {
  await deleteAccounts(users);
});

test('activation de la double authentification puis reconnexion avec un code', async ({ page }) => {
  test.setTimeout(120_000);
  await signInWith(page, account.email, account.password);
  await page.goto('/compte/securite');
  await expect(page.getByText('Désactivée', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activer la double authentification' }).click();
  await expect(page.getByRole('img', { name: 'QR code à scanner avec votre application d’authentification' })).toBeVisible();
  const secret = (await page.locator('code').first().innerText()).trim();
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  // Un mauvais code est refusé.
  const wrong = String((Number(totp(secret)) + 1) % 1_000_000).padStart(6, '0');
  await page.getByLabel('Code de vérification').fill(wrong);
  await page.getByRole('button', { name: 'Confirmer l’activation' }).click();
  await expect(page.getByText(/Ce code n’est pas valide/)).toBeVisible();

  const enrolledAt = totpStep();
  await page.getByLabel('Code de vérification').fill(totp(secret));
  await page.getByRole('button', { name: 'Confirmer l’activation' }).click();
  // La page se met à jour : badge « Activée » et formulaire de désactivation.
  await expect(page.getByText('Activée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Désactiver la double authentification' })).toBeVisible();

  // Déconnexion depuis le menu du compte.
  await page.getByRole('button', { name: `Menu du compte de ${account.firstName}` }).click();
  await page.getByRole('menuitem', { name: 'Me déconnecter' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Reconnexion : le mot de passe ne suffit plus, l'espace reste fermé sans code.
  await signInWith(page, account.email, account.password);
  await expect(page).toHaveURL(/\/double-authentification/);
  await page.goto('/participant/dashboard');
  await expect(page).toHaveURL(/\/double-authentification/);

  // Code du pas de 30 s suivant celui de l'activation (un code déjà utilisé peut être refusé).
  while (totpStep() === enrolledAt) await page.waitForTimeout(1_000);
  await page.getByLabel('Code de vérification').fill(totp(secret));
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page).toHaveURL(/\/participant\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('la connexion est bloquée après trop d’échecs pour une même adresse', async ({ page }) => {
  // Adresse IP et e-mail jetables : seul ce test alimente ces compteurs.
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': randomIp() });
  const email = `inconnu.${Date.now().toString(36)}@e2e.happi.test`;
  const allowed = RATE_LIMITS['login.email'].limit;
  await page.goto('/connexion');
  for (let attempt = 1; attempt <= allowed; attempt += 1) {
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.locator('input[name=password]').fill(`Mauvais-${attempt}-mot-de-passe`);
    // Le message est identique à chaque envoi : on attend la réponse de l'action serveur.
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/connexion'));
    await page.getByRole('button', { name: 'Me connecter' }).click();
    await answered;
    await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
  }
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('input[name=password]').fill('Encore-un-essai-1');
  await page.getByRole('button', { name: 'Me connecter' }).click();
  await expect(page.getByText(/Trop de tentatives de connexion\. Pour protéger les comptes, patientez \d+ minutes? avant de réessayer\./)).toBeVisible();
  await expect(page).toHaveURL(/\/connexion/);
});
