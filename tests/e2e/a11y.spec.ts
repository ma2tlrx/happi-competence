import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { createE2eFixture, destroyE2eFixture, type E2eFixture } from './fixtures';
import { login, signInWith } from './helpers';

/**
 * Accessibilité (axe-core, règles WCAG 2.1 A et AA) des écrans récents, à 1280 et 390 px de
 * large, et parcours au clavier de l'émargement et de la fenêtre d'abandon. Le test échoue sur
 * toute violation « critique » ou « sérieuse ».
 * axe-core est injecté depuis node_modules (dépendance d'eslint-config-next).
 */
const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');
const WIDTHS = [1280, 390] as const;

type Violation = { id: string; impact: string | null; help: string; nodes: { target: string[] }[] };

async function audit(page: Page, path: string, problems: string[]) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Fin des animations d'apparition (opacité) avant la mesure des contrastes.
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))));
    await page.waitForTimeout(300);
    await page.addScriptTag({ path: axePath });
    const violations = (await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
      const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return result.violations;
    })) as Violation[];
    for (const violation of violations) {
      if (violation.impact !== 'critical' && violation.impact !== 'serious') continue;
      problems.push(`${path} @${width}px — ${violation.impact} ${violation.id} (${violation.help}) : ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 4).join(' | ')}`);
    }
  }
}

let f: E2eFixture;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  f = await createE2eFixture();
});
test.afterAll(async () => {
  await destroyE2eFixture(f);
});

test('pages publiques : aide, accessibilité, vérification', async ({ page }) => {
  const problems: string[] = [];
  for (const path of ['/aide', '/accessibilite', '/verifier/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']) await audit(page, path, problems);
  expect(problems).toEqual([]);
});

test('espace participant : évolution, partage, satisfaction, sécurité, aide', async ({ page }) => {
  const problems: string[] = [];
  await login(page, 'participant@demo.happi.test');
  for (const path of ['/participant/dashboard', '/participant/evolution', '/participant/partage', '/participant/satisfaction', '/compte/securite', '/aide']) {
    await audit(page, path, problems);
  }
  await page.context().clearCookies();
  await signInWith(page, f.graduate.email, f.graduate.password);
  await audit(page, `/participant/satisfaction?groupe=${f.groupDone}&moment=hot`, problems);
  expect(problems).toEqual([]);
});

test('espace formateur : émargement, suivis, groupe', async ({ page }) => {
  const problems: string[] = [];
  await signInWith(page, f.trainer.email, f.trainer.password);
  for (const path of [`/formateur/sessions/${f.sessionToday}/presences/emargement`, `/formateur/sessions/${f.sessionToday}/presences`, '/formateur/suivis', `/formateur/groupes/${f.groupToday}`]) {
    await audit(page, path, problems);
  }
  expect(problems).toEqual([]);
});

test('espaces organisme et administrateur : impact, satisfaction, suivis', async ({ page }) => {
  const problems: string[] = [];
  await login(page, 'organisme@demo.happi.test');
  for (const path of ['/organisme/impact', '/organisme/satisfaction', '/organisme/suivis']) await audit(page, path, problems);
  await page.context().clearCookies();
  await login(page, 'admin@demo.happi.test');
  for (const path of ['/admin/impact', '/admin/satisfaction', '/admin/suivis']) await audit(page, path, problems);
  expect(problems).toEqual([]);
});

/** Appuie sur Tab jusqu'à atteindre l'élément dont le nom accessible correspond (au plus 60 fois). */
async function tabTo(page: Page, name: RegExp) {
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return '';
      const labelled = element.id ? document.querySelector(`label[for="${element.id}"]`)?.textContent : '';
      return `${element.getAttribute('aria-label') ?? ''} ${labelled ?? ''} ${element.innerText ?? ''}`.trim();
    });
    if (name.test(label)) {
      // Le focus doit être visible (contour non nul).
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
      expect(outline, `focus visible sur « ${label} »`).not.toBe('none');
      return;
    }
  }
  throw new Error(`Élément introuvable au clavier : ${name}`);
}

test('émargement au clavier : choisir un participant, saisir « signature impossible », revenir à la liste', async ({ page }) => {
  await signInWith(page, f.trainer.email, f.trainer.password);
  await page.goto(`/formateur/sessions/${f.sessionToday}/presences/emargement`);
  await expect(page.getByRole('heading', { name: /Participants présents/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await tabTo(page, new RegExp(`${f.names.signer}[\\s\\S]*Faire signer`));
  await page.keyboard.press('Enter');
  // Le focus passe sur le nom du signataire.
  await expect(page.getByRole('heading', { name: f.names.signer })).toBeFocused();
  await tabTo(page, /Signature impossible/);
  await page.keyboard.press('Enter');
  await tabTo(page, /Motif/);
  await page.keyboard.type('Main blessée, ne peut pas tenir le stylet.');
  await tabTo(page, /Enregistrer « signature impossible »/);
  await page.keyboard.press('Enter');
  await expect(page.getByText(new RegExp(`${f.names.signer} : mention enregistrée`))).toBeVisible();
  await expect(page.getByRole('heading', { name: /Participants présents/ })).toBeFocused();
});

test('fenêtre d’abandon au clavier : ouverture, fermeture par Échap, déclaration', async ({ page }) => {
  const leaver = `Partant Abandon${f.tag}`;
  await signInWith(page, f.trainer.email, f.trainer.password);
  await page.goto(`/formateur/groupes/${f.groupToday}`);
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('button', { name: `Déclarer l’abandon de ${leaver}` });
  await tabTo(page, new RegExp(`Déclarer l’abandon de ${leaver}`));
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: `Déclarer l’abandon de ${leaver}` });
  await expect(dialog).toBeVisible();
  // Le focus est dans la fenêtre ; Échap la ferme et rend le focus au bouton.
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await tabTo(page, /Motif/);
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByLabel('Motif')).not.toHaveValue('');
  await tabTo(page, /^Déclarer l’abandon$/);
  await page.keyboard.press('Enter');
  await expect(page.getByText(`Abandon de ${leaver} enregistré.`)).toBeVisible();
  await expect(dialog).toBeHidden();
});
