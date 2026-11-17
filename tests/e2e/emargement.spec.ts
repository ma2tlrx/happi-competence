import { expect, test } from '@playwright/test';

import { createE2eFixture, destroyE2eFixture, type E2eFixture } from './fixtures';
import { drawSignature, signInWith } from './helpers';

/**
 * Émargement : signature sur la tablette du formateur (tracé à la souris), signature depuis le
 * compte du participant, contre-signature puis feuille PDF. Jeu de données propre (séance du jour).
 */
let f: E2eFixture;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  f = await createE2eFixture();
});
test.afterAll(async () => {
  await destroyE2eFixture(f);
});

test('le participant signe la séance du jour depuis son compte', async ({ page }) => {
  await signInWith(page, f.learner.email, f.learner.password);
  await page.goto('/participant/dashboard');
  await expect(page.getByRole('heading', { name: 'Émargement du jour' })).toBeVisible();
  await page.getByRole('button', { name: 'Signer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Valider ma signature' })).toBeDisabled();
  await drawSignature(page, 'Zone de signature pour la session 1');
  await page.getByRole('button', { name: 'Valider ma signature' }).click();
  await expect(page.getByText('Votre signature est enregistrée.')).toBeVisible();
  await expect(page.getByText(/^Signé le /)).toBeVisible();
});

test('le formateur fait signer un participant présent sur la tablette, contre-signe et télécharge la feuille', async ({ page }) => {
  await signInWith(page, f.trainer.email, f.trainer.password);
  await page.goto(`/formateur/sessions/${f.sessionToday}/presences`);
  await page.getByRole('link', { name: 'Émargement', exact: true }).click();
  await expect(page).toHaveURL(/\/presences\/emargement$/);
  await expect(page.getByRole('heading', { name: /Participants présents · 1\/3 signé/ })).toBeVisible();

  // La personne choisit son nom, signe à la souris, valide.
  // Clic répété tant que la page n'est pas hydratée (un clic trop tôt reste sans effet).
  await expect(async () => {
    await page.getByRole('button', { name: new RegExp(f.names.signer) }).click({ timeout: 2_000 });
    await expect(page.getByRole('heading', { name: f.names.signer })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole('button', { name: 'Valider la signature' })).toBeDisabled();
  await drawSignature(page, `Zone de signature de ${f.names.signer}`);
  await page.getByRole('button', { name: 'Valider la signature' }).click();
  await expect(page.getByText(new RegExp(`${f.names.signer} : signature enregistrée`))).toBeVisible();
  await expect(page.getByRole('heading', { name: /Participants présents · 2\/3 signé/ })).toBeVisible();

  // Contre-signature : la feuille est figée, le PDF se télécharge.
  await drawSignature(page, 'Zone de contre-signature du formateur');
  await page.getByLabel('J’atteste l’exactitude de la liste des présences de cette séance.').check();
  await page.getByRole('button', { name: 'Contre-signer et figer la feuille' }).click();
  await expect(page.getByText('Feuille contre-signée', { exact: true })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^emargement-session-1-\d{4}-\d{2}-\d{2}\.pdf$/);
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');

  // Le participant ne peut plus signer : la feuille est close.
  await page.goto(`/formateur/sessions/${f.sessionToday}/presences`);
  await expect(page.getByText('Feuille d’émargement contre-signée')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Émargement', exact: true })).toHaveCount(0);
});
