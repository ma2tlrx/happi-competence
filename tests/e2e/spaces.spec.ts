import { expect, test } from '@playwright/test';

import { login, unique } from './helpers';

test('le formateur saisit une présence et valide une évaluation', async ({ page }) => {
  await login(page, 'formateur@demo.happi.test');
  await page.getByRole('link', { name: 'Présences' }).first().click();
  await expect(page).toHaveURL(/\/presences$/);
  const group = page.getByRole('radiogroup').first();
  await group.getByRole('radio').nth(1).click();
  await expect(group.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('radiogroup').first().getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('link', { name: 'Évaluations' }).click();
  const levels = page.getByRole('radiogroup', { name: /Niveau observé pour/ });
  await levels.first().getByRole('radio').nth(2).click();
  await levels.nth(1).getByRole('radio').nth(1).click();
  await page.getByLabel('Observation générale').fill('Observation saisie par les tests de bout en bout.');
  await expect(page.getByText('Brouillon enregistré')).toBeVisible();
  const name = await page.locator('#evaluation-titre').innerText();
  await page.getByRole('button', { name: 'Valider l’évaluation' }).click();
  await expect(page.getByText(`Évaluation de ${name.split(' ')[0]} validée.`)).toBeVisible();
});

test('le lecteur pédagogique reprend là où le formateur s’est arrêté', async ({ page }) => {
  await login(page, 'formateur@demo.happi.test');
  await page.getByRole('link', { name: 'Ouvrir le lecteur' }).click();
  await expect(page).toHaveURL(/\/lecteur$/);
  await expect(page.locator('#lecteur-contenu h1')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  // Attend la fin de la transition entre séquences.
  await page.waitForTimeout(800);
  const title = await page.locator('#lecteur-contenu h1').innerText();
  // Laisse le temps à la sauvegarde différée de la position.
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(page.locator('#lecteur-contenu h1')).toHaveText(title);
});

test('un organisme n’accède pas aux participants d’un autre organisme', async ({ page, request }) => {
  await login(page, 'organisme2@demo.happi.test');
  await page.goto('/organisme/participants');
  const ownLinks = await page.locator('a[href^="/organisme/participants/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(ownLinks.length).toBeGreaterThan(0);
  await page.context().clearCookies();
  await login(page, 'organisme@demo.happi.test');
  for (const href of ownLinks) {
    const response = await page.goto(href!);
    expect(response?.status(), href!).toBe(404);
    const id = href!.split('/').pop();
    const pdf = await page.request.get(`/api/exports/passeport/${id}`);
    expect(pdf.status()).toBe(404);
  }
  const csv = await page.request.get('/api/exports/participants');
  expect(csv.headers()['content-type']).toContain('text/csv');
  const body = await csv.text();
  expect(body).not.toContain('Diallo');
  void request;
});

test('l’administrateur crée un code formateur, utilisable une seule fois', async ({ page, browser }) => {
  await login(page, 'admin@demo.happi.test');
  await page.goto('/admin/codes-acces');
  await page.getByLabel('Libellé').fill('Test bout en bout');
  await page.getByRole('button', { name: /Générer un code/ }).click();
  const code = (await page.locator('code').first().innerText()).trim();
  expect(code).toMatch(/^HAPPI-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);

  const register = async (email: string) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const visitor = await context.newPage();
    await visitor.goto('/acces-pro');
    await visitor.getByLabel('Code d’accès').fill(code);
    await visitor.locator('input[name=firstName]').fill('Nouvelle');
    await visitor.locator('input[name=lastName]').fill('Formatrice');
    await visitor.getByLabel('Adresse e-mail').fill(email);
    await visitor.locator('input[name=password]').fill('Formation2026x');
    await visitor.locator('input[name=passwordConfirm]').fill('Formation2026x');
    await visitor.locator('input[name=terms]').check();
    await visitor.locator('input[name=privacy]').check();
    await visitor.getByRole('button', { name: 'Activer mon accès' }).click();
    return visitor;
  };
  const first = await register(`formatrice.${unique()}@demo.happi.test`);
  await expect(first).toHaveURL(/\/formateur\/dashboard/);
  const second = await register(`autre.${unique()}@demo.happi.test`);
  await expect(second.getByText('Ce code d’accès a déjà été utilisé.')).toBeVisible();
});
