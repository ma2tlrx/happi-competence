import { expect, test } from '@playwright/test';

import { login } from './helpers';

/**
 * Passage sur les écrans des modules « financeurs » : chaque page s'ouvre sans erreur pour le bon rôle,
 * affiche son titre, ne déborde pas horizontalement, et reste fermée aux autres rôles.
 */
const PAGES: { email: string; path: string; titre: RegExp }[] = [
  { email: 'admin@demo.happi.test', path: '/admin/financements', titre: /Conventions de financement/ },
  { email: 'admin@demo.happi.test', path: '/admin/financements/financeurs', titre: /Financeurs/ },
  { email: 'admin@demo.happi.test', path: '/admin/financements/bpf', titre: /Bilan pédagogique et financier/ },
  { email: 'admin@demo.happi.test', path: '/admin/impact/fse', titre: /Tableau de bord d’impact/ },
  { email: 'admin@demo.happi.test', path: '/admin/badges', titre: /Badges numériques/ },
  { email: 'admin@demo.happi.test', path: '/admin/fiabilite', titre: /Fiabilité de la mesure/ },
  { email: 'admin@demo.happi.test', path: '/admin/referentiels/correspondances', titre: /Correspondances/ },
  { email: 'organisme@demo.happi.test', path: '/organisme/financements', titre: /Financements/ },
  { email: 'participant@demo.happi.test', path: '/participant/fiche-entree', titre: /Ma fiche d’entrée/ },
  { email: 'participant@demo.happi.test', path: '/participant/badges', titre: /Mes badges/ },
  { email: 'formateur@demo.happi.test', path: '/formateur/seconde-cotation', titre: /Seconde cotation/ },
];

for (const { email, path, titre } of PAGES) {
  test(`${path} s’ouvre pour ${email.split('@')[0]} sans débordement`, async ({ page }) => {
    await login(page, email);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(titre);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  });
}

test('la page publique « Notre méthode » est accessible sans connexion', async ({ page }) => {
  const response = await page.goto('/methode');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Notre méthode/);
});

test('les écrans financeurs sont fermés aux autres rôles', async ({ page }) => {
  await login(page, 'formateur@demo.happi.test');
  for (const path of ['/admin/financements', '/admin/badges', '/admin/fiabilite', '/participant/fiche-entree']) {
    await page.goto(path);
    await expect(page, path).not.toHaveURL(new RegExp(`${path}$`));
  }
});
