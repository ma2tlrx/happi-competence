/**
 * Jeu de données propre à un fichier de tests de bout en bout, créé avec la clé de service
 * puis supprimé à la fin (comme tests/security/fixtures.ts). Il ne dépend ni de la date à
 * laquelle la démonstration a été créée, ni des tests précédents (signatures, réponses aux
 * enquêtes et abandons ne s'annulent pas : chaque exécution repart d'un jeu neuf).
 *
 * Contenu : un formateur ; un groupe « du jour » (séance 1 aujourd'hui, à Paris) avec un
 * participant inscrit (compte) et deux fiches sans compte, tous notés présents ; un groupe
 * terminé il y a 5 jours (enquête de satisfaction « à chaud » ouverte) avec un participant inscrit.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function loadEnv() {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const index = line.indexOf('=');
      if (index > 0 && !line.startsWith('#')) values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  } catch {
    // Variables fournies par l'environnement.
  }
  const get = (key: string) => process.env[key] ?? values[key];
  const url = get('NEXT_PUBLIC_SUPABASE_URL');
  const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const service = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new Error('Tests e2e : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('Les jeux de données e2e ne visent que la pile locale.');
  return { url, anon, service };
}

const env = loadEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const service: SupabaseClient = createClient(env.url, env.service, options);

function must<R extends { data: unknown; error: { message: string } | null }>(result: R, label: string): NonNullable<R['data']> {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data as NonNullable<R['data']>;
}

/** Date du jour à Paris (AAAA-MM-JJ), comme la base. */
export function parisDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export type Account = { id: string; email: string; password: string; firstName: string; lastName: string };

/** Compte jetable (adresse en @e2e.happi.test), supprimé par destroy(). */
export async function createAccount(created: string[], name: string, accountType: 'participant' | 'pro', tag: string, lastName = 'Essai'): Promise<Account> {
  const email = `${name.toLowerCase()}.${tag}@e2e.happi.test`;
  const password = `E2e-${randomBytes(12).toString('base64url')}9`;
  const data = must(
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: accountType, first_name: name, last_name: lastName, terms_accepted: true, privacy_consent: true, consent_version: 'e2e' },
    }),
    `compte ${name}`,
  );
  created.push(data.user!.id);
  return { id: data.user!.id, email, password, firstName: name, lastName };
}

export async function deleteAccounts(ids: string[]) {
  for (const id of ids) await service.auth.admin.deleteUser(id);
}

export type E2eFixture = Awaited<ReturnType<typeof createE2eFixture>>;

export async function createE2eFixture() {
  const tag = randomBytes(3).toString('hex');
  const users: string[] = [];
  try {
    return await build(tag, users);
  } catch (error) {
    // Jeu incomplet : on retire ce qui a été créé (les fiches et groupes portent le suffixe).
    await service.from('participants').delete().like('last_name', `%${tag}`);
    await service.from('groups').delete().like('name', `%${tag}`);
    await deleteAccounts(users);
    throw error;
  }
}

async function build(tag: string, users: string[]) {
  const program = must(await service.from('programs').select('id').eq('is_public', true).single(), 'programme');
  const outline = must(await service.from('program_sessions').select('id, number').eq('program_id', program.id).order('number'), 'trame') as { id: string; number: number }[];

  const trainer = await createAccount(users, 'Formatrice', 'pro', tag, `E2e${tag}`);
  must(await service.from('profiles').update({ role: 'formateur' }).eq('id', trainer.id), 'rôle formateur');
  const learner = await createAccount(users, 'Apprenante', 'participant', tag, `Jour${tag}`);
  const graduate = await createAccount(users, 'Diplomee', 'participant', tag, `Fin${tag}`);

  const [today, done] = must(
    await service
      .from('groups')
      .insert([
        { name: `Groupe e2e du jour ${tag}`, program_id: program.id, start_date: parisDate(), end_date: parisDate(40), status: 'active' },
        { name: `Groupe e2e terminé ${tag}`, program_id: program.id, start_date: parisDate(-40), end_date: parisDate(-5), status: 'completed' },
      ])
      .select('id'),
    'groupes',
  ) as { id: string }[];
  must(
    await service.from('group_trainers').insert([
      { group_id: today!.id, trainer_id: trainer.id, is_lead: true },
      { group_id: done!.id, trainer_id: trainer.id, is_lead: true },
    ]),
    'formateurs',
  );

  // Inscriptions par le formateur, avec sa propre session (parcours réel).
  const trainerClient = createClient(env.url, env.anon, options);
  must(await trainerClient.auth.signInWithPassword({ email: trainer.email, password: trainer.password }), 'connexion formateur');
  const add = async (groupId: string, firstName: string, lastName: string, email: string) =>
    (must(await trainerClient.rpc('add_participant_to_group', { p_group_id: groupId, p_first_name: firstName, p_last_name: lastName, p_email: email }), `ajout ${firstName}`) as {
      participant_id: string;
    }).participant_id;
  const learnerId = await add(today!.id, learner.firstName, learner.lastName, learner.email);
  const signerId = await add(today!.id, 'Signataire', `Tablette${tag}`, `signataire.${tag}@e2e.happi.test`);
  const leaverId = await add(today!.id, 'Partant', `Abandon${tag}`, `partant.${tag}@e2e.happi.test`);
  const graduateId = await add(done!.id, graduate.firstName, graduate.lastName, graduate.email);

  const [sessionToday] = must(
    await service
      .from('sessions')
      .insert([
        { group_id: today!.id, program_session_id: outline[0]!.id, number: outline[0]!.number, status: 'planned', scheduled_date: parisDate(), start_time: '09:00', end_time: '12:00' },
        { group_id: done!.id, program_session_id: outline[0]!.id, number: outline[0]!.number, status: 'completed', scheduled_date: parisDate(-5), start_time: '09:00', end_time: '12:00' },
      ])
      .select('id, group_id'),
    'séances',
  ) as { id: string }[];
  must(
    await trainerClient.from('attendance').insert(
      [learnerId, signerId, leaverId].map((participantId) => ({ session_id: sessionToday!.id, participant_id: participantId, status: 'present' })),
    ),
    'présences',
  );
  await trainerClient.auth.signOut({ scope: 'local' });

  return {
    tag,
    users,
    trainer,
    learner,
    graduate,
    groupToday: today!.id,
    groupDone: done!.id,
    sessionToday: sessionToday!.id,
    participants: { learner: learnerId, signer: signerId, leaver: leaverId, graduate: graduateId },
    names: { signer: `TABLETTE${tag.toUpperCase()} Signataire`, leaver: `Partant Abandon${tag}` },
  };
}

export async function destroyE2eFixture(fixture: E2eFixture | undefined) {
  if (!fixture) return;
  await service.from('participants').delete().in('id', Object.values(fixture.participants));
  await service.from('groups').delete().in('id', [fixture.groupToday, fixture.groupDone]);
  await deleteAccounts(fixture.users);
}

/**
 * Séance d'un groupe de démonstration. Les tests passent par son adresse plutôt que par
 * l'encart « séance du jour » du tableau de bord, qui n'existe que le jour de npm run demo:seed.
 */
export async function demoSessionId(groupName: string, number: number) {
  const group = must(await service.from('groups').select('id').eq('is_demo', true).eq('name', groupName).single(), `groupe ${groupName}`) as { id: string };
  const session = must(await service.from('sessions').select('id').eq('group_id', group.id).eq('number', number).single(), `séance ${number}`) as { id: string };
  return session.id;
}
