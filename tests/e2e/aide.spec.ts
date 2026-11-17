import { expect, test } from '@playwright/test';

import { login } from './helpers';

/** Centre d'aide : ouvert sans connexion, recherche côté navigateur, contenu adapté au rôle connecté. */

test('le centre d’aide s’ouvre sans connexion, depuis le pied de page, et sa recherche filtre les guides', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Centre d’aide' }).click();
  await expect(page).toHaveURL(/\/aide$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Centre d’aide');
  await expect(page.getByRole('button', { name: 'Tous les espaces' })).toHaveAttribute('aria-pressed', 'true');
  for (const title of ['Se connecter', 'Présences et émargement', 'Lire le tableau d’impact', 'Créer un code d’accès']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }

  await page.getByLabel('Rechercher dans l’aide').fill('emarger');
  await expect(page.getByText(/résultats? pour « emarger »/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signer la feuille de présence (émarger)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créer un code d’accès' })).toHaveCount(0);

  await page.getByLabel('Rechercher dans l’aide').fill('zzzz introuvable');
  await expect(page.getByText('Aucun guide ne correspond.', { exact: false })).toBeVisible();
  await expect(page.getByText('Aucune question ne correspond.')).toBeVisible();

  await page.getByLabel('Rechercher dans l’aide').fill('');
  await page.getByRole('button', { name: 'Formateur' }).click();
  await expect(page.getByRole('heading', { name: 'Évaluer les participants' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Formulaire de contact' }).first()).toBeVisible();
});

test('connecté, le participant voit d’abord les guides de son espace et trouve « Aide » dans son menu', async ({ page }) => {
  await login(page, 'participant@demo.happi.test');
  await page.goto('/participant/dashboard');
  await page.getByRole('navigation', { name: 'Mon passeport' }).getByRole('link', { name: 'Aide' }).click();
  await expect(page).toHaveURL(/\/aide$/);
  await expect(page.getByRole('button', { name: /Participant \(vous\)/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Votre espace : participant' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partager mon passeport' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créer un code d’accès' })).toHaveCount(0);
});

test('le lien « Aide » figure dans le menu des espaces formateur, organisme et administrateur', async ({ page }) => {
  for (const [email, menu] of [
    ['formateur@demo.happi.test', 'Espace formateur'],
    ['organisme@demo.happi.test', 'Espace organisme'],
    ['admin@demo.happi.test', 'Administration'],
  ] as const) {
    await page.context().clearCookies();
    await login(page, email);
    await expect(page.getByRole('navigation', { name: menu }).getByRole('link', { name: 'Aide' })).toHaveAttribute('href', '/aide');
  }
});
