import { expect, test, type Download } from '@playwright/test';

import { login } from './helpers';

/**
 * Observatoire des compétences (administration) : filtre par organisme, comparaison par tranche
 * d'âge, fiche d'une compétence, export CSV sans aucune case de moins de 5 personnes ; refus pour
 * les autres rôles. Prérequis : npm run demo:seed (l'administrateur de démonstration voit les données
 * de démonstration).
 */
async function text(download: Download) {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** Cellules d'une ligne CSV (« ; », guillemets doublés). */
function cells(line: string) {
  return [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => match[1]!.replaceAll('""', '"'));
}

test('l’administrateur filtre, compare par tranche d’âge, ouvre une fiche et exporte sans case de moins de 5', async ({ page }) => {
  await login(page, 'admin@demo.happi.test');
  await page.goto('/admin/observatoire');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Observatoire des compétences');
  await expect(page.getByText('personnes observées', { exact: true })).toBeVisible();
  const table = page.getByRole('region', { name: 'Résultats par compétence' });
  await expect(table).toContainText('Esprit d');

  // Filtre par organisme.
  await page.getByRole('button', { name: /^Filtrer/ }).click();
  const organisation = page.getByRole('combobox', { name: 'Organisme' });
  await organisation.selectOption((await organisation.locator('option', { hasText: 'Mission Locale Démo du Littoral' }).getAttribute('value'))!);
  await expect(page).toHaveURL(/organisme=/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('list', { name: 'Filtres actifs' })).toContainText('Organisme : Mission Locale Démo du Littoral');

  // Comparer par tranche d'âge : carte de chaleur, cases masquées sous 5 personnes.
  await page.getByRole('combobox', { name: 'Comparer par' }).selectOption({ label: 'Tranche d’âge' });
  await expect(page).toHaveURL(/comparer=age/);
  const heatmap = page.getByRole('region', { name: 'Carte de chaleur des compétences' });
  await expect(heatmap).toContainText('Ensemble');
  await expect(heatmap).toContainText('18 à 29 ans');
  await expect(heatmap).toContainText('moins de 5');

  // Fiche d'une compétence.
  await heatmap.getByRole('button', { name: /^Esprit d.équipe$/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: /Esprit d.équipe/ })).toBeVisible();
  await expect(sheet).toContainText('Moyenne observée à chaque session');
  await expect(sheet).toContainText('Selon tranche d’âge');
  await expect(page).toHaveURL(/competence=esprit_d_equipe/);
  await sheet.getByRole('button', { name: 'Fermer' }).click();

  // Export CSV : mêmes filtres, aucune case de moins de 5 personnes.
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exporter (CSV)' }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/^observatoire-transversal-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await text(file);
  expect(csv).toContain('Organisme : Mission Locale Démo du Littoral');
  expect(csv).toContain('Tranche d’âge : 18 à 29 ans');
  const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean).map(cells);
  const header = lines.findIndex((line) => line[0] === 'Compétence');
  expect(header).toBeGreaterThan(0);
  const columns = lines[header]!.flatMap((title, index) => (title.endsWith('(n)') ? [index] : []));
  expect(columns).toHaveLength(3);
  const rows = lines.slice(header + 1);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    for (const index of columns) {
      const value = row[index] ?? '';
      expect(['moins de 5', 'non comparable', '', '0'].includes(value) || Number(value) >= 5, `${row[0]} / ${row[2]} : ${value}`).toBe(true);
    }
  }
  expect(rows.some((row) => row[3] === 'moins de 5')).toBe(true);
});

test('l’observatoire et son export sont refusés aux formateurs, aux organismes et sans connexion', async ({ page, request }) => {
  expect((await request.get('/api/exports/observatoire')).status()).toBe(401);

  await login(page, 'formateur@demo.happi.test');
  expect((await page.request.get('/api/exports/observatoire')).status()).toBe(403);
  await page.goto('/admin/observatoire');
  await expect(page).not.toHaveURL(/\/admin\/observatoire/);

  await page.context().clearCookies();
  await login(page, 'organisme@demo.happi.test');
  expect((await page.request.get('/api/exports/observatoire?comparer=age')).status()).toBe(403);
  await page.goto('/admin/observatoire');
  await expect(page).not.toHaveURL(/\/admin\/observatoire/);
});
