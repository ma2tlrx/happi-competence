import { expect, test } from '@playwright/test';

import { login } from './helpers';

/**
 * Pistes métiers : un bilan généré par le formateur présente la section « Pistes à explorer »
 * (trois pistes, ou un message expliquant pourquoi il n'y en a pas), sans score ni pourcentage.
 */
test('un bilan généré présente les pistes à explorer, sans score', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, 'formateur@demo.happi.test');
  await page.goto('/formateur/groupes');
  await page.getByRole('link', { name: /Littoral/ }).first().click();
  await page.waitForURL(/\/formateur\/groupes\/[0-9a-f-]{36}/);
  await page.locator('a[href^="/formateur/participants/"]').first().click();
  await page.getByRole('link', { name: 'Bilan HAPPI' }).click();
  await page.waitForLoadState('networkidle');
  page.on('pageerror', (error) => console.error('Erreur page :', error.message));
  await page.getByRole('button', { name: /Générer (le|un nouveau) bilan/ }).click();
  await expect(page.getByRole('heading', { name: 'Pistes à explorer' })).toBeVisible({ timeout: 150_000 });
  const main = await page.locator('main').innerText();
  const text = main.slice(main.indexOf('Pistes à explorer'));
  expect(text).not.toMatch(/\d+\s?%|score/i);
  expect(text).toMatch(/Fiche ROME [A-N]\d{4}|aucune piste n’est proposée|aucune piste n'est proposée/);
  await page.screenshot({ path: '/tmp/claude-0/-home-user/be77a100-de7e-5df0-9161-4452cbeb192f/scratchpad/pistes-panel.png', fullPage: true });
});
