import 'server-only';

import { ATTENDANCE_STATUS } from '@/components/passport/session-status';
import type { createClient } from '@/lib/supabase/server';

import { sheetFingerprint, signatureSha256 } from './fingerprint';
import { computeRealisation } from './hours';
import { TRAINING_ORGANISATION, type Certificate, type SheetRow, type SignatureSheet } from './documents';

export type { Certificate, SheetRow, SignatureSheet };

type Client = Awaited<ReturnType<typeof createClient>>;

/** Feuille d'émargement d'une séance, lue avec les droits de l'utilisateur (RLS). Nulle si la séance n'est pas visible. */
export async function loadSignatureSheet(supabase: Client, sessionId: string): Promise<SignatureSheet | null> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, number, scheduled_date, start_time, end_time, location, status, group_id, trainer_id, program_sessions ( title ), groups ( name, organizations ( name ), programs ( name ) )')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return null;

  const [{ data: members }, { data: attendance }, { data: signatures }, { data: counter }, { data: trainers }, { data: staff }] = await Promise.all([
    supabase.from('group_members').select('status, participants ( id, first_name, last_name )').eq('group_id', session.group_id),
    supabase.from('attendance').select('participant_id, status').eq('session_id', sessionId),
    supabase
      .from('attendance_signatures')
      .select('participant_id, kind, signature_svg, unable_reason, signed_at, method, content_sha256')
      .eq('session_id', sessionId),
    supabase
      .from('attendance_countersignatures')
      .select('trainer_name, signed_at, signature_svg, content_sha256, signatures_sha256, attested')
      .eq('session_id', sessionId)
      .maybeSingle(),
    supabase.from('group_trainers').select('trainer_id, is_lead').eq('group_id', session.group_id),
    supabase.from('staff_directory').select('id, first_name, last_name'),
  ]);

  const staffName = new Map((staff ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`]));
  const trainerIds = session.trainer_id
    ? [session.trainer_id]
    : (trainers ?? []).sort((a, b) => Number(b.is_lead) - Number(a.is_lead)).map((row) => row.trainer_id);
  const trainerNames = trainerIds.map((id) => staffName.get(id)).filter((name): name is string => Boolean(name));

  const statusOf = new Map((attendance ?? []).map((row) => [row.participant_id, row.status]));
  const signatureOf = new Map((signatures ?? []).map((row) => [row.participant_id, row]));
  const attested = new Map(
    (Array.isArray(counter?.attested) ? (counter.attested as { participant_id?: string; status?: string }[]) : []).map((item) => [item.participant_id, item.status]),
  );

  const rows: SheetRow[] = (members ?? [])
    .filter((member) => member.participants && (member.status === 'active' || statusOf.has(member.participants.id) || signatureOf.has(member.participants.id)))
    .map((member) => {
      const person = member.participants!;
      const status = statusOf.get(person.id) ?? null;
      const signature = signatureOf.get(person.id);
      const content = signature ? (signature.kind === 'drawn' ? signature.signature_svg : signature.unable_reason) : null;
      return {
        participantId: person.id,
        lastName: person.last_name,
        firstName: person.first_name,
        status,
        statusLabel: status ? (ATTENDANCE_STATUS[status]?.label ?? status) : 'Non renseigné',
        corrected: Boolean(counter) && attested.get(person.id) !== status,
        signature: signature
          ? {
              kind: signature.kind as 'drawn' | 'unable',
              path: signature.signature_svg,
              reason: signature.unable_reason,
              signedAt: signature.signed_at,
              method: signature.method,
              sha256: signature.content_sha256,
              verified:
                content !== null &&
                signatureSha256({ sessionId, participantId: person.id, signedAt: signature.signed_at, kind: signature.kind as 'drawn' | 'unable', content }) ===
                  signature.content_sha256,
            }
          : null,
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));

  const countersignature = counter
    ? {
        trainerName: counter.trainer_name,
        signedAt: counter.signed_at,
        path: counter.signature_svg,
        sha256: counter.content_sha256,
        signaturesSha256: counter.signatures_sha256,
        verified:
          signatureSha256({
            sessionId,
            participantId: null,
            signedAt: counter.signed_at,
            kind: 'countersign',
            content: `${counter.signature_svg}|${counter.signatures_sha256}`,
          }) === counter.content_sha256,
      }
    : null;

  const base = {
    session: {
      id: session.id,
      number: session.number,
      title: session.program_sessions?.title ?? `Session ${session.number}`,
      date: session.scheduled_date,
      startTime: session.start_time,
      endTime: session.end_time,
      location: session.location,
      status: session.status,
    },
    groupId: session.group_id,
    groupName: session.groups?.name ?? '',
    organizationName: session.groups?.organizations?.name ?? null,
    programName: session.groups?.programs?.name ?? 'Programme HAPPI',
    trainers: trainerNames,
    rows,
    countersignature,
  };
  // Empreinte de l'ensemble des données imprimées (hors date de génération) : une même
  // feuille régénérée donne la même empreinte ; la moindre différence la change.
  const fingerprint = sheetFingerprint({
    version: 'emargement-feuille-v1',
    organisation: TRAINING_ORGANISATION.name,
    ...base,
    rows: rows.map((row) => ({ ...row, signature: row.signature ? { ...row.signature, verified: undefined } : null })),
    countersignature: countersignature ? { ...countersignature, verified: undefined } : null,
  });
  return { ...base, fingerprint };
}

/**
 * Données du certificat de réalisation d'un participant dans un groupe (RLS).
 * Nul si le participant n'est pas membre visible de ce groupe pour l'utilisateur.
 */
export async function loadCertificate(supabase: Client, participantId: string, groupId: string): Promise<Certificate | null> {
  const [{ data: membership }, { data: participant }, { data: group }, { data: sessions }] = await Promise.all([
    supabase.from('group_members').select('status').eq('group_id', groupId).eq('participant_id', participantId).maybeSingle(),
    supabase.from('participants').select('id, first_name, last_name, organizations ( name )').eq('id', participantId).maybeSingle(),
    supabase
      .from('groups')
      .select('id, name, start_date, end_date, organizations ( name ), programs ( name, sessions_count, session_duration_minutes )')
      .eq('id', groupId)
      .maybeSingle(),
    supabase.from('sessions').select('id, number, status, scheduled_date, start_time, end_time, location').eq('group_id', groupId),
  ]);
  if (!membership || !participant || !group) return null;
  const ids = (sessions ?? []).map((session) => session.id);
  const { data: attendance } = ids.length
    ? await supabase.from('attendance').select('session_id, status').eq('participant_id', participantId).in('session_id', ids)
    : { data: [] as { session_id: string; status: string }[] };

  const realisation = computeRealisation({
    sessions: (sessions ?? []).map((session) => ({
      id: session.id,
      number: session.number,
      status: session.status,
      scheduledDate: session.scheduled_date,
      startTime: session.start_time,
      endTime: session.end_time,
    })),
    attendance: new Map((attendance ?? []).map((row) => [row.session_id, row.status])),
    programMinutes: group.programs?.session_duration_minutes ?? null,
    programSessionsCount: group.programs?.sessions_count ?? null,
  });
  // Pas de champ « modalité » en base : présentiel en groupe dès qu'un lieu est renseigné (à valider).
  const modality = (sessions ?? []).some((session) => session.location) ? 'Présentiel, en groupe' : 'En groupe (modalité à préciser)';

  const base = {
    participant: {
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      organizationName: participant.organizations?.name ?? null,
    },
    group: {
      id: group.id,
      name: group.name,
      startDate: group.start_date ?? realisation.firstDate,
      endDate: group.end_date ?? realisation.lastDate,
      organizationName: group.organizations?.name ?? null,
    },
    programName: group.programs?.name ?? 'Programme HAPPI',
    modality,
    realisation,
  };
  return { ...base, fingerprint: sheetFingerprint({ version: 'certificat-realisation-v1', ...base }) };
}
