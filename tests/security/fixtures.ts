/**
 * Jeu de données isolé pour les tests de sécurité, créé avec la clé de service
 * puis supprimé en fin de test. Deux organismes (A et B), leurs membres, deux
 * formateurs, un participant avec compte par organisme, une session terminée
 * par groupe, des présences et une évaluation validée de chaque côté.
 *
 * Prérequis : pile locale démarrée (npm run db:start) et .env.local renseigné.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

function loadEnv() {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const index = line.indexOf('=');
      if (index > 0 && !line.startsWith('#')) values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  } catch {
    // Variables fournies par l'environnement (intégration continue).
  }
  const get = (key: string) => process.env[key] ?? values[key];
  const url = get('NEXT_PUBLIC_SUPABASE_URL');
  const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const service = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new Error('Tests de sécurité : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  if (!/localhost|127\.0\.0\.1/.test(url) && process.env.HAPPI_ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('Les tests de sécurité créent et suppriment des données : ils ne visent que la pile locale (HAPPI_ALLOW_REMOTE_TESTS=true pour forcer).');
  }
  return { url, anon, service };
}

export const env = loadEnv();
export type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const service: Client = createClient<Database>(env.url, env.service, options);
export const anonymous = (): Client => createClient<Database>(env.url, env.anon, options);

const tag = randomBytes(4).toString('hex');
const password = `Sec-${randomBytes(12).toString('base64url')}9`;
const createdUsers: string[] = [];

function must<R extends { data: unknown; error: { message: string } | null }>(result: R, label: string): NonNullable<R['data']> {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data as NonNullable<R['data']>;
}

export async function signIn(email: string): Promise<Client> {
  const client = anonymous();
  must(await client.auth.signInWithPassword({ email, password }), `connexion ${email}`);
  return client;
}

async function user(name: string, accountType: 'participant' | 'pro' | 'organisme', metadata: Record<string, string> = {}) {
  const email = `${name}.${tag}@securite.happi.test`;
  const data = must(
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: accountType, first_name: name, last_name: 'Test', ...metadata },
    }),
    `compte ${name}`,
  );
  if (!data.user) throw new Error(`compte ${name} : utilisateur absent`);
  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}

export type Fixtures = Awaited<ReturnType<typeof createFixtures>>;

export async function createFixtures() {
  const program = must(await service.from('programs').select('id').eq('is_public', true).single(), 'programme');
  const outline = must(await service.from('program_sessions').select('id, number').eq('program_id', program.id).eq('number', 1).single(), 'trame');
  const active = must(await service.from('program_frameworks').select('framework_version_id').eq('program_id', program.id), 'référentiels actifs');
  const skill = must(
    await service.from('session_skill_map').select('skill_id').eq('session_number', 1).in('version_id', active.map((row) => row.framework_version_id)).limit(1).single(),
    'compétence',
  );

  const [orgA, orgB] = must(
    await service.from('organizations').insert([
      { name: `Sécurité A ${tag}`, status: 'active' },
      { name: `Sécurité B ${tag}`, status: 'active' },
    ]).select('id'),
    'organismes',
  );

  const memberA = await user('membrea', 'pro');
  const memberB = await user('membreb', 'pro');
  const trainerA = await user('formateura', 'pro');
  const trainerB = await user('formateurb', 'pro');
  const participantA = await user('participanta', 'participant');
  const participantB = await user('participantb', 'participant');
  for (const [account, role] of [[memberA, 'organisme'], [memberB, 'organisme'], [trainerA, 'formateur'], [trainerB, 'formateur']] as const) {
    must(await service.from('profiles').update({ role }).eq('id', account.id), 'rôle');
  }
  must(await service.from('organization_members').insert([
    { organization_id: orgA!.id, user_id: memberA.id },
    { organization_id: orgB!.id, user_id: memberB.id },
  ]), 'membres');

  const fileA = must(await service.from('participants').select('id').eq('user_id', participantA.id).single(), 'fiche A');
  const fileB = must(await service.from('participants').select('id').eq('user_id', participantB.id).single(), 'fiche B');
  must(await service.from('participants').update({ organization_id: orgA!.id }).eq('id', fileA.id), 'rattachement A');
  must(await service.from('participants').update({ organization_id: orgB!.id }).eq('id', fileB.id), 'rattachement B');

  const [groupA, groupB] = must(
    await service.from('groups').insert([
      { name: `Groupe sécurité A ${tag}`, program_id: program.id, organization_id: orgA!.id },
      { name: `Groupe sécurité B ${tag}`, program_id: program.id, organization_id: orgB!.id },
    ]).select('id'),
    'groupes',
  );
  must(await service.from('group_trainers').insert([
    { group_id: groupA!.id, trainer_id: trainerA.id, is_lead: true },
    { group_id: groupB!.id, trainer_id: trainerB.id, is_lead: true },
  ]), 'formateurs');
  must(await service.from('group_members').insert([
    { group_id: groupA!.id, participant_id: fileA.id },
    { group_id: groupB!.id, participant_id: fileB.id },
  ]), 'membres de groupe');
  const [sessionA, sessionB] = must(
    await service.from('sessions').insert([
      { group_id: groupA!.id, program_session_id: outline.id, number: 1, status: 'completed', scheduled_date: '2026-01-10' },
      { group_id: groupB!.id, program_session_id: outline.id, number: 1, status: 'completed', scheduled_date: '2026-01-10' },
    ]).select('id'),
    'sessions',
  );

  // Présences et évaluations saisies par chaque formateur avec sa propre session (parcours réel).
  const clientTrainerA = await signIn(trainerA.email);
  const clientTrainerB = await signIn(trainerB.email);
  must(await clientTrainerA.from('attendance').insert({ session_id: sessionA!.id, participant_id: fileA.id, status: 'present' }), 'présence A');
  must(await clientTrainerB.from('attendance').insert({ session_id: sessionB!.id, participant_id: fileB.id, status: 'present' }), 'présence B');
  const evaluate = async (client: Client, sessionId: string, participantId: string) => {
    const id = must(
      await client.rpc('save_evaluation_draft', {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_scores: [{ skill_id: skill.skill_id, score: 2 }],
        p_comments: { observation: 'Observation partagée', private: 'Note privée de l’équipe' },
      }),
      'brouillon',
    ) as string;
    must(await client.rpc('validate_evaluation', { p_evaluation_id: id }), 'validation');
    return id;
  };
  const evaluationA = await evaluate(clientTrainerA, sessionA!.id, fileA.id);
  const evaluationB = await evaluate(clientTrainerB, sessionB!.id, fileB.id);

  return {
    tag,
    skillId: skill.skill_id,
    orgA: orgA!.id,
    orgB: orgB!.id,
    groupA: groupA!.id,
    groupB: groupB!.id,
    sessionA: sessionA!.id,
    sessionB: sessionB!.id,
    participantA: fileA.id,
    participantB: fileB.id,
    evaluationA,
    evaluationB,
    accounts: { memberA, memberB, trainerA, trainerB, participantA, participantB },
    clients: { trainerA: clientTrainerA, trainerB: clientTrainerB },
  };
}

export async function destroyFixtures(fixtures: Fixtures | undefined) {
  if (fixtures) {
    await service.from('participants').delete().in('id', [fixtures.participantA, fixtures.participantB]);
    await service.from('groups').delete().in('id', [fixtures.groupA, fixtures.groupB]);
    await service.from('organizations').delete().in('id', [fixtures.orgA, fixtures.orgB]);
  }
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
}
