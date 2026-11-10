import { FileDown, Sheet } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/primitives';
import { hasPermission } from '@/lib/auth/session';

import { getSessionContext } from '../context';
import { SessionHeader } from '../session-nav';
import { AttendanceSheet, type AttendanceRow } from './attendance-sheet';

export const metadata: Metadata = { title: 'Fiche de présence' };

export default async function PresencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase, session, group, title, members } = await getSessionContext(id);
  const [{ data: attendance }, { data: staff }] = await Promise.all([
    supabase.from('attendance').select('participant_id, status, comment, recorded_at, recorded_by').eq('session_id', id),
    supabase.from('staff_directory').select('id, first_name, last_name'),
  ]);
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
      {rows.length > 0 ? (
        <AttendanceSheet sessionId={id} rows={rows} canEdit={hasPermission(user, 'attendance.write')} />
      ) : (
        <Card>
          <EmptyState title="Aucun participant" description="Ajoutez des participants au groupe pour saisir les présences." />
        </Card>
      )}
    </>
  );
}
