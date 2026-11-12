import { FileDown, FileSignature, Lock, PenLine, Sheet } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { Card, EmptyState, Notice } from '@/components/ui/primitives';
import { isSignatureWindowOpen } from '@/lib/attendance/signature';
import { hasPermission } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/utils';

import { getSessionContext } from '../context';
import { SessionHeader } from '../session-nav';
import { AttendanceSheet, type AttendanceRow } from './attendance-sheet';

export const metadata: Metadata = { title: 'Fiche de présence' };

export default async function PresencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase, session, group, title, members } = await getSessionContext(id);
  const [{ data: attendance }, { data: staff }, { data: signatures }, { data: counter }] = await Promise.all([
    supabase.from('attendance').select('participant_id, status, comment, recorded_at, recorded_by').eq('session_id', id),
    supabase.from('staff_directory').select('id, first_name, last_name'),
    supabase.from('attendance_signatures').select('participant_id, kind, signed_at').eq('session_id', id),
    supabase.from('attendance_countersignatures').select('trainer_name, signed_at').eq('session_id', id).maybeSingle(),
  ]);
  const signatureOf = new Map((signatures ?? []).map((row) => [row.participant_id, row]));
  const byParticipant = new Map((attendance ?? []).map((row) => [row.participant_id, row]));
  const staffName = new Map((staff ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`]));
  const rows: AttendanceRow[] = members.map((member) => {
    const record = byParticipant.get(member.id);
    return {
      participantId: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      status: (record?.status as AttendanceRow['status']) ?? null,
      comment: record?.comment ?? null,
      recordedAt: record?.recorded_at ?? null,
      recordedBy: record?.recorded_by ? (staffName.get(record.recorded_by) ?? null) : null,
      signedAt: signatureOf.get(member.id)?.signed_at ?? null,
      signatureKind: (signatureOf.get(member.id)?.kind as AttendanceRow['signatureKind']) ?? null,
    };
  });

  return (
    <>
      <SessionHeader
        session={session}
        title={title}
        groupName={group.name}
        actions={
          <>
            {!counter && isSignatureWindowOpen(session) && hasPermission(user, 'attendance.write') ? (
              <Button asChild>
                <a href={`/formateur/sessions/${id}/presences/emargement`}>
                  <PenLine aria-hidden />
                  Émargement
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <a href={`/api/exports/emargement/${id}`} download>
                <FileSignature aria-hidden />
                Feuille d’émargement
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/exports/presences/${id}?format=pdf`} download>
                <FileDown aria-hidden />
                PDF
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/exports/presences/${id}?format=csv`} download>
                <Sheet aria-hidden />
                CSV
              </a>
            </Button>
          </>
        }
      />
      {counter ? (
        <Notice variant="success" title="Feuille d’émargement contre-signée" className="mb-4">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-4" aria-hidden />
            Contre-signée par {counter.trainer_name} le {formatDateTime(counter.signed_at)} : les présences sont figées (correction par un administrateur).
          </span>
        </Notice>
      ) : (
        <Notice className="mb-4">
          Le jour de la séance, ouvrez « Émargement » pour faire signer les participants présents sur cette tablette, puis contre-signez la feuille. Les
          participants peuvent aussi signer depuis leur compte.
        </Notice>
      )}
      {rows.length > 0 ? (
        <AttendanceSheet sessionId={id} rows={rows} canEdit={hasPermission(user, 'attendance.write') && !counter} />
      ) : (
        <Card>
          <EmptyState title="Aucun participant" description="Ajoutez des participants au groupe pour saisir les présences." />
        </Card>
      )}
    </>
  );
}
