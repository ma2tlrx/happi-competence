import 'server-only';

import { randomBytes } from 'node:crypto';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseUrl } from '@/lib/supabase/env';

/**
 * Environnement de démonstration, piloté depuis l'espace administrateur.
 *
 * Toutes les données créées sont marquées is_demo, les personnes portent la mention
 * « (démo) » et les comptes utilisent des adresses en @demo.happi.test (domaine qui
 * ne reçoit aucun e-mail). Les mots de passe sont aléatoires et jamais conservés :
 * l'administrateur ouvre un espace de démonstration par un lien de connexion à
 * usage unique généré côté serveur.
 *
 * La création rejoue le parcours réel : le formateur crée son groupe, planifie les
 * sessions, saisit les présences et valide les évaluations avec sa propre session.
 */

export const DEMO_DOMAIN = 'demo.happi.test';
export const DEMO_SPACES = {
  formateur: { email: `formateur@${DEMO_DOMAIN}`, label: 'Formateur', home: '/formateur/dashboard' },
  organisme: { email: `organisme@${DEMO_DOMAIN}`, label: 'Organisme', home: '/organisme/dashboard' },
  participant: { email: `participant@${DEMO_DOMAIN}`, label: 'Participant', home: '/participant/dashboard' },
} as const;
export type DemoSpace = keyof typeof DEMO_SPACES;

export function isDemoAllowed() {
  return process.env.HAPPI_ALLOW_DEMO !== 'false';
}

type Admin = ReturnType<typeof createAdminClient>;
type Client = ReturnType<typeof createSupabaseClient<Database>>;

function must<T>(result: { data: T; error: { message: string } | null }, label: string): NonNullable<T> {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data as NonNullable<T>;
}

/** Variante pour les réponses d'authentification, dont le type sépare succès et erreur. */
function mustAuth<T>(result: { data: T; error: null } | { data: unknown; error: { message: string } }, label: string): T {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data as T;
}

