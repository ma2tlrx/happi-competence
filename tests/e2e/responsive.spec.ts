import { expect, test } from '@playwright/test';

import { login } from './helpers';

test('accueil et passeport sans défilement horizontal sur téléphone', async ({ page }) => {
  for (const path of ['/', '/programme', '/competences']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await login(page, 'participant@demo.happi.test');
  for (const path of ['/participant/dashboard', '/participant/competences-transversales', '/participant/parcours', '/participant/bilan']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await expect(page.getByRole('navigation', { name: 'Navigation rapide' })).toBeVisible();
});
