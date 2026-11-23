import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { createAccount, createE2eFixture, deleteAccounts, destroyE2eFixture, parisDate, service, type Account, type E2eFixture } from './fixtures';
import { login, signInWith } from './helpers';

/**
 * Calendrier des sessions dans les quatre espaces. Jeu de données propre (formateur, groupe du jour,
 * groupe terminé, participant, organisme) supprimé à la fin ; l'administrateur est le compte de démonstration.
 * Captures : E2E_SHOTS=<dossier> pour les enregistrer (desktop 1366×800, téléphone 390×844).
 */
let fixture: E2eFixture;
let organisme: Account;
let orgId: string;
const extra: string[] = [];
const shots = process.env.E2E_SHOTS;
const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fixture = await createE2eFixture();
  const tag = randomBytes(3).toString('hex');
  organisme = await createAccount(extra, 'Organisme', 'pro', tag, `Cal${tag}`);
  await service.from('profiles').update({ role: 'organisme' }).eq('id', organisme.id);
  const org = await service.from('organizations').insert({ name: `Structure calendrier ${tag}`, status: 'active' }).select('id').single();
  orgId = org.data!.id;
  await service.from('organization_members').insert({ organization_id: orgId, user_id: organisme.id });
  await service.from('groups').update({ organization_id: orgId }).eq('id', fixture.groupToday);
  // Une 2e session le même jour, annulée, et une session sans horaire demain : statuts et jour entier.
  const outline = await service.from('program_sessions').select('id, number').eq('program_id', (await service.from('groups').select('program_id').eq('id', fixture.groupToday).single()).data!.program_id).order('number');
  await service.from('sessions').insert([
    { group_id: fixture.groupToday, program_session_id: outline.data![1]!.id, number: outline.data![1]!.number, status: 'cancelled', scheduled_date: parisDate(), start_time: '14:00', end_time: '16:00', location: 'Salle des Tilleuls' },
    { group_id: fixture.groupToday, program_session_id: outline.data![2]!.id, number: outline.data![2]!.number, status: 'planned', scheduled_date: parisDate(1) },
  ]);
});

test.afterAll(async () => {
  await destroyE2eFixture(fixture);
  await service.from('organizations').delete().eq('id', orgId);
  await deleteAccounts(extra);
});

async function shoot(page: Page, name: string) {
  if (!shots) return;
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.screenshot({ path: join(shots, `${name}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-mobile.png`), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 800 });
}

async function axe(page: Page) {
  await page.addScriptTag({ path: axePath });
  const violations = (await page.evaluate(async () => {
    const lib = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
    return (await lib.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations;
  })) as { id: string; impact: string | null; nodes: { target: string[] }[] }[];
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test('formateur : ses sessions, statuts en texte, détail avec lien, navigation et vues', async ({ page }) => {
  await signInWith(page, fixture.trainer.email, fixture.trainer.password);
  await page.goto('/formateur/calendrier');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendrier' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Calendrier' }).first()).toBeVisible();

  const grid = page.getByRole('list', { name: 'Jours du mois' });
  const pill = grid.getByRole('button', { name: /Groupe e2e du jour.*Session 1 —.*(à venir|en cours|terminée)$/ });
  await expect(pill).toBeVisible();
  await expect(grid.getByRole('button', { name: /annulée$/ })).toBeVisible();
  await expect(grid.getByRole('button', { name: /Groupe e2e du jour.*Session 3 —.*Horaire à définir/ })).toBeVisible();
  await shoot(page, 'formateur-mois');

  await pill.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: 'Ouvrir la session' })).toHaveAttribute('href', `/formateur/sessions/${fixture.sessionToday}`);
  await expect(dialog).toContainText('Groupe e2e du jour');
  await expect(dialog).toContainText('09:00 – 12:00');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: 'Semaine', exact: true }).click();
  await expect(page).toHaveURL(/vue=semaine/);
  await expect(page.getByRole('list', { name: 'Jours de la semaine' })).toBeVisible();
  await shoot(page, 'formateur-semaine');

  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).toContainText('Aujourd’hui');
  await shoot(page, 'formateur-agenda');

  await page.getByRole('link', { name: 'Mois suivant' }).click();
  await page.getByRole('link', { name: 'Mois suivant' }).click();
  await page.getByRole('link', { name: 'Mois suivant' }).click();
  await expect(page.getByText('Aucune session à cette période.').first()).toBeVisible();
  await page.getByRole('link', { name: 'Aujourd’hui' }).click();
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).toContainText('Groupe e2e du jour');
  expect(await axe(page), 'axe agenda').toEqual([]);
});

