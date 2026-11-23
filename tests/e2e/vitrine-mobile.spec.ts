import { expect, test } from '@playwright/test';

/** Version téléphone (Pixel 7, moins de 640 px) du site vitrine : simplifiée, sans perte de contenu. */
test('accueil sur téléphone : pas de défilement horizontal, page plus courte', async ({ page }) => {
  for (const path of ['/', '/programmes']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await page.goto('/');
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThan(16000);
});

test('les contenus repliés sur téléphone s’ouvrent et se referment au clavier et au toucher', async ({ page }) => {
  await page.goto('/');
  for (const name of [/Voir un exemple de passeport/, /Voir l’échelle et les compétences/, /Voir les exercices/, /Voir les témoignages/]) {
    const first = page.getByRole('button', { name }).first();
    await first.scrollIntoViewIfNeeded();
    const panelId = await first.getAttribute('aria-controls');
    // Le nom du bouton change (« Voir » puis « Masquer ») : on le retrouve par son panneau.
    const button = page.locator(`button[aria-controls="${panelId}"]`);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const panel = page.locator(`[id="${panelId}"]`);
    await expect(panel).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await button.click();
    await expect(panel).toBeHidden();
  }
});

test('le parcours des six sessions est une liste courte avec compétences dépliables', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('summary', { hasText: 'Compétences travaillées' }).first();
  await summary.scrollIntoViewIfNeeded();
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const details = summary.locator('xpath=..');
  await expect(details).not.toHaveAttribute('open', '');
  await summary.click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('p')).toBeVisible();
});

test('l’illustration du Passeport Numérique est masquée sur téléphone, le contenu reste accessible', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('section#passeport-numerique');
  await expect(section.getByText('Illustration : l’écran des mondes d’exercices.')).toBeHidden();
  await expect(section.getByRole('heading', { level: 3, name: 'Comment ça marche' })).toBeVisible();
  await section.getByRole('button', { name: /Voir les exercices/ }).click();
  await expect(section.getByText('Vrai ou arnaque ?')).toBeVisible();
});