async function signedIn(email: string, password: string): Promise<Client> {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Configuration manquante : NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  const client = createSupabaseClient<Database>(getSupabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  mustAuth(await client.auth.signInWithPassword({ email, password }), `Connexion ${email}`);
  return client;
}

const tag = (lastName: string) => `${lastName} (démo)`;
const slug = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export type DemoStatus = { profiles: number; organizations: number; participants: number; groups: number; reports: number };

export async function demoStatus(): Promise<DemoStatus> {
  const admin = createAdminClient();
  const count = async (table: 'profiles' | 'organizations' | 'participants' | 'groups') =>
    (await admin.from(table).select('id', { count: 'exact', head: true }).eq('is_demo', true)).count ?? 0;
  const [profiles, organizations, participants, groups] = await Promise.all([count('profiles'), count('organizations'), count('participants'), count('groups')]);
  const { data: ids } = await admin.from('participants').select('id').eq('is_demo', true);
  const reports = ids?.length
    ? ((await admin.from('participant_reports').select('id', { count: 'exact', head: true }).in('participant_id', ids.map((row) => row.id))).count ?? 0)
    : 0;
  return { profiles, organizations, participants, groups, reports };
}

/** Supprime tout ce qui est marqué « démo » (et seulement cela). */
export async function purgeDemo(admin: Admin = createAdminClient()) {
  // Les participants d'abord : leurs évaluations bloquent la suppression des sessions.
  must(await admin.from('participants').delete().eq('is_demo', true), 'Participants');
  must(await admin.from('groups').delete().eq('is_demo', true), 'Groupes');
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Comptes : ${error.message}`);
    const demoUsers = data.users.filter((user) => user.app_metadata?.is_demo === true && user.email?.endsWith(`@${DEMO_DOMAIN}`));
    for (const user of demoUsers) mustAuth(await admin.auth.admin.deleteUser(user.id), `Compte ${user.email}`);
    if (data.users.length < 200) break;
  }
  must(await admin.from('organizations').delete().eq('is_demo', true), 'Organismes');
}

const FIRST_NAMES = ['Inès', 'Lucas', 'Sarah', 'Yanis', 'Chloé', 'Mehdi', 'Léa', 'Hugo', 'Amina', 'Théo', 'Nora', 'Enzo', 'Jade'];
const LAST_NAMES = ['Martin', 'Benali', 'Dubois', 'Moreau', 'Laurent', 'Haddad', 'Fontaine', 'Girard', 'Diallo', 'Roux', 'Perrin', 'Garnier', 'Faure'];
const OBSERVATIONS = [
  'S’est montré(e) à l’écoute de ses coéquipiers pendant l’activité et a proposé une organisation claire.',
  'A pris la parole spontanément pendant le débat et a su nuancer sa position.',
  'Reste en retrait au début puis s’implique davantage quand les rôles sont définis.',
  'Garde son calme sous la pression du chronomètre et aide le groupe à se recentrer.',
];
const ADVICE = [
  'Continuer à proposer ses idées dès le début des activités.',
  'S’appuyer sur sa capacité d’écoute pour faciliter les échanges du groupe.',
  'Prendre le temps de reformuler les consignes avant de passer à l’action.',
];

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Générateur déterministe : la démonstration est identique à chaque création.
function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

/** (Re)crée l'environnement de démonstration complet. Durée : quelques dizaines de secondes. */
export async function createDemo() {
  const admin = createAdminClient();
  await purgeDemo(admin);

  async function createUser(email: string, firstName: string, lastName: string, accountType: 'pro' | 'participant' | 'organisme') {
    const password = `Demo-${randomBytes(12).toString('base64url')}7`;
    const data = mustAuth<{ user: { id: string } }>(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: accountType, first_name: firstName, last_name: lastName, terms_accepted: true, privacy_consent: true, consent_version: 'demo' },
        app_metadata: { is_demo: true },
      }),
      `Création ${email}`,
    );
    must(await admin.from('profiles').update({ is_demo: true }).eq('id', data.user.id), `Profil ${email}`);
    return { id: data.user.id, email, password };
  }

  const program = must(await admin.from('programs').select('id').eq('is_public', true).single(), 'Programme');
  const programSessions = must(await admin.from('program_sessions').select('id, number').eq('program_id', program.id).order('number'), 'Trame');

  const [orgA, orgB] = must(
    await admin
      .from('organizations')
      .insert([
        { name: 'Mission Locale Démo du Littoral', type: 'mission_locale', city: 'Béziers', status: 'active', is_demo: true, validated_at: new Date().toISOString() },
        { name: 'Organisme de formation Démo Horizon', type: 'organisme_formation', city: 'Montpellier', status: 'active', is_demo: true, validated_at: new Date().toISOString() },
      ])
      .select('id, name'),
    'Organismes',
  );
  if (!orgA || !orgB) throw new Error('Organismes : création incomplète.');

  // Équipe et organismes : comptes créés neutres puis promus.
  const trainer = await createUser(`formateur@${DEMO_DOMAIN}`, 'Camille', tag('Formatrice'), 'pro');
  const trainer2 = await createUser(`formateur2@${DEMO_DOMAIN}`, 'Samir', tag('Formateur'), 'pro');
  const orgUserA = await createUser(`organisme@${DEMO_DOMAIN}`, 'Nadia', tag('Conseillère'), 'pro');
  const orgUserB = await createUser(`organisme2@${DEMO_DOMAIN}`, 'Paul', tag('Référent'), 'pro');
  for (const [user, role] of [
    [trainer, 'formateur'],
    [trainer2, 'formateur'],
    [orgUserA, 'organisme'],
    [orgUserB, 'organisme'],
  ] as const) {
    must(await admin.from('profiles').update({ role }).eq('id', user.id), `Rôle ${user.email}`);
  }
  must(
    await admin.from('organization_members').insert([
      { organization_id: orgA.id, user_id: orgUserA.id, member_role: 'owner' },
      { organization_id: orgB.id, user_id: orgUserB.id, member_role: 'owner' },
    ]),
    'Membres des organismes',
  );

  // Participants avec compte (inscription réelle).
  const people = FIRST_NAMES.map((firstName, index) => ({ firstName, lastName: tag(LAST_NAMES[index]!) }));
  const accountHolders = [0, 1, 8];
  const accounts = new Map<number, { id: string; email: string; password: string }>();
  for (const index of accountHolders) {
    const person = people[index]!;
    const email = index === 0 ? `participant@${DEMO_DOMAIN}` : `${slug(person.firstName)}@${DEMO_DOMAIN}`;
    accounts.set(index, await createUser(email, person.firstName, person.lastName, 'participant'));
  }
  must(await admin.from('participants').update({ is_demo: true }).in('email', [...accounts.values()].map((user) => user.email)), 'Participants avec compte');

  // Le formateur crée et anime ses groupes.
  const trainerClient = await signedIn(trainer.email, trainer.password);
  const trainer2Client = await signedIn(trainer2.email, trainer2.password);
  const groupA = must(
    await trainerClient
      .from('groups')
      .insert({ name: 'Groupe Littoral — automne (démo)', program_id: program.id, organization_id: orgA.id, start_date: isoDate(-28), end_date: isoDate(14), created_by: trainer.id })
      .select('id')
      .single(),
    'Groupe A',
  );
  const groupB = must(
    await trainer2Client
      .from('groups')
      .insert({ name: 'Groupe Horizon — découverte (démo)', program_id: program.id, organization_id: orgB.id, start_date: isoDate(-14), end_date: isoDate(28), created_by: trainer2.id })
      .select('id')
      .single(),
    'Groupe B',
  );
  must(await admin.from('groups').update({ is_demo: true }).in('id', [groupA.id, groupB.id]), 'Marquage des groupes');

  async function addMembers(client: Client, groupId: string, indexes: number[]) {
    const ids: string[] = [];
    for (const index of indexes) {
      const person = people[index]!;
      const email = accounts.get(index)?.email ?? `${slug(person.firstName)}.${slug(LAST_NAMES[index]!)}@${DEMO_DOMAIN}`;
      const result = must(
        await client.rpc('add_participant_to_group', { p_group_id: groupId, p_first_name: person.firstName, p_last_name: person.lastName, p_email: email }),
        `Ajout ${email}`,
      ) as { participant_id: string };
      ids.push(result.participant_id);
    }
    must(await admin.from('participants').update({ is_demo: true }).in('id', ids), 'Marquage des participants');
    return ids;
  }
  const membersA = await addMembers(trainerClient, groupA.id, [0, 1, 2, 3, 4, 5, 6, 7]);
  const membersB = await addMembers(trainer2Client, groupB.id, [8, 9, 10, 11, 12]);

  async function planSessions(client: Client, groupId: string, offsets: number[], completedCount: number, trainerId: string) {
    const rows = programSessions.map((programSession, index) => ({
      group_id: groupId,
      program_session_id: programSession.id,
      number: programSession.number,
      scheduled_date: isoDate(offsets[index]!),
      start_time: '09:00',
      end_time: '12:00',
      location: index % 2 === 0 ? 'Salle Atlas, 2e étage' : 'Espace jeux vidéo, rez-de-chaussée',
      trainer_id: trainerId,
      status: (index < completedCount ? 'completed' : 'planned') as 'completed' | 'planned',
    }));
    return must(await client.from('sessions').insert(rows).select('id, number').order('number'), 'Sessions');
  }
  const sessionsA = await planSessions(trainerClient, groupA.id, [-28, -21, -14, 0, 7, 14], 3, trainer.id);
  const sessionsB = await planSessions(trainer2Client, groupB.id, [-14, -7, 1, 8, 15, 22], 2, trainer2.id);

  const versions = must(await admin.from('framework_versions').select('id, scale_min, scale_max').eq('status', 'published'), 'Versions');
  const mapping = must(
    await admin.from('session_skill_map').select('session_number, skill_id, version_id').in('version_id', versions.map((version) => version.id)),
    'Correspondances',
  );

  async function runSessions(client: Client, sessions: { id: string; number: number }[], members: string[], completedCount: number, seedBase: number) {
    for (const session of sessions.slice(0, completedCount)) {
      const random = seededRandom(seedBase + session.number * 31);
      const attendance = members.map((participantId, index) => {
        const roll = random();
        const status = index === 0 ? 'present' : roll < 0.08 ? 'absent' : roll < 0.14 ? 'late' : roll < 0.17 ? 'excused' : 'present';
        return { session_id: session.id, participant_id: participantId, status, comment: status === 'late' ? 'Arrivée à 9 h 20.' : status === 'excused' ? 'Rendez-vous médical justifié.' : null };
      });
      must(await client.from('attendance').insert(attendance), `Présences session ${session.number}`);
      const skills = mapping.filter((row) => row.session_number === session.number);
      for (const [index, participantId] of members.entries()) {
        if (!['present', 'late', 'left_early'].includes(attendance[index]!.status)) continue;
        const scores = skills.map((row) => {
          const version = versions.find((item) => item.id === row.version_id)!;
          const span = version.scale_max - version.scale_min;
          const base = version.scale_min + Math.round(span * (0.3 + 0.12 * ((index + row.skill_id.charCodeAt(0)) % 4)));
          const progress = session.number >= 2 && random() < 0.45 ? 1 : 0;
          return { skill_id: row.skill_id, score: Math.min(version.scale_max, Math.max(version.scale_min, base + progress)) };
        });
        const comments: Record<string, string> = { observation: OBSERVATIONS[(index + session.number) % OBSERVATIONS.length]! };
        if (session.number >= 2) comments.advice = ADVICE[(index + session.number) % ADVICE.length]!;
        if (index % 3 === 0) comments.private = 'Note interne : à encourager pendant les débats.';
        const evaluationId = must(
          await client.rpc('save_evaluation_draft', { p_session_id: session.id, p_participant_id: participantId, p_scores: scores, p_criteria: [], p_comments: comments }),
          'Brouillon',
        );
        must(await client.rpc('validate_evaluation', { p_evaluation_id: evaluationId as string }), 'Validation');
      }
    }
  }
  await runSessions(trainerClient, sessionsA, membersA, 3, 7);
  await runSessions(trainer2Client, sessionsB, membersB, 2, 11);

  // Un brouillon en cours pour la session du jour.
  const todaySkills = mapping.filter((row) => row.session_number === 4).slice(0, 3);
  if (sessionsA[3]) {
    must(
      await trainerClient.rpc('save_evaluation_draft', {
        p_session_id: sessionsA[3].id,
        p_participant_id: membersA[2]!,
        p_scores: todaySkills.map((row) => ({ skill_id: row.skill_id, score: 3 })),
        p_criteria: [],
        p_comments: { observation: 'Brouillon en cours de saisie.' },
      }),
      'Brouillon du jour',
    );
  }

  // Auto-évaluations initiales (Lucas n'a pas encore répondu : on voit l'invitation).
  const questionnaire = must(
    await admin.from('questionnaire_versions').select('id, scale_min, scale_max, questionnaire_questions ( id )').eq('status', 'published').single(),
    'Questionnaire',
  );
  for (const [index, account] of accounts.entries()) {
    if (index === 1) continue;
    const client = await signedIn(account.email, account.password);
    const participant = must(await client.from('participants').select('id').eq('user_id', account.id).single(), 'Fiche participant');
    const assessment = must(
      await client.from('self_assessments').insert({ participant_id: participant.id, questionnaire_version_id: questionnaire.id, kind: 'initial' }).select('id').single(),
      'Auto-évaluation',
    );
    const random = seededRandom(97 + index);
    must(
      await client.from('self_assessment_answers').insert(
        questionnaire.questionnaire_questions.map((question) => ({
          self_assessment_id: assessment.id,
          question_id: question.id,
          value: questionnaire.scale_min + Math.floor(random() * (questionnaire.scale_max - questionnaire.scale_min + 1)),
        })),
      ),
      'Réponses',
    );
    must(await client.from('self_assessments').update({ status: 'completed', comment: 'J’ai hâte de voir ce que les jeux vont révéler.' }).eq('id', assessment.id), 'Clôture');
  }
  return { participants: membersA.length + membersB.length, groups: 2, organizations: 2 };
}

/** Lien de connexion à usage unique vers un compte de démonstration (jamais vers un vrai compte). */
export async function demoLoginToken(space: DemoSpace) {
  const admin = createAdminClient();
  const email = DEMO_SPACES[space].email;
  const { data: profile } = await admin.from('profiles').select('id, is_demo').eq('email', email).maybeSingle();
  if (!profile?.is_demo) return null;
  const { data: user } = await admin.auth.admin.getUserById(profile.id);
  if (user.user?.app_metadata?.is_demo !== true) return null;
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) return null;
  return data.properties.hashed_token;
}