test('formateur : le groupe terminé apparaît à sa date, le filtre par groupe réduit', async ({ page }) => {
  await signInWith(page, fixture.trainer.email, fixture.trainer.password);
  await page.goto(`/formateur/calendrier?vue=agenda&date=${parisDate(-5)}`);
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).toContainText('Groupe e2e terminé');
  await page.goto(`/formateur/calendrier?vue=agenda&groupe=${fixture.groupToday}`);
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).not.toContainText('Groupe e2e terminé');
});

test('formateur : export ICS authentifié', async ({ page, browser }) => {
  await signInWith(page, fixture.trainer.email, fixture.trainer.password);
  const response = await page.request.get('/api/calendrier/ics');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/calendar');
  const body = await response.text();
  expect(body).toContain('BEGIN:VEVENT');
  expect(body).toContain('Groupe e2e du jour');
  expect(body).not.toContain('PRIVATE');
  const anonymous = await browser.newContext({ baseURL: page.url() ? new URL(page.url()).origin : undefined });
  expect((await anonymous.request.get('/api/calendrier/ics')).status()).toBe(401);
  await anonymous.close();
});

test('participant : ses sessions seulement, lien vers son parcours', async ({ page }) => {
  await signInWith(page, fixture.learner.email, fixture.learner.password);
  await page.goto('/participant/calendrier');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendrier' })).toBeVisible();
  const pill = page.getByRole('list', { name: 'Jours du mois' }).getByRole('button', { name: /Groupe e2e du jour.*Session 1 —/ });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Voir mon parcours' })).toHaveAttribute('href', '/participant/parcours');
  await page.keyboard.press('Escape');
  await page.goto(`/participant/calendrier?vue=agenda&date=${parisDate(-5)}`);
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).not.toContainText('Groupe e2e terminé');
  await page.goto('/participant/calendrier');
  await shoot(page, 'participant-mois');
  expect(await axe(page), 'axe participant').toEqual([]);
});

test('organisme : les sessions des groupes de sa structure', async ({ page }) => {
  await signInWith(page, organisme.email, organisme.password);
  await page.goto('/organisme/calendrier');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendrier' })).toBeVisible();
  const pill = page.getByRole('list', { name: 'Jours du mois' }).getByRole('button', { name: /Groupe e2e du jour.*Session 1 —/ });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Voir le groupe' })).toHaveAttribute('href', `/organisme/groupes/${fixture.groupToday}`);
  await page.keyboard.press('Escape');
  await page.goto(`/organisme/calendrier?vue=agenda&date=${parisDate(-5)}`);
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).not.toContainText('Groupe e2e terminé');
  await page.goto('/organisme/calendrier');
  await shoot(page, 'organisme-mois');
  expect(await axe(page), 'axe organisme').toEqual([]);
});

test('administrateur : toutes les sessions, filtres organisme / formateur / groupe / statut', async ({ page }) => {
  await login(page, 'admin@demo.happi.test');
  await page.goto('/admin/calendrier');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendrier' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Calendrier' }).first()).toBeVisible();
  for (const label of ['Filtrer par organisme', 'Filtrer par formateur', 'Filtrer par groupe', 'Filtrer par statut']) await expect(page.getByLabel(label)).toBeVisible();
  await page.goto(`/admin/calendrier?vue=agenda&groupe=${fixture.groupToday}`);
  const list = page.getByRole('list', { name: 'Sessions du mois' }).first();
  await expect(list).toContainText('Groupe e2e du jour');
  await expect(list).not.toContainText('Groupe e2e terminé');
  await page.goto(`/admin/calendrier?vue=agenda&organisme=${orgId}&statut=annulee`);
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).toContainText('Annulée');
  await page.goto(`/admin/calendrier?vue=agenda&formateur=${fixture.trainer.id}&date=${parisDate(-5)}`);
  await expect(page.getByRole('list', { name: 'Sessions du mois' }).first()).toContainText('Groupe e2e terminé');
  await page.goto('/admin/calendrier');
  await shoot(page, 'admin-mois');
  expect(await axe(page), 'axe admin').toEqual([]);
  // L'export ICS n'est pas proposé à l'administrateur.
  expect((await page.request.get('/api/calendrier/ics')).status()).toBe(403);
});
