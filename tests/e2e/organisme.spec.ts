import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import { createAccount, deleteAccounts, parisDate, service, type Account } from './fixtures';
import { signInWith } from './helpers';

/**
 * Espace organisme réduit à l'essentiel : « Mes groupes », la page d'un groupe (présences, résultats de chaque
 * membre) et la relance d'une personne absente. Jeu de données neuf à chaque exécution (structure, conseillère,
 * formateur, groupe de 6 séances dont 2 terminées), supprimé à la fin : le test est rejouable.
 * Prérequis : pile locale démarrée et migration 20261121090000_absence_followups.sql appliquée.
 */
type Dataset = {
  tag: string;
  users: string[];
  counselor: Account;
  organization: { id: string; name: string };
  group: { id: string; name: string };
  people: { lucas: string; ines: string; nora: string };
  names: { lucas: string; ines: string; nora: string };
};

let data: Dataset | undefined;

function must<R extends { data: unknown; error: { message: string } | null }>(result: R, label: string): NonNullable<R['data']> {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data as NonNullable<R['data']>;
}

async function build(): Promise<Dataset> {
  const tag = randomBytes(3).toString('hex');
  const users: string[] = [];
  const program = must(await service.from('programs').select('id').eq('is_public', true).single(), 'programme') as { id: string };
  const outline = must(await service.from('program_sessions').select('id, number').eq('program_id', program.id).order('number'), 'trame') as { id: string; number: number }[];

  const organization = must(
    await service.from('organizations').insert({ name: `Structure e2e ${tag}`, status: 'active' }).select('id, name').single(),
    'structure',
  ) as { id: string; name: string };
  const counselor = await createAccount(users, 'Conseillere', 'pro', tag, `Org${tag}`);
  must(await service.from('profiles').update({ role: 'organisme' }).eq('id', counselor.id), 'rôle organisme');
  must(await service.from('organization_members').insert({ organization_id: organization.id, user_id: counselor.id, member_role: 'owner' }), 'membre de la structure');
  const trainer = await createAccount(users, 'Formateur', 'pro', tag, `Grp${tag}`);
  must(await service.from('profiles').update({ role: 'formateur' }).eq('id', trainer.id), 'rôle formateur');

  const group = must(
    await service
      .from('groups')
      .insert({ name: `Groupe e2e organisme ${tag}`, program_id: program.id, organization_id: organization.id, start_date: parisDate(-14), end_date: parisDate(28), status: 'active' })
      .select('id, name')
      .single(),
    'groupe',
  ) as { id: string; name: string };
  must(await service.from('group_trainers').insert({ group_id: group.id, trainer_id: trainer.id, is_lead: true }), 'formateur du groupe');
  const offsets = [-14, -7, 7, 14, 21, 28];
  const sessions = must(
    await service
      .from('sessions')
      .insert(
        outline.slice(0, 6).map((item, index) => ({
          group_id: group.id,
          program_session_id: item.id,
          number: item.number,
          status: index < 2 ? 'completed' : 'planned',
          scheduled_date: parisDate(offsets[index]),
          start_time: '09:00',
          end_time: '12:00',
        })),
      )
      .select('id, number')
      .order('number'),
    'séances',
  ) as { id: string; number: number }[];

  // Inscriptions et présences par le formateur, avec sa propre session (parcours réel).
  const trainerClient = createClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  must(await trainerClient.auth.signInWithPassword({ email: trainer.email, password: trainer.password }), 'connexion formateur');
  const add = async (firstName: string, lastName: string) =>
    (must(
      await trainerClient.rpc('add_participant_to_group', { p_group_id: group.id, p_first_name: firstName, p_last_name: lastName, p_email: `${firstName.toLowerCase()}.${tag}@e2e.happi.test` }),
      `ajout ${firstName}`,
    ) as { participant_id: string }).participant_id;
  const names = { lucas: `Lucas Absent${tag}`, ines: `Ines Presente${tag}`, nora: `Nora Excusee${tag}` };
  const people = { lucas: await add('Lucas', `Absent${tag}`), ines: await add('Ines', `Presente${tag}`), nora: await add('Nora', `Excusee${tag}`) };
  const [first, second] = sessions;
  must(
    await trainerClient.from('attendance').insert([
      { session_id: first!.id, participant_id: people.lucas, status: 'present' },
      { session_id: first!.id, participant_id: people.ines, status: 'present' },
      { session_id: first!.id, participant_id: people.nora, status: 'late' },
      { session_id: second!.id, participant_id: people.lucas, status: 'absent' },
      { session_id: second!.id, participant_id: people.ines, status: 'present' },
      { session_id: second!.id, participant_id: people.nora, status: 'excused' },
    ]),
    'présences',
  );
  await trainerClient.auth.signOut({ scope: 'local' });
  return { tag, users, counselor, organization, group, people, names };
}

