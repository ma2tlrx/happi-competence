#!/usr/bin/env node
/**
 * Données de démonstration HAPPI.
 *
 *   npm run demo:seed    crée (ou recrée) l'environnement de démonstration
 *   npm run demo:purge   supprime toutes les données marquées « démo »
 *
 * Toutes les données créées sont marquées is_demo et utilisent des adresses
 * en @demo.happi.test. Les mots de passe sont générés à chaque exécution et
 * écrits dans .demo-credentials.json (fichier ignoré par Git).
 *
 * Le script rejoue le parcours réel : comptes créés par l'API d'administration,
 * puis le formateur crée son groupe, planifie les sessions, saisit les présences
 * et valide les évaluations avec sa propre session (RLS et fonctions métier).
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. Refuse de s'exécuter si HAPPI_ALLOW_DEMO=false.
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error('✖ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (process.env.HAPPI_ALLOW_DEMO === 'false') {
  console.error('✖ Données de démonstration désactivées sur cet environnement (HAPPI_ALLOW_DEMO=false).');
  process.exit(1);
}

const DOMAIN = 'demo.happi.test';
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function must(result, label) {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data;
}

async function signedIn(email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await client.auth.signInWithPassword({ email, password }), `Connexion ${email}`);
  return client;
}

// ── Purge ────────────────────────────────────────────────────────────────────
async function purge() {
  console.log('▸ Suppression des données de démonstration…');
  // Les participants d'abord (leurs évaluations bloquent la suppression des sessions).
  must(await admin.from('participants').delete().eq('is_demo', true), 'Participants');
  must(await admin.from('groups').delete().eq('is_demo', true), 'Groupes');
  // Fiche réelle rattachée par erreur à un organisme démo : détachée, jamais supprimée.
  const demoOrgs = must(await admin.from('organizations').select('id').eq('is_demo', true), 'Organismes démo').map((row) => row.id);
  if (demoOrgs.length) {
    must(await admin.from('participants').update({ organization_id: null }).in('organization_id', demoOrgs), 'Détachement des fiches');
    must(await admin.from('organization_members').delete().in('organization_id', demoOrgs), 'Membres des organismes démo');
  }
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const demoUsers = data.users.filter((user) => user.app_metadata?.is_demo === true || user.email?.endsWith(`@${DOMAIN}`));
    for (const user of demoUsers) must(await admin.auth.admin.deleteUser(user.id), `Compte ${user.email}`);
    if (data.users.length < 200) break;
    page += 1;
  }
  must(await admin.from('organizations').delete().eq('is_demo', true), 'Organismes');
  console.log('✔ Données de démonstration supprimées.');
}

// ── Utilitaires ──────────────────────────────────────────────────────────────
const credentials = [];
function newPassword() {
  return `Demo-${randomBytes(9).toString('base64url')}7`;
}

async function createUser({ email, firstName, lastName, accountType, label }) {
  const password = newPassword();
  const data = must(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: accountType, first_name: firstName, last_name: lastName, terms_accepted: true, privacy_consent: true, consent_version: 'demo' },
      app_metadata: { is_demo: true },
    }),
    `Création ${email}`,
  );
  credentials.push({ espace: label, email, password });
  return { id: data.user.id, email, password };
}

function isoDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Générateur pseudo-aléatoire déterministe : la démo est identique à chaque exécution.
function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
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

// ── Données ──────────────────────────────────────────────────────────────────
async function seed() {
  await purge();
  console.log('▸ Création de l’environnement de démonstration…');

  const program = must(await admin.from('programs').select('id, name, max_group_size').eq('is_public', true).single(), 'Programme');
  const programSessions = must(await admin.from('program_sessions').select('id, number').eq('program_id', program.id).order('number'), 'Trame');

  // Organismes : deux structures actives (pour démontrer l'isolation) et une demande en attente.
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

  // Comptes de l'équipe et des organismes : créés neutres puis promus (aucune auto-attribution de rôle).
  const adminUser = await createUser({ email: `admin@${DOMAIN}`, firstName: 'Alex', lastName: 'Admin', accountType: 'pro', label: 'Administrateur' });
  const trainer = await createUser({ email: `formateur@${DOMAIN}`, firstName: 'Camille', lastName: 'Formatrice', accountType: 'pro', label: 'Formateur' });
  const trainer2 = await createUser({ email: `formateur2@${DOMAIN}`, firstName: 'Samir', lastName: 'Formateur', accountType: 'pro', label: 'Formateur (groupe B)' });
  const orgUserA = await createUser({ email: `organisme@${DOMAIN}`, firstName: 'Nadia', lastName: 'Conseillère', accountType: 'pro', label: `Organisme — ${orgA.name}` });
  const orgUserB = await createUser({ email: `organisme2@${DOMAIN}`, firstName: 'Paul', lastName: 'Référent', accountType: 'pro', label: `Organisme — ${orgB.name}` });
  for (const [user, role] of [[adminUser, 'admin'], [trainer, 'formateur'], [trainer2, 'formateur'], [orgUserA, 'organisme'], [orgUserB, 'organisme']]) {
    must(await admin.from('profiles').update({ role, is_demo: true }).eq('id', user.id), `Rôle ${user.email}`);
  }
  must(
    await admin.from('organization_members').insert([
      { organization_id: orgA.id, user_id: orgUserA.id, member_role: 'owner' },
      { organization_id: orgB.id, user_id: orgUserB.id, member_role: 'owner' },
    ]),
    'Membres des organismes',
  );

  // Demande d'organisme en attente de validation (parcours d'inscription réel).
  await createUser({
    email: `demande@${DOMAIN}`,
    firstName: 'Julie',
    lastName: 'Demandeuse',
    accountType: 'organisme',
    label: 'Organisme en attente de validation',
  });
  const pendingOwner = must(await admin.from('profiles').select('id').eq('email', `demande@${DOMAIN}`).single(), 'Demande');
  must(
    await admin.from('organizations').update({ name: 'Entreprise Démo Atlas', type: 'entreprise', city: 'Sète', is_demo: true }).eq('created_by', pendingOwner.id),
    'Organisme en attente',
  );
  must(await admin.from('profiles').update({ is_demo: true }).eq('id', pendingOwner.id), 'Profil demande');

  // Participants avec compte (créés par l'inscription réelle) : le premier de chaque groupe et une autre personne.
  const people = FIRST_NAMES.map((firstName, index) => ({ firstName, lastName: LAST_NAMES[index] }));
  const accountHolders = [0, 1, 8];
  const participantAccounts = new Map();
  for (const index of accountHolders) {
    const person = people[index];
    const email = index === 0 ? `participant@${DOMAIN}` : `${person.firstName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}@${DOMAIN}`;
    const user = await createUser({ email, firstName: person.firstName, lastName: person.lastName, accountType: 'participant', label: `Participant — ${person.firstName} ${person.lastName}` });
    participantAccounts.set(index, user);
  }
  must(await admin.from('participants').update({ is_demo: true }).in('email', [...participantAccounts.values()].map((user) => user.email)), 'Participants avec compte');
  must(await admin.from('profiles').update({ is_demo: true }).in('id', [...participantAccounts.values()].map((user) => user.id)), 'Profils participants');

  // ── Le formateur crée et anime ses groupes ─────────────────────────────────
  const trainerClient = await signedIn(trainer.email, trainer.password);
  const trainer2Client = await signedIn(trainer2.email, trainer2.password);

  const groupA = must(
    await trainerClient
      .from('groups')
      .insert({ name: 'Groupe Littoral — automne', program_id: program.id, organization_id: orgA.id, start_date: isoDate(-28), end_date: isoDate(14), created_by: trainer.id })
      .select('id')
      .single(),
    'Groupe A',
  );
  const groupB = must(
    await trainer2Client
      .from('groups')
      .insert({ name: 'Groupe Horizon — découverte', program_id: program.id, organization_id: orgB.id, start_date: isoDate(-14), end_date: isoDate(28), created_by: trainer2.id })
      .select('id')
      .single(),
    'Groupe B',
  );
  must(await admin.from('groups').update({ is_demo: true }).in('id', [groupA.id, groupB.id]), 'Marquage groupes');

  async function addMembers(client, groupId, indexes) {
    const ids = [];
    for (const index of indexes) {
      const person = people[index];
      const account = participantAccounts.get(index);
      const email = account?.email ?? `${person.firstName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}.${person.lastName.toLowerCase()}@${DOMAIN}`;
      const result = must(
        await client.rpc('add_participant_to_group', { p_group_id: groupId, p_first_name: person.firstName, p_last_name: person.lastName, p_email: email }),
        `Ajout ${email}`,
      );
      ids.push(result.participant_id);
    }
    must(await admin.from('participants').update({ is_demo: true }).in('id', ids), 'Marquage participants');
    return ids;
  }
  const membersA = await addMembers(trainerClient, groupA.id, [0, 1, 2, 3, 4, 5, 6, 7]);
  const membersB = await addMembers(trainer2Client, groupB.id, [8, 9, 10, 11, 12]);

  async function planSessions(client, groupId, offsets, completedCount, trainerId) {
    const rows = programSessions.map((programSession, index) => ({
      group_id: groupId,
      program_session_id: programSession.id,
      scheduled_date: isoDate(offsets[index]),
      start_time: '09:00',
      end_time: '12:00',
      location: index % 2 === 0 ? 'Salle Atlas, 2e étage' : 'Espace jeux vidéo, rez-de-chaussée',
      trainer_id: trainerId,
      status: index < completedCount ? 'completed' : 'planned',
    }));
    return must(await client.from('sessions').insert(rows).select('id, number, scheduled_date').order('number'), 'Sessions');
  }
  const sessionsA = await planSessions(trainerClient, groupA.id, [-28, -21, -14, 0, 7, 14], 3, trainer.id);
  const sessionsB = await planSessions(trainer2Client, groupB.id, [-14, -7, 1, 8, 15, 22], 2, trainer2.id);

  // Correspondances session ↔ compétences (versions publiées).
  const versions = must(await admin.from('framework_versions').select('id, scale_min, scale_max, frameworks ( code )').eq('status', 'published'), 'Versions');
  const mapping = must(await admin.from('session_skill_map').select('session_number, skill_id, version_id').in('version_id', versions.map((v) => v.id)), 'Correspondances');

  async function runSessions(client, sessions, members, completedCount, seedBase) {
    for (const session of sessions.slice(0, completedCount)) {
      // Présences
      const random = seededRandom(seedBase + session.number * 31);
      const attendance = members.map((participantId, index) => {
        const roll = random();
        const status = index === 0 ? 'present' : roll < 0.08 ? 'absent' : roll < 0.14 ? 'late' : roll < 0.17 ? 'excused' : 'present';
        return { session_id: session.id, participant_id: participantId, status, comment: status === 'late' ? 'Arrivée à 9 h 20.' : status === 'excused' ? 'Rendez-vous médical justifié.' : null };
      });
      must(await client.from('attendance').insert(attendance), `Présences session ${session.number}`);

      // Évaluations des présents, validées à la fin de la session
      const skills = mapping.filter((row) => row.session_number === session.number);
      for (const [index, participantId] of members.entries()) {
        if (!['present', 'late', 'left_early'].includes(attendance[index].status)) continue;
        const scores = skills.map((row) => {
          const version = versions.find((v) => v.id === row.version_id);
          const span = version.scale_max - version.scale_min;
          const base = version.scale_min + Math.round(span * (0.3 + 0.12 * ((index + row.skill_id.charCodeAt(0)) % 4)));
          const progress = session.number >= 2 && random() < 0.45 ? 1 : 0;
          return { skill_id: row.skill_id, score: Math.min(version.scale_max, Math.max(version.scale_min, base + progress)) };
        });
        const comments = { observation: OBSERVATIONS[(index + session.number) % OBSERVATIONS.length] };
        if (session.number >= 2) comments.advice = ADVICE[(index + session.number) % ADVICE.length];
        if (index % 3 === 0) comments.private = 'Note interne : à encourager pendant les débats.';
        const evaluationId = must(
          await client.rpc('save_evaluation_draft', { p_session_id: session.id, p_participant_id: participantId, p_scores: scores, p_criteria: [], p_comments: comments }),
          'Brouillon',
        );
        must(await client.rpc('validate_evaluation', { p_evaluation_id: evaluationId }), 'Validation');
      }
    }
  }
  await runSessions(trainerClient, sessionsA, membersA, 3, 7);
  await runSessions(trainer2Client, sessionsB, membersB, 2, 11);

  // Une correction tracée, pour illustrer l'historique des modifications.
  const firstEvaluation = must(
    await trainerClient.from('evaluations').select('id, evaluation_scores ( skill_id, score )').eq('participant_id', membersA[1]).eq('session_id', sessionsA[0].id).single(),
    'Évaluation à corriger',
  );
  const target = firstEvaluation.evaluation_scores[0];
  if (target) {
    must(
      await trainerClient.rpc('amend_evaluation', {
        p_evaluation_id: firstEvaluation.id,
        p_reason: 'Correction après relecture des notes de séance.',
        p_scores: [{ skill_id: target.skill_id, score: Math.max(1, Number(target.score) - 1) }],
      }),
      'Correction',
    );
  }

  // Un brouillon en cours pour la session du jour (sauvegarde automatique).
  const todaySkills = mapping.filter((row) => row.session_number === 4).slice(0, 3);
  must(
    await trainerClient.rpc('save_evaluation_draft', {
      p_session_id: sessionsA[3].id,
      p_participant_id: membersA[2],
      p_scores: todaySkills.map((row) => ({ skill_id: row.skill_id, score: 3 })),
      p_comments: { observation: 'Brouillon en cours de saisie.' },
    }),
    'Brouillon du jour',
  );

  // ── Auto-évaluations initiales des participants inscrits ──────────────────
  const questionnaire = must(
    await admin.from('questionnaire_versions').select('id, scale_min, scale_max, questionnaire_questions ( id, position )').eq('status', 'published').single(),
    'Questionnaire',
  );
  for (const [index, account] of participantAccounts.entries()) {
    if (index === 1) continue; // Lucas n'a pas encore répondu : on voit l'invitation dans son tableau de bord.
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
    must(await client.from('self_assessments').update({ status: 'completed', comment: 'J’ai hâte de voir ce que les jeux vont révéler.' }).eq('id', assessment.id), 'Clôture auto-évaluation');
  }

  writeFileSync(join(process.cwd(), '.demo-credentials.json'), `${JSON.stringify({ genere_le: new Date().toISOString(), comptes: credentials }, null, 2)}\n`, { mode: 0o600 });
  console.log(`✔ Démonstration prête : 3 organismes, 2 groupes, ${membersA.length + membersB.length} participants, ${credentials.length} comptes.`);
  console.log('  Identifiants : .demo-credentials.json');
  console.table(credentials.map(({ espace, email }) => ({ espace, email })));
}

try {
  if (process.argv.includes('--purge')) await purge();
  else await seed();
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exit(1);
}
