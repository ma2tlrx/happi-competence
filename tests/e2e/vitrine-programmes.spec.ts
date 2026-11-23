import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');

test('le menu public propose « Les programmes »', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link', { name: 'Les programmes' })).toHaveAttribute('href', '/programmes');
  await expect(nav.getByRole('link', { name: 'Le programme', exact: true })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Les programmes' }).click();
  await expect(page).toHaveURL(/\/programmes$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Les programmes');
});

test('/programme redirige définitivement vers /programmes', async ({ request }) => {
  const response = await request.get('/programme', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/\/programmes$/);
});

test('l’accueil présente le Passeport Numérique entre « Notre méthodologie » et « Pour qui »', async ({ page }) => {
  await page.goto('/');
  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  const methodology = headings.findIndex((text) => text.includes('Notre méthodologie'));
  const passeport = headings.findIndex((text) => text.includes('Le Passeport Numérique'));
  const audience = headings.findIndex((text) => text.includes('Pour qui'));
  expect(methodology).toBeGreaterThan(-1);
  expect(passeport).toBe(methodology + 1);
  expect(audience).toBe(passeport + 1);

  const section = page.locator('section#passeport-numerique');
  await expect(section.getByRole('heading', { level: 3, name: 'Comment ça marche' })).toBeVisible();
  await expect(section.getByRole('link', { name: 'Découvrir le Passeport Numérique' })).toHaveAttribute('href', '/programmes#passeport-numerique');
  await expect(section.getByRole('link', { name: 'M’inscrire' })).toHaveAttribute('href', '/inscription?espace=participant');
});

test('« Pour qui » s’adresse aussi aux personnes éloignées du numérique', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 3, name: 'Pour les personnes éloignées du numérique' })).toBeVisible();
});

test('la page « Les programmes » présente HAPPI Compétence puis le Passeport Numérique', async ({ page }) => {
  await page.goto('/programmes');
  const nav = page.getByRole('navigation', { name: 'Aller à un programme' });
  await expect(nav.getByRole('link', { name: 'HAPPI Compétence' })).toHaveAttribute('href', '#happi-competence');
  await expect(nav.getByRole('link', { name: 'Passeport Numérique' })).toHaveAttribute('href', '#passeport-numerique');
  const happi = page.getByRole('heading', { level: 2, name: 'Le programme HAPPI Compétence' });
  const passeport = page.getByRole('heading', { level: 2, name: 'Le Passeport Numérique' });
  await expect(happi).toBeVisible();
  await expect(passeport).toBeVisible();
  const [happiBox, passeportBox] = [await happi.boundingBox(), await passeport.boundingBox()];
  expect(passeportBox!.y).toBeGreaterThan(happiBox!.y);
  await expect(page.getByRole('link', { name: /M’inscrire au Passeport Numérique/ })).toHaveAttribute('href', '/inscription?espace=participant');
  await expect(page.getByText('Des notes mémo')).toBeVisible();
});

test('accessibilité de base : pas de violation critique ni sérieuse sur l’accueil et les programmes', async ({ page }) => {
  for (const path of ['/', '/programmes']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Le parcours épinglé de l’accueil (animation de défilement existante) est exclu de la mesure.
    // Fait apparaître les blocs « Reveal » (défilement), puis attend la fin des fondus.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: { id: string; impact: string | null; nodes: unknown[] }[] }> } }).axe;
      const result = await axe.run({ exclude: ['.sticky'] } as unknown as Document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      return result.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious').map((violation) => violation.id + ' ' + JSON.stringify((violation as unknown as { nodes: { target: string[] }[] }).nodes.map((node) => node.target)));
    });
    expect(violations, path).toEqual([]);
  }
});
