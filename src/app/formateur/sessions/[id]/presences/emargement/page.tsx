import type { Metadata } from 'next';

import { isSignableStatus, isSignatureWindowOpen } from '@/lib/attendance/signature';
import { hasPermission } from '@/lib/auth/session';
import { formatDate, formatTimeRange } from '@/lib/utils';

import { getSessionContext } from '../../context';
import { SigningStation, type StationRow } from './station';

export const metadata: Metadata = { title: 'Émargement' };

/** Écran d'émargement plein écran, à tendre aux participants sur la tablette du formateur. */
export default async function EmargementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase, session, group, title, members } = await getSessionContext(id);
  const [{ data: attendance }, { data: signatures }, { data: counter }] = await Promise.all([
    supabase.from('attendance').select('participant_id, status').eq('session_id', id),
    supabase.from('attendance_signatures').select('participant_id, kind, signed_at').eq('session_id', id),
    supabase.from('attendance_countersignatures').select('trainer_name, signed_at').eq('session_id', id).maybeSingle(),
  ]);
  const statusOf = new Map((attendance ?? []).map((row) => [row.participant_id, row.status]));
  const signatureOf = new Map((signatures ?? []).map((row) => [row.participant_id, row]));
  const rows: StationRow[] = members.map((member) => {
    const signature = signatureOf.get(member.id);
    return {
      participantId: member.id,
      name: `${member.lastName.toUpperCase()} ${member.firstName}`,
      status: statusOf.get(member.id) ?? null,
      signable: isSignableStatus(statusOf.get(member.id)),
      signature: signature ? { kind: signature.kind as 'drawn' | 'unable', signedAt: signature.signed_at } : null,
    };
  });

  return (
    <SigningStation
      sessionId={id}
      title={`Session ${session.number} · ${title}`}
      subtitle={`${group.name} · ${formatDate(session.scheduled_date)} · ${formatTimeRange(session.start_time, session.end_time)}`}
      dateLabel={formatDate(session.scheduled_date)}
      rows={rows}
      missingAttendance={rows.filter((row) => !row.status).length}
      windowOpen={isSignatureWindowOpen(session)}
      canWrite={hasPermission(user, 'attendance.write')}
      frozen={counter ? { trainerName: counter.trainer_name, signedAt: counter.signed_at } : null}
    />
  );
}
