import { expect, test } from '@playwright/test';

import { login, unique } from './helpers';

/**
 * Partage du passeport : création d'un lien par le participant, consultation publique
 * sans connexion, révocation, et réponse neutre pour un lien inconnu.
 * Prérequis : migration 20261113120000_passport_sharing appliquée et npm run demo:seed.
 */

test('le participant partage son passeport, le recruteur le vérifie, puis le lien est révoqué', async ({ page, browser }) => {
  const label = `Entreprise e2e ${unique()}`;
  await login(page, 'participant@demo.happi.test');
  await page.goto('/participant/partage');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Partager mon passeport');

  await page.getByLabel('Pour qui ?').fill(label);
  await page.getByLabel('Durée de validité').selectOption('7');
  await page.getByRole('button', { name: 'Créer le lien' }).click();

  const link = page.locator('p.font-mono').filter({ hasText: '/verifier/' }).first();
  await expect(link).toBeVisible();
  const url = (await link.textContent())!.trim();
  expect(url).toMatch(/\/verifier\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole('img', { name: 'QR code du lien de vérification' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(label) })).toContainText('Actif');

  // QR code téléchargeable par le titulaire.
  const qrHref = await page.getByRole('link', { name: 'QR code (PNG)' }).first().getAttribute('href');
  const png = await page.request.get(qrHref!);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');

  // Consultation publique, dans un contexte sans session.
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  const path = new URL(url).pathname;
  const response = await publicPage.goto(path);
  expect(response!.headers()['referrer-policy']).toBe('no-referrer');
  expect(response!.headers()['cache-control']).toMatch(/no-store/);
  await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(publicPage.getByText(/Passeport de compétences délivré par HAPPI Compétence/)).toBeVisible();
  await expect(publicPage.getByText(/non une certification/)).toBeVisible();
  // Prénom + initiale seulement, aucune coordonnée.
  await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText(/^\S+ \S\.$/);
  await expect(publicPage.locator('body')).not.toContainText('@demo.happi.test');

  // Le compteur de consultations augmente côté participant.
  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(label) })).toContainText('Dernière');

  // Révocation : la page publique devient neutre.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: `Révoquer le lien « ${label} »` }).click();
  await expect(page.getByRole('row', { name: new RegExp(label) })).toContainText('Révoqué');
  await publicPage.goto(path);
  await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText('Ce lien de vérification n’est pas disponible');
  await visitor.close();
});

test('un lien inconnu donne le même message neutre, sans connexion', async ({ page }) => {
  await page.goto('/verifier/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  await expect(page).toHaveURL(/\/verifier\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ce lien de vérification n’est pas disponible');
  await page.goto('/verifier/pas-un-jeton');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ce lien de vérification n’est pas disponible');
});

test('robots.txt exclut les pages de vérification', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /verifier/');
});

test('le QR code d’un lien ne se télécharge ni sans connexion ni par un autre compte', async ({ page, request }) => {
  const fake = '/api/exports/partage/00000000-0000-4000-8000-000000000000/qr';
  expect((await request.get(fake)).status()).toBe(401);
  await login(page, 'formateur@demo.happi.test');
  expect((await page.request.get(fake)).status()).toBe(404);
  await page.goto('/participant/partage');
  await expect(page).not.toHaveURL(/\/participant\/partage/);
});
