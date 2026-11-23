import { expect, test } from '@playwright/test';

import { login } from './helpers';

test('accueil et passeport sans défilement horizontal sur téléphone', async ({ page }) => {
  for (const path of ['/', '/programmes', '/competences']) {
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

test('Passeport Numérique sur téléphone : le cadre remplit l’écran sous l’en-tête, une seule barre en bas', async ({ page }) => {
  await login(page, 'formateur@demo.happi.test');
  await page.goto('/formateur/programmes/passeport-numerique');
  const frame = page.locator('iframe[title="Le Passeport Numérique"]');
  await expect(frame).toBeVisible();
  await expect.poll(async () => (await frame.boundingBox())?.x).toBe(0);
  const metrics = await page.evaluate(() => {
    const box = document.querySelector('iframe')!.getBoundingClientRect();
    // Le cadre commence sous l'en-tête et sous le bandeau éventuel (compte de démonstration).
    const header = (document.querySelector('main')!.previousElementSibling ?? document.querySelector('header')!).getBoundingClientRect();
    const bar = document.querySelector('nav[aria-label="Navigation rapide"]');
    return { top: box.top, height: box.height, width: box.width, headerBottom: header.bottom, vh: innerHeight, vw: innerWidth, barVisible: bar ? getComputedStyle(bar).display !== 'none' : false, scroll: document.documentElement.scrollHeight };
  });
  expect(Math.round(metrics.top)).toBe(Math.round(metrics.headerBottom));
  expect(Math.round(metrics.top + metrics.height)).toBe(metrics.vh);
  expect(Math.round(metrics.width)).toBe(metrics.vw);
  expect(metrics.barVisible).toBe(false);
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.vh + 1);
  // Les cinq onglets de l'espace animateur sont visibles, sans défilement de côté.
  const app = page.frameLocator('iframe[title="Le Passeport Numérique"]');
  for (const name of ['Séance', 'Participants', 'Défis', 'Bilan', 'Réglages']) {
    await expect(app.locator('.atabs').getByRole('button', { name, exact: true })).toBeInViewport({ timeout: 20_000 });
  }
});
