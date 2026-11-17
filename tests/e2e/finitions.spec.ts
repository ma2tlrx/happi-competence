import { expect, test } from '@playwright/test';

import { login } from './helpers';

/** L'export CSV des participants d'un organisme reprend la recherche et les filtres de la page. */
test('l’export CSV de l’organisme reprend la recherche en cours', async ({ page }) => {
  await login(page, 'organisme@demo.happi.test');
  await page.goto('/organisme/participants?q=martin');
  await expect(page.getByRole('link', { name: /MARTIN/ })).toBeVisible();
  const link = page.getByRole('link', { name: 'Export CSV (sélection)' });
  await expect(link).toHaveAttribute('href', '/api/exports/participants?q=martin');
  const filtered = await (await page.request.get('/api/exports/participants?q=martin')).text();
  const all = await (await page.request.get('/api/exports/participants')).text();
  const rows = (csv: string) => csv.trim().split('\r\n').length - 1;
  expect(filtered).toContain('Martin');
  expect(filtered).not.toContain('Benali');
  expect(rows(filtered)).toBeLessThan(rows(all));
});
