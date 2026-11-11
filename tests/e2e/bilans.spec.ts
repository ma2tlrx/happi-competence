import { expect, test } from '@playwright/test';

import { login } from './helpers';

test('l’équipe ouvre l’espace « Bilan HAPPI » depuis la fiche d’un participant', async ({ page }) => {
  await login(page, 'formateur@demo.happi.test');
  await page.goto('/formateur/groupes');
  await page.locator('main a[href^="/formateur/groupes/"]').first().click();
  await page.waitForURL(/\/formateur\/groupes\/[0-9a-f-]{36}/);
  await page.locator('a[href^="/formateur/participants/"]').first().click();
  await page.getByRole('link', { name: 'Bilan HAPPI' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bilan HAPPI');
  await expect(page.getByRole('button', { name: /Générer (le|un nouveau) bilan/ })).toBeVisible();
});

test('un bilan ne se télécharge pas sans connexion ni avec un identifiant inconnu', async ({ page, request }) => {
  expect((await request.get('/api/exports/bilan/00000000-0000-4000-8000-000000000000')).status()).toBe(401);
  await login(page, 'participant@demo.happi.test');
  expect((await page.request.get('/api/exports/bilan/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
  await page.goto('/formateur/participants/00000000-0000-4000-8000-000000000000/bilan');
  await expect(page).not.toHaveURL(/\/formateur\//);
});
