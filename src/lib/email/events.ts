import 'server-only';

import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';

import { enqueueEmails, flushOutboxLater, processOutbox, SKIP_REASONS, type EnqueueInput, type ProcessSummary } from './outbox';
import { detectProvider } from './provider';
import { idempotencyKeys, isUpcoming, sessionChangeKind, tomorrowInParis, type SessionSnapshot } from './schedule';
import { longDate, shortTime, type SessionEmailData } from './templates';

/**
 * Déclencheurs métier des e-mails. Chaque fonction est appelée par une action serveur APRÈS que
 * l'opération a réussi avec la session de l'utilisateur (donc sous RLS) : les droits sont déjà
 * vérifiés, la lecture des destinataires passe ensuite par le client de service.
 * Aucune ne lève d'exception : l'envoi d'e-mails ne fait jamais échouer l'action métier.
 */

type Admin = ReturnType<typeof createAdminClient>;

const PARTICIPANT_PATH = '/participant/parcours';

type Recipient = { participantId: string; userId: string | null; firstName: string; email: string | null; isDemo: boolean; reminders: boolean };

type SessionContext = SessionSnapshot & {
  id: string;
  groupId: string;
  isDemo: boolean;
  data: Omit<SessionEmailData, 'firstName'>;
  recipients: Recipient[];
};

function guard<T>(label: string, run: (admin: Admin) => Promise<T>): Promise<T | null> {
  if (!isAdminClientConfigured()) return Promise.resolve(null);
  return run(createAdminClient()).catch((error: unknown) => {
    console.error(`E-mails (${label}) : traitement impossible`, error instanceof Error ? error.message.slice(0, 200) : '');
    return null;
  });
}

/** Membres actifs des groupes, avec adresse (fiche, sinon compte) et préférence de rappel. */
async function loadRecipients(admin: Admin, groupIds: string[]): Promise<Map<string, Recipient[]>> {
  const byGroup = new Map<string, Recipient[]>();
  if (groupIds.length === 0) return byGroup;
  const { data: members, error } = await admin
    .from('group_members')
    .select('group_id, participants ( id, user_id, first_name, email, is_demo, status )')
    .in('group_id', groupIds)
    .eq('status', 'active');
  if (error) throw new Error(`membres : ${error.code}`);
  const userIds = [...new Set((members ?? []).map((row) => row.participants?.user_id).filter((id): id is string => Boolean(id)))];
  const [profiles, preferences] = userIds.length
    ? await Promise.all([
        admin.from('profiles').select('id, email, is_demo, status').in('id', userIds),
        admin.from('email_preferences').select('user_id, reminders').in('user_id', userIds),
      ])
    : [{ data: [] }, { data: [] }];
  const profileById = new Map((profiles.data ?? []).map((row) => [row.id, row]));
  const reminderOff = new Set((preferences.data ?? []).filter((row) => !row.reminders).map((row) => row.user_id));
  for (const member of members ?? []) {
    const participant = member.participants;
    if (!participant || participant.status === 'archived') continue;
    const profile = participant.user_id ? profileById.get(participant.user_id) : undefined;
    // Compte désactivé : plus aucun e-mail.
    if (profile && profile.status !== 'active') continue;
    const list = byGroup.get(member.group_id) ?? [];
    list.push({
      participantId: participant.id,
      userId: participant.user_id,
      firstName: participant.first_name,
      email: participant.email ?? profile?.email ?? null,
      isDemo: participant.is_demo || Boolean(profile?.is_demo),
      reminders: !(participant.user_id && reminderOff.has(participant.user_id)),
    });
    byGroup.set(member.group_id, list);
  }
  return byGroup;
}

async function loadSessions(admin: Admin, filter: { ids?: string[]; date?: string; groupId?: string }): Promise<SessionContext[]> {
  let query = admin
    .from('sessions')
    .select(
      'id, group_id, number, scheduled_date, start_time, end_time, location, status, groups ( name, is_demo, programs ( name ) ), program_sessions ( title, summary, objectives )',
    );
  if (filter.ids) query = query.in('id', filter.ids);
  if (filter.groupId) query = query.eq('group_id', filter.groupId);
  if (filter.date) query = query.eq('scheduled_date', filter.date).eq('status', 'planned');
  const { data, error } = await query;
  if (error) throw new Error(`séances : ${error.code}`);
  const recipients = await loadRecipients(admin, [...new Set((data ?? []).map((row) => row.group_id))]);
  return (data ?? []).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    scheduled_date: row.scheduled_date,
    start_time: row.start_time,
    end_time: row.end_time,
    location: row.location,
    status: row.status,
    isDemo: Boolean(row.groups?.is_demo),
    data: {
      sessionNumber: row.number,
      sessionTitle: row.program_sessions?.title ?? null,
      programName: row.groups?.programs?.name ?? null,
      groupName: row.groups?.name ?? null,
      date: row.scheduled_date,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      summary: row.program_sessions?.summary ?? null,
      objectives: row.program_sessions?.objectives ?? [],
      // Le programme ne renseigne pas encore « ce qu'il faut apporter » : rien n'est affiché.
      bring: null,
      link: PARTICIPANT_PATH,
    },
    recipients: recipients.get(row.group_id) ?? [],
  }));
}

