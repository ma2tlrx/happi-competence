import { expect, test } from '@playwright/test';

import { login, unique } from './helpers';

test('les pages publiques s’affichent', async ({ page }) => {
  for (const [path, heading] of [
    ['/', 'Révélez les compétences qui feront la différence.'],
    ['/programme', 'Le programme HAPPI'],
    ['/approche', 'Notre approche'],
    ['/competences', 'Les compétences observées'],
    ['/contact', 'Nous contacter'],
    ['/mentions-legales', 'Mentions légales'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
  const response = await page.goto('/page-inexistante');
  expect(response?.status()).toBe(404);
});

test('le formulaire de contact valide puis enregistre le message', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByText('Indiquez votre nom.')).toBeVisible();
  await page.getByLabel('Nom').fill('Test Contact');
  await page.getByLabel('Adresse e-mail').fill(`contact.${unique()}@exemple.org`);
  await page.getByLabel('Message').fill('Message envoyé par les tests de bout en bout.');
  await page.locator('input[name=consent]').check();
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByRole('status')).toContainText('bien été envoyé');
});

test('les espaces privés exigent une connexion', async ({ page }) => {
  for (const path of ['/participant/dashboard', '/organisme/dashboard', '/formateur/dashboard', '/admin/dashboard']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/connexion\?suite=/);
  }
});

test('un participant ne peut pas ouvrir les autres espaces', async ({ page }) => {
  await login(page, 'participant@demo.happi.test');
  await expect(page).toHaveURL(/\/participant\/dashboard/);
  for (const path of ['/admin/dashboard', '/formateur/dashboard', '/organisme/dashboard']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/participant\/dashboard/);
  }
});

test('inscription d’un participant puis auto-évaluation initiale', async ({ page }) => {
  const email = `inscription.${unique()}@demo.happi.test`;
  await page.goto('/inscription?espace=participant');
  await page.locator('input[name=firstName]').fill('Camille');
  await page.locator('input[name=lastName]').fill('Essai');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('input[name=password]').fill('MotDePasse2026');
  await page.locator('input[name=passwordConfirm]').fill('MotDePasse2026');
  await page.locator('input[name=terms]').check();
  await page.locator('input[name=privacy]').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/participant\/auto-evaluation/);

  const questions = page.locator('fieldset').filter({ has: page.getByRole('radio') });
  const count = await questions.count();
  expect(count).toBeGreaterThan(5);
  for (let index = 0; index < count; index += 1) {
    await questions.nth(index).locator('label').nth(index % 5).click();
  }
  await expect(page.getByText(`${count} / ${count} réponses`)).toBeVisible();
  await expect(page.getByText('Réponses enregistrées automatiquement')).toBeVisible();
  await page.getByRole('button', { name: 'Valider mon auto-évaluation' }).click();
  await expect(page).toHaveURL(/\/participant\/dashboard/);
  await expect(page.getByText('Bienvenue dans votre passeport de compétences')).toBeVisible();
  await page.goto('/participant/auto-evaluation');
  await expect(page.getByText('Terminée')).toBeVisible();
});
