import { expect, test, type Browser, type Page } from '@playwright/test';

import { login, unique } from './helpers';

/**
 * Passeport Numérique : choix du programme à l'inscription, questionnaire propre à ce programme (celui de
 * l'application), choix du formateur dans « Programmes », espace animateur sans code.
 */
async function signUp(page: Page, programme: 'HAPPI Compétence' | 'Passeport Numérique') {
  const email = `pn.${unique()}@demo.happi.test`;
  await page.goto('/inscription?espace=participant');
  await expect(page.getByRole('heading', { name: 'Pour quel programme vous inscrivez-vous ?' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: new RegExp(`^${programme}`) }).click();
  await expect(page.getByText(`Programme : ${programme}`)).toBeVisible();
  await page.locator('input[name=firstName]').fill('Camille');
  await page.locator('input[name=lastName]').fill('Essai');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('input[name=password]').fill('MotDePasse2026');
  await page.locator('input[name=passwordConfirm]').fill('MotDePasse2026');
  await page.locator('input[name=terms]').check();
  await page.locator('input[name=privacy]').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  return email;
}

/** Un formateur valide le compte « Camille Essai » : il le rattache à une session (groupe) du Passeport Numérique. */
async function approveAsTrainer(browser: Browser) {
  const context = await browser.newContext();
  const trainer = await context.newPage();
  await login(trainer, 'formateur@demo.happi.test');
  await trainer.goto('/formateur/groupes?nouveau=1');
  await trainer.getByLabel('Nom du groupe').fill(`Atelier numérique ${unique()}`);
  await trainer.getByLabel('Programme').selectOption({ label: 'Passeport Numérique' });
  await trainer.getByRole('button', { name: 'Créer le groupe' }).click();
  await trainer.goto('/formateur/programmes?programme=passeport-numerique');
  const row = trainer.getByRole('listitem').filter({ hasText: 'Camille Essai' }).first();
  await row.getByRole('button', { name: 'Valider' }).click();
  await expect(trainer.getByText(/accès aux ateliers est ouvert/)).toBeVisible();
  await context.close();
}

test('inscription au Passeport Numérique : compte en attente de validation, sans accès aux ateliers', async ({ page }) => {
  await signUp(page, 'Passeport Numérique');
  await expect(page).toHaveURL(/\/participant\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nous contacter' })).toHaveAttribute('href', '/contact');
  await expect(page.getByRole('link', { name: 'Continuer mes exercices' })).toHaveCount(0);
  expect((await page.request.get('/passeport-numerique/app')).status()).toBe(403);
  await page.goto('/participant/passeport-numerique');
  await expect(page).toHaveURL(/\/participant\/dashboard/);
});

test('inscription au Passeport Numérique validée par le formateur : le questionnaire est celui de l’application, sans compte à recréer', async ({ page, browser }) => {
  await signUp(page, 'Passeport Numérique');
  await expect(page.getByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeVisible();
  await approveAsTrainer(browser);
  await page.goto('/participant/passeport-numerique');
  // Ni le questionnaire d'accueil HAPPI, ni l'auto-évaluation : directement l'application.
  await expect(page).toHaveURL(/\/participant\/passeport-numerique$/);
  const app = page.frameLocator('iframe[title="Le Passeport Numérique"]');
  await expect(app.getByRole('heading', { name: /Avant de commencer|informations/i }).first()).toBeVisible({ timeout: 20_000 });
  // Pas d'écran de création de compte propre à l'application (prénom, nom, code à quatre chiffres).
  await expect(app.getByText('Écrivez votre prénom et votre nom.')).toHaveCount(0);
  await expect(app.getByRole('button', { name: /Espace animateur/ })).toHaveCount(0);

  // Le menu et l'accueil sont ceux du Passeport Numérique.
  await page.goto('/participant/dashboard');
  await expect(page.getByRole('heading', { name: 'Votre Passeport Numérique' })).toBeVisible();
  const menu = page.getByRole('navigation', { name: 'Mon passeport' });
  await expect(menu.getByRole('link', { name: 'Passeport Numérique' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Mes compétences' })).toHaveCount(0);
  // Le questionnaire d'accueil HAPPI n'est jamais proposé.
  await page.goto('/bienvenue');
  await expect(page).toHaveURL(/\/participant\/passeport-numerique$/);
});

test('inscription à HAPPI Compétence : le questionnaire d’accueil HAPPI, et pas l’application du Passeport Numérique', async ({ page }) => {
  await signUp(page, 'HAPPI Compétence');
  await expect(page).toHaveURL(/\/bienvenue$/);
  await expect(page.getByText('Étape 1 sur 6')).toBeVisible();
  const response = await page.request.get('/passeport-numerique/app');
  expect(response.status()).toBe(403);
  await page.goto('/participant/passeport-numerique');
  await expect(page).toHaveURL(/\/participant\/dashboard/);
  await expect(page.getByRole('navigation', { name: 'Mon passeport' }).getByRole('link', { name: 'Passeport Numérique' })).toHaveCount(0);
});

test('le formateur choisit entre HAPPI Compétence et Passeport Numérique, puis ouvre l’espace animateur sans code', async ({ page }) => {
  await login(page, 'formateur@demo.happi.test');
  await page.goto('/formateur/programmes');
  const choice = page.getByRole('navigation', { name: 'Programmes' }).first();
  await expect(choice.getByRole('link', { name: /^HAPPI Compétence/ })).toHaveAttribute('aria-current', 'page');
  await choice.getByRole('link', { name: /^Passeport Numérique/ }).click();
  await expect(page).toHaveURL(/programme=passeport-numerique/);
  await expect(page.getByText('Mondes d’exercices')).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir l’espace animateur' }).click();
  await expect(page).toHaveURL(/\/formateur\/programmes\/passeport-numerique$/);

  const app = page.frameLocator('iframe[title="Le Passeport Numérique"]');
  // L'espace animateur est ouvert d'emblée : aucun code demandé.
  await expect(app.getByText('Espace animateur').first()).toBeVisible({ timeout: 20_000 });
  await expect(app.getByLabel('Code animateur')).toHaveCount(0);
});

test('l’application n’est servie ni aux visiteurs, ni aux organismes, et sans code ni service tiers', async ({ page, browser }) => {
  const anonymous = await browser.newContext();
  const refused = await anonymous.request.get('/passeport-numerique/app', { maxRedirects: 0 });
  expect([307, 401]).toContain(refused.status());
  await anonymous.close();

  await login(page, 'organisme@demo.happi.test');
  expect((await page.request.get('/passeport-numerique/app')).status()).toBe(403);

  await login(page, 'formateur@demo.happi.test');
  const ok = await page.request.get('/passeport-numerique/app');
  expect(ok.status()).toBe(200);
  const html = await ok.text();
  expect(html).not.toContain("'1111'");
  expect(html).not.toContain('fonts.googleapis.com');
  expect(html).not.toContain('cdnjs.cloudflare.com');
  expect(ok.headers()['content-security-policy']).toContain("connect-src 'self' blob:");
  expect(ok.headers()['x-frame-options']).toBe('SAMEORIGIN');
});

test('l’application s’affiche en grand dans la page, menu conservé, et ramène à l’espace HAPPI quand on la quitte', async ({ page, browser }) => {
  await signUp(page, 'Passeport Numérique');
  await approveAsTrainer(browser);
  await page.goto('/participant/passeport-numerique');
  await expect(page).toHaveURL(/\/participant\/passeport-numerique$/);
  const frame = page.locator('iframe[title="Le Passeport Numérique"]');
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  const viewport = page.viewportSize()!;
  // Le cadre va jusqu'au bas de la fenêtre, à droite du menu (pas le plein écran du navigateur).
  expect(Math.round(box!.y + box!.height)).toBe(viewport.height);
  expect(box!.width).toBeGreaterThan(viewport.width * 0.6);
  expect(box!.x).toBeGreaterThan(0);
  // Toute la largeur à droite du menu : aucune marge vide de chaque côté.
  expect(Math.round(box!.x + box!.width)).toBe(viewport.width);

  const app = page.frameLocator('iframe[title="Le Passeport Numérique"]');
  await app.locator('[data-a=cAge][data-v="26 à 39 ans"]').click();
  await app.locator('[data-a=cOk]').click();
  await app.locator('[data-a=iSkip]').click();
  await app.locator('[data-a=dev][data-v=phone]').click();
  await app.locator('[data-a=envdone]').click();
  await app.locator('[data-a=evSkip]').click();
  await expect(app.getByRole('heading', { name: /Le passeport de Camille/ })).toBeVisible();
  await app.getByRole('button', { name: 'Retour à mon espace HAPPI' }).click();
  await expect(page).toHaveURL(/\/participant\/dashboard$/);
});