function whenText(session: SessionContext) {
  const from = shortTime(session.start_time);
  return [longDate(session.scheduled_date), from ? `à ${from}` : null, session.location ? `· ${session.location}` : null].filter(Boolean).join(' ');
}

type SessionTemplate = 'session_convocation' | 'session_reminder' | 'session_updated' | 'session_cancelled';

const NOTIFICATIONS: Record<SessionTemplate, (session: SessionContext) => { type: string; title: string }> = {
  session_convocation: (s) => ({ type: 'session.convocation', title: `Convocation à la séance ${s.data.sessionNumber}` }),
  session_reminder: (s) => ({ type: 'session.reminder', title: `Rappel : séance ${s.data.sessionNumber} demain` }),
  session_updated: (s) => ({ type: 'session.updated', title: `Séance ${s.data.sessionNumber} modifiée` }),
  session_cancelled: (s) => ({ type: 'session.cancelled', title: `Séance ${s.data.sessionNumber} annulée` }),
};

function sessionEmail(template: SessionTemplate, session: SessionContext, recipient: Recipient, key: string, actorId: string | null): EnqueueInput {
  return {
    key,
    template,
    data: { ...session.data, firstName: recipient.firstName },
    to: recipient.email,
    userId: recipient.userId,
    participantId: recipient.participantId,
    sessionId: session.id,
    isDemo: session.isDemo || recipient.isDemo,
    skipReason: template === 'session_reminder' && !recipient.reminders ? SKIP_REASONS.remindersOff : null,
    createdBy: actorId,
    notification: { ...NOTIFICATIONS[template](session), body: whenText(session), link: PARTICIPANT_PATH },
  };
}

/** Clés de convocation déjà présentes pour ces séances. */
async function existingConvocations(admin: Admin, sessionIds: string[]) {
  if (sessionIds.length === 0) return new Set<string>();
  const { data } = await admin.from('email_outbox').select('idempotency_key').in('session_id', sessionIds).eq('template', 'session_convocation');
  return new Set((data ?? []).map((row) => row.idempotency_key));
}

/**
 * Après la planification de séances (ou l'arrivée d'un membre dans un groupe) : convocation des
 * membres pour chaque séance datée à venir. Les personnes déjà convoquées ne reçoivent rien de plus.
 */
export async function notifySessionsPlanned(target: { sessionIds: string[] } | { groupId: string }, actorId: string | null) {
  await guard('convocations', async (admin) => {
    const filter = 'groupId' in target ? { groupId: target.groupId } : { ids: target.sessionIds };
    const sessions = (await loadSessions(admin, filter)).filter((s) => s.status === 'planned' && isUpcoming(s.scheduled_date));
    const inputs = sessions.flatMap((session) =>
      session.recipients.map((recipient) => sessionEmail('session_convocation', session, recipient, idempotencyKeys.convocation(session.id, recipient.participantId), actorId)),
    );
    await enqueueEmails(inputs, admin);
  });
  flushOutboxLater();
}

/**
 * Après la modification d'une séance (date, horaires, lieu ou statut). Une séance annulée est
 * annoncée aux personnes qui avaient été convoquées ; une séance déplacée ou rétablie donne lieu
 * à une convocation pour qui n'en a pas encore reçu, sinon à un e-mail « séance modifiée ».
 */
export async function notifySessionChanged(sessionId: string, before: SessionSnapshot, actorId: string | null) {
  await guard('séance modifiée', async (admin) => {
    const [session] = await loadSessions(admin, { ids: [sessionId] });
    if (!session) return;
    const kind = sessionChangeKind(before, session);
    if (!kind) return;
    const convoked = await existingConvocations(admin, [session.id]);
    let inputs: EnqueueInput[] = [];
    if (kind === 'cancelled') {
      if (!isUpcoming(before.scheduled_date)) return;
      inputs = session.recipients
        .filter((recipient) => convoked.has(idempotencyKeys.convocation(session.id, recipient.participantId)))
        .map((recipient) => sessionEmail('session_cancelled', session, recipient, idempotencyKeys.cancellation(session.id, recipient.participantId), actorId));
    } else {
      if (!isUpcoming(session.scheduled_date)) return;
      inputs = session.recipients.map((recipient) => {
        const convocationKey = idempotencyKeys.convocation(session.id, recipient.participantId);
        return convoked.has(convocationKey)
          ? sessionEmail('session_updated', session, recipient, idempotencyKeys.update(session.id, recipient.participantId, session), actorId)
          : sessionEmail('session_convocation', session, recipient, convocationKey, actorId);
      });
    }
    await enqueueEmails(inputs, admin);
  });
  flushOutboxLater();
}

