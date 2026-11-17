import { expect, test, type Download } from '@playwright/test';

import { login } from './helpers';

/**
 * Tableau de bord d'impact (administrateur) : indicateurs, filtre par organisme, exports CSV
 * qui reprennent les filtres. Prérequis : npm run demo:seed.
 */
async function text(download: Download) {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

test('l’administrateur consulte l’impact, filtre par organisme et exporte en CSV', async ({ page }) => {
  await login(page, 'admin@demo.happi.test');
  await page.goto('/admin/impact');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tableau de bord d’impact');
  await expect(page.getByText('Parcours inscrits')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Indicateurs par cohorte' })).toContainText('Groupe Littoral — automne');

  await page.getByRole('combobox', { name: 'Organisme' }).selectOption({ label: 'Mission Locale Démo du Littoral' });
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page).toHaveURL(/organisme=/);
  const cohorts = page.getByRole('region', { name: 'Indicateurs par cohorte' });
  await expect(cohorts).toContainText('Groupe Littoral — automne');
  await expect(cohorts).not.toContainText('Groupe Horizon');

  const indicators = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Indicateurs (CSV)' }).click();
  const indicatorsFile = await indicators;
  expect(indicatorsFile.suggestedFilename()).toMatch(/^impact-indicateurs-\d{4}-\d{2}-\d{2}\.csv$/);
  const indicatorsCsv = await text(indicatorsFile);
  expect(indicatorsCsv).toContain('Tous les parcours');
  expect(indicatorsCsv).toContain('Groupe Littoral — automne');
  expect(indicatorsCsv).not.toContain('Groupe Horizon');

  const detail = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Détail par participant (CSV)' }).click();
  const detailCsv = await text(await detail);
  expect(detailCsv.split('\n')[0]).toContain('Statut');
  expect(detailCsv).toContain('Martin');
  expect(detailCsv).not.toContain('Diallo');
});

test('l’export d’impact est refusé sans connexion et l’impact administrateur aux autres rôles', async ({ page, request }) => {
  expect((await request.get('/api/exports/impact?type=indicateurs')).status()).toBe(401);
  await login(page, 'formateur@demo.happi.test');
  expect((await page.request.get('/api/exports/impact?type=participants')).status()).toBe(403);
  await page.goto('/admin/impact');
  await expect(page).not.toHaveURL(/\/admin\/impact/);
});
