import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { createAccount, deleteAccounts, parisDate, service, type Account } from './fixtures';
import { signInWith } from './helpers';

/**
 * Planification des sessions par le formateur : chaque session a sa date, son horaire et son lieu.
 * Jeu de données propre (un formateur, un groupe du programme public sans aucune session), supprimé à la fin.
 */
const users: string[] = [];
let trainer: Account;
let groupId: string | undefined;

const LOCATION = 'Salle des Tilleuls';
const axePath = join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');

/** Ajoute des jours à une date AAAA-MM-JJ (en UTC). */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const field = (page: Page, label: string, number: number) => page.getByLabel(`${label} de la session ${number}`, { exact: true });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tag = randomBytes(3).toString('hex');
  trainer = await createAccount(users, 'Planif', 'pro', tag, `E2e${tag}`);
  const role = await service.from('profiles').update({ role: 'formateur' }).eq('id', trainer.id);
  if (role.error) throw new Error(`rôle formateur : ${role.error.message}`);
  const program = await service.from('programs').select('id').eq('is_public', true).single();
  if (program.error) throw new Error(`programme : ${program.error.message}`);
  const group = await service
    .from('groups')
    .insert({ name: `Groupe e2e planification ${tag}`, program_id: program.data.id, start_date: parisDate(7), end_date: parisDate(60), status: 'planned' })
    .select('id')
    .single();
  if (group.error) throw new Error(`groupe : ${group.error.message}`);
  groupId = group.data.id as string;
  const lead = await service.from('group_trainers').insert({ group_id: groupId, trainer_id: trainer.id, is_lead: true });
  if (lead.error) throw new Error(`formateur du groupe : ${lead.error.message}`);
});

test.afterAll(async () => {
  // Les sessions et l'attribution du formateur partent avec le groupe (suppression en cascade).
  if (groupId) await service.from('groups').delete().eq('id', groupId);
  await deleteAccounts(users);
});

test('le formulaire tient à 1280 et 390 px, sans défaut d’accessibilité sérieux', async ({ page }) => {
  await signInWith(page, trainer.email, trainer.password);
  const problems: string[] = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    await page.goto(`/formateur/groupes/${groupId}`);
    await expect(field(page, 'Date', 1)).toBeVisible();
    await expect(field(page, 'Lieu', 6)).toBeAttached();
    await expect(page.getByRole('button', { name: 'Créer les 6 sessions' })).toBeVisible();
    // Valeurs de départ : une date par semaine depuis le début du groupe, 09:00–12:00.
    await expect(field(page, 'Date', 3)).toHaveValue(addDays(parisDate(7), 14));
    await expect(field(page, 'Début', 3)).toHaveValue('09:00');
    await expect(field(page, 'Fin', 3)).toHaveValue('12:00');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
    await page.addScriptTag({ path: axePath });
    const violations = (await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
      const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return result.violations;
    })) as { id: string; impact: string | null; nodes: { target: string[] }[] }[];
    for (const violation of violations) {
      if (violation.impact === 'critical' || violation.impact === 'serious') problems.push(`${width}px — ${violation.id} : ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`);
    }
  }
  expect(problems).toEqual([]);
});

test('chaque session garde son horaire ; une date dans le désordre est refusée sur sa ligne', async ({ page }) => {
  await signInWith(page, trainer.email, trainer.password);
  await page.goto(`/formateur/groupes/${groupId}`);
  // Formulaire hydraté avant toute saisie : sinon React repart de ses valeurs de départ au premier rendu.
  await page.waitForLoadState('networkidle');
  const first = parisDate(9);

  // Session 1 remplie, puis recopiée sur les suivantes : une semaine plus tard, mêmes horaires, même lieu.
  await field(page, 'Date', 1).fill(first);
  await field(page, 'Début', 1).fill('14:00');
  await field(page, 'Fin', 1).fill('17:00');
  await field(page, 'Lieu', 1).fill(LOCATION);
  await page.getByRole('button', { name: 'Recopier sur les suivantes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recopié sur les 5 sessions suivantes.' })).toBeVisible();
  for (const number of [2, 3, 4, 5, 6]) {
    await expect(field(page, 'Date', number)).toHaveValue(addDays(first, (number - 1) * 7));
    await expect(field(page, 'Début', number)).toHaveValue('14:00');
    await expect(field(page, 'Fin', number)).toHaveValue('17:00');
    await expect(field(page, 'Lieu', number)).toHaveValue(LOCATION);
  }

  // Seule la session 3 change d'horaire.
  await field(page, 'Début', 3).fill('09:30');
  await field(page, 'Fin', 3).fill('11:30');

  // Date de la session 4 avant celle de la session 3 : refus, message sous le bon champ, rien n'est créé.
  await field(page, 'Date', 4).fill(addDays(first, 7));
  await page.getByRole('button', { name: 'Créer les 6 sessions' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Certains champs sont à corriger.' })).toBeVisible();
  await expect(field(page, 'Date', 4)).toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 'Date', 4)).toHaveAccessibleDescription('Cette date précède celle de la session 3.');
  await expect(field(page, 'Date', 4)).toBeFocused();
  await expect(field(page, 'Date', 5)).not.toHaveAttribute('aria-invalid', 'true');
  const refused = await service.from('sessions').select('id', { count: 'exact', head: true }).eq('group_id', groupId!);
  expect(refused.count).toBe(0);
  // Les saisies sont conservées après le refus.
  await expect(field(page, 'Début', 3)).toHaveValue('09:30');

  // Correction, puis création.
  await field(page, 'Date', 4).fill(addDays(first, 21));
  await page.getByRole('button', { name: 'Créer les 6 sessions' }).click();
  await expect(page).toHaveURL(/planifie=6/);
  await expect(page.getByText('6 sessions créées')).toBeVisible();

  const { data, error } = await service.from('sessions').select('number, scheduled_date, start_time, end_time, location').eq('group_id', groupId!).order('number');
  expect(error).toBeNull();
  expect(data).toHaveLength(6);
  for (const session of data!) {
    const own = session.number === 3;
    expect(session, `session ${session.number}`).toEqual({
      number: session.number,
      scheduled_date: addDays(first, (session.number - 1) * 7),
      start_time: own ? '09:30:00' : '14:00:00',
      end_time: own ? '11:30:00' : '17:00:00',
      location: LOCATION,
    });
  }
  // Plus rien à planifier : le formulaire disparaît.
  await expect(page.getByRole('button', { name: /^Créer les \d+ sessions$/ })).toHaveCount(0);
});