/** Met en file les rappels J-1 des séances du lendemain (heure de Paris). */
export async function enqueueReminders(now: Date = new Date()) {
  const date = tomorrowInParis(now);
  const result = await guard('rappels', async (admin) => {
    const sessions = await loadSessions(admin, { date });
    const inputs = sessions.flatMap((session) =>
      session.recipients.map((recipient) => sessionEmail('session_reminder', session, recipient, idempotencyKeys.reminder(session.id, recipient.participantId, date), null)),
    );
    const outcome = await enqueueEmails(inputs, admin);
    return { sessions: sessions.length, ...outcome };
  });
  return { date, sessions: result?.sessions ?? 0, inserted: result?.inserted ?? 0, duplicates: result?.duplicates ?? 0 };
}

/** Après la validation d'un bilan : e-mail et notification au participant. */
export async function notifyReportFinalized(reportId: string, actorId: string | null) {
  await guard('bilan validé', async (admin) => {
    const { data: report } = await admin.from('participant_reports').select('id, version, status, participant_id').eq('id', reportId).maybeSingle();
    if (!report || report.status !== 'final') return;
    const { data: participant } = await admin.from('participants').select('id, user_id, first_name, email, is_demo').eq('id', report.participant_id).maybeSingle();
    if (!participant) return;
    const { data: profile } = participant.user_id
      ? await admin.from('profiles').select('email, is_demo, status').eq('id', participant.user_id).maybeSingle()
      : { data: null };
    if (profile && profile.status !== 'active') return;
    await enqueueEmails(
      [
        {
          key: idempotencyKeys.report(report.id),
          template: 'report_available',
          data: { firstName: participant.first_name, version: report.version, link: '/participant/bilan' },
          to: participant.email ?? profile?.email ?? null,
          userId: participant.user_id,
          participantId: participant.id,
          reportId: report.id,
          isDemo: participant.is_demo || Boolean(profile?.is_demo),
          createdBy: actorId,
          notification: { type: 'report.finalized', title: 'Votre bilan est disponible', body: 'Votre formateur a validé votre bilan individuel.', link: '/participant/bilan' },
        },
      ],
      admin,
    );
  });
  flushOutboxLater();
}

/**
 * Après l'ajout à un groupe d'une personne qui n'a pas encore de compte : invitation à le créer.
 * L'inscription elle-même passe par Supabase Auth (e-mail de confirmation envoyé par Supabase) :
 * cet e-mail ne le remplace pas et ne contient aucun lien de connexion.
 */
export async function notifyParticipantInvited(participantId: string, groupId: string, actorId: string | null) {
  await guard('invitation', async (admin) => {
    const [{ data: participant }, { data: group }] = await Promise.all([
      admin.from('participants').select('id, user_id, first_name, email, is_demo').eq('id', participantId).maybeSingle(),
      admin.from('groups').select('name, is_demo, programs ( name )').eq('id', groupId).maybeSingle(),
    ]);
    if (!participant || participant.user_id) return;
    await enqueueEmails(
      [
        {
          key: idempotencyKeys.invitation(participant.id),
          template: 'participant_invitation',
          data: { firstName: participant.first_name, groupName: group?.name ?? null, programName: group?.programs?.name ?? null, link: '/inscription' },
          to: participant.email,
          participantId: participant.id,
          isDemo: participant.is_demo || Boolean(group?.is_demo),
          createdBy: actorId,
        },
      ],
      admin,
    );
  });
  flushOutboxLater();
}

/** E-mail de test envoyé immédiatement à l'administrateur (résultat renvoyé à l'interface). */
export async function sendTestEmail(user: { id: string; email: string; firstName: string; isDemo: boolean }): Promise<{ status: string; message: string; summary: ProcessSummary | null }> {
  const config = detectProvider();
  const key = idempotencyKeys.test(user.id);
  const outcome = await guard('test', async (admin) =>
    enqueueEmails(
      [{ key, template: 'test', data: { firstName: user.firstName, provider: config.kind }, to: user.email, userId: user.id, isDemo: user.isDemo, createdBy: user.id }],
      admin,
    ),
  );
  if (!outcome || outcome.inserted === 0) return { status: 'error', message: 'Le message n’a pas pu être mis en file.', summary: null };
  const summary = await processOutbox({ maxBatches: 1 });
  const { data: row } = await createAdminClient().from('email_outbox').select('status, last_error').eq('idempotency_key', key).maybeSingle();
  const status = row?.status ?? 'queued';
  const message =
    status === 'sent'
      ? 'E-mail de test envoyé. Vérifiez votre boîte de réception (et les indésirables).'
      : status === 'skipped'
        ? `Aucun envoi réel : ${row?.last_error ?? 'mode journal.'}`
        : status === 'failed'
          ? `Échec de l’envoi : ${row?.last_error ?? 'erreur inconnue.'} Une nouvelle tentative aura lieu automatiquement.`
          : 'Message en file : il partira au prochain traitement.';
  return { status, message, summary };
}
