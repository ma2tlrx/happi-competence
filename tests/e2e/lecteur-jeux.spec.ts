import { expect, test } from '@playwright/test';

import { demoSessionId } from './fixtures';
import { login } from './helpers';

const shots = process.env.E2E_SHOTS_DIR;

test('lecteur : lancer un Undercover et un Quiz sans quitter la séance', async ({ page, context }) => {
  test.setTimeout(240_000);
  await login(page, 'formateur@demo.happi.test');
  const id = await demoSessionId('Groupe Littoral — automne', 4);
  await page.goto(`/formateur/sessions/${id}/lecteur`);
  await expect(page.locator('#lecteur-contenu h1')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  const title = await page.locator('#lecteur-contenu h1').innerText();

  await page.getByRole('button', { name: /Jeux/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Lancer une activité' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Rappel des règles')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Quiz' })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/lecteur-jeux-${test.info().project.name}.png` });

  // Échap ferme, le focus revient sur le bouton, la séquence n'a pas bougé.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Jeux/ })).toBeFocused();
  await page.getByRole('button', { name: /Jeux/ }).click();

  // Les mots ont une valeur par défaut : on lance.
  await dialog.getByRole('button', { name: 'Lancer une partie d’Undercover' }).click();
  await expect(dialog.getByTestId('jeu-undercover-lancee')).toBeVisible({ timeout: 60_000 });
  const code = (await dialog.getByTestId('jeu-undercover-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  if (shots) await page.screenshot({ path: `${shots}/lecteur-jeux-lance-${test.info().project.name}.png` });

  const popupPromise = context.waitForEvent('page');
  await dialog.getByRole('link', { name: /Ouvrir l’écran animateur/ }).first().click();
  const host = await popupPromise;
  await expect(host).toHaveURL(/\/jeux\/undercover\/partie\//);
  await expect(host.getByText(code).first()).toBeVisible({ timeout: 60_000 });
  await host.close();

  // Le lecteur n'a pas bougé ; rouvrir le panneau propose de reprendre la partie plutôt que d'en créer une seconde.
  await expect(page.locator('#lecteur-contenu h1')).toHaveText(title);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Jeux/ }).click();
  await expect(dialog.getByText('Une partie est déjà en cours pour cette session.').first()).toBeVisible();
  await expect(dialog.getByTestId('jeu-undercover-code')).toHaveText(code);
  await expect(dialog.getByRole('link', { name: /Reprendre la partie/ }).first()).toBeVisible();
});

test('lecteur : le panneau Jeux reste utilisable sur téléphone (cibles de 44 px)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'formateur@demo.happi.test');
  await page.goto(`/formateur/sessions/${await demoSessionId('Groupe Littoral — automne', 4)}/lecteur`);
  await page.getByRole('button', { name: /Jeux/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Lancer une activité' });
  await expect(dialog.getByRole('heading', { name: 'Quiz' })).toBeVisible();
  for (const button of await dialog.getByRole('button', { name: /Lancer|Autre paire/ }).all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (shots) await page.screenshot({ path: `${shots}/lecteur-jeux-telephone.png` });
});