/** Variable de l'environnement, sinon de .env.local (même lecture que fixtures.ts). */
function readEnv(key: string): string {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const line = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .find((row) => row.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} manquant dans .env.local`);
  return line.slice(key.length + 1).trim();
}

test.beforeAll(async () => {
  data = await build();
});

test.afterAll(async () => {
  if (!data) return;
  await service.from('participants').delete().in('id', Object.values(data.people));
  await service.from('groups').delete().eq('id', data.group.id);
  await service.from('organizations').delete().eq('id', data.organization.id);
  await deleteAccounts(data.users);
});

test('l’organisme suit ses groupes, consulte les résultats d’un membre et relance une personne absente, une seule fois', async ({ page }) => {
  const d = data!;
  await signInWith(page, d.counselor.email, d.counselor.password);
  await page.goto('/organisme/dashboard');

  // Le menu reste minimal : « Mes groupes », « Calendrier » (sessions de la structure) et « Aide ».
  const menu = page.getByRole('navigation', { name: 'Espace organisme' });
  await expect(menu.getByRole('link')).toHaveText(['Mes groupes', 'Calendrier', 'Aide']);

  // « Mes groupes » : la structure, puis une carte par groupe, avec le badge « à relancer ».
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.organization.name);
  const card = page.getByRole('article').filter({ has: page.getByRole('link', { name: d.group.name }) });
  await expect(card.getByText('1 à relancer')).toBeVisible();
  await expect(card.getByText('3 membres')).toBeVisible();
  await card.getByRole('link', { name: d.group.name }).click();

  // Page du groupe : séances, membres et présence en cases.
  await expect(page).toHaveURL(new RegExp(`/organisme/groupes/${d.group.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.group.name);
  await expect(page.getByRole('list', { name: 'Les séances du groupe' }).getByRole('listitem')).toHaveCount(6);
  await expect(page.getByRole('list', { name: `Présence de ${d.names.lucas}` }).getByRole('listitem')).toHaveText([/Séance 1 .*: Présent$/, /Séance 2 .*: Absent$/]);
  await expect(page.getByRole('list', { name: `Présence de ${d.names.nora}` }).getByRole('listitem')).toHaveText([
    /Séance 1 .*: Retard ou départ anticipé$/,
    /Séance 2 .*: Absence justifiée$/,
  ]);
  await expect(page.getByRole('button', { name: /^Relancer/ })).toHaveCount(1);

  // Résultats d'un membre, puis retour au groupe.
  await page.getByRole('link', { name: `Voir ses résultats : ${d.names.ines}` }).click();
  await expect(page).toHaveURL(new RegExp(`/organisme/participants/${d.people.ines}\\?groupe=${d.group.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.names.ines);
  await page.getByRole('link', { name: d.group.name }).click();
  await expect(page).toHaveURL(new RegExp(`/organisme/groupes/${d.group.id}$`));

  // Relance de la personne absente : message de succès, puis « Relancé·e le … ».
  await page.getByRole('button', { name: `Relancer ${d.names.lucas}` }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Relance envoyée à Lucas' })).toBeVisible();
  await expect(page.getByText(/^Relancé·e le \d{1,2} /)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Relancer/ })).toHaveCount(0);

  // Pas de second envoi : après rechargement, plus de bouton ; une seule relance et un seul e-mail en base.
  await page.reload();
  await expect(page.getByText(/^Relancé·e le \d{1,2} /)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Relancer/ })).toHaveCount(0);
  const followups = await service.from('absence_followups').select('id').eq('participant_id', d.people.lucas);
  expect(followups.data).toHaveLength(1);
  const emails = await service.from('email_outbox').select('template, data').eq('participant_id', d.people.lucas).eq('template', 'absence_followup');
  expect(emails.data).toHaveLength(1);
  expect(JSON.stringify(emails.data![0]!.data)).not.toMatch(/absent|excus|évaluation/i);

  // De retour sur « Mes groupes », le badge a disparu.
  await page.getByRole('link', { name: 'Mes groupes' }).first().click();
  await expect(page.getByRole('article').filter({ has: page.getByRole('link', { name: d.group.name }) }).getByText('à relancer')).toHaveCount(0);
});

/** Audit axe-core (WCAG 2.1 A et AA), comme tests/e2e/a11y.spec.ts : violations critiques ou sérieuses relevées. */
async function audit(page: Page, path: string, problems: string[]) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))));
    await page.addScriptTag({ path: join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js') });
    const violations = (await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
      return (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations;
    })) as { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[];
    for (const violation of violations.filter((item) => item.impact === 'critical' || item.impact === 'serious')) {
      problems.push(`${path} @${width}px — ${violation.id} (${violation.help}) : ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 4).join(' | ')}`);
    }
  }
}

test('les trois écrans sont accessibles (axe, WCAG 2.1 AA), à 1280 et 390 px', async ({ page }) => {
  const d = data!;
  await signInWith(page, d.counselor.email, d.counselor.password);
  const problems: string[] = [];
  for (const path of ['/organisme/dashboard', `/organisme/groupes/${d.group.id}`, `/organisme/participants/${d.people.ines}?groupe=${d.group.id}`]) {
    await audit(page, path, problems);
  }
  expect(problems).toEqual([]);
});

test('sur téléphone, la barre de navigation basse n’a jamais un seul élément', async ({ page }) => {
  const d = data!;
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWith(page, d.counselor.email, d.counselor.password);
  await page.goto('/organisme/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.organization.name);
  // Avec « Mes groupes » et « Calendrier » la barre existe ; elle ne doit jamais se réduire à un seul bouton.
  const bar = page.getByRole('navigation', { name: 'Navigation rapide' });
  if (await bar.count()) expect(await bar.getByRole('link').count()).toBeGreaterThanOrEqual(2);
  // Pas de défilement horizontal à 390 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
