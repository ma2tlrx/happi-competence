import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { ATTENDANCE_STATUS } from '@/components/passport/session-status';
import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { AttendanceDocument, type AttendanceExportRow } from '@/lib/pdf/attendance-document';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDateTime, formatTimeRange, isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

function csvCell(value: string) {
  // Neutralise les formules (injection CSV) et échappe les guillemets.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * Feuille de présence d'une session (PDF ou CSV).
 * RLS limite les lignes : un organisme n'obtient que ses propres participants.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const format = request.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'pdf';
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 });
  if (user.role === 'participant') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  if (user.role === 'organisme' && !(hasPermission(user, 'org.exports') && hasPermission(user, 'org.attendance.read'))) {
    return NextResponse.json({ error: 'Téléchargement non autorisé pour ce compte.' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, number, scheduled_date, start_time, end_time, location, group_id, program_sessions ( title ), groups ( name, organizations ( name ) )')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 });

  const [{ data: members }, { data: attendance }, { data: staff }] = await Promise.all([
    supabase.from('group_members').select('status, participants ( id, first_name, last_name, organizations ( name ) )').eq('group_id', session.group_id),
    supabase.from('attendance').select('participant_id, status, comment, recorded_at, recorded_by').eq('session_id', sessionId),
    supabase.from('staff_directory').select('id, first_name, last_name'),
  ]);
  const byParticipant = new Map((attendance ?? []).map((row) => [row.participant_id, row]));
  const staffName = new Map((staff ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`]));
  const rows: AttendanceExportRow[] = (members ?? [])
    .filter((member) => member.participants && (member.status === 'active' || byParticipant.has(member.participants.id)))
    .map((member) => {
      const record = byParticipant.get(member.participants!.id);
      return {
        lastName: member.participants!.last_name,
        firstName: member.participants!.first_name,
        organization: member.participants!.organizations?.name ?? '',
        status: record ? (ATTENDANCE_STATUS[record.status]?.label ?? record.status) : 'Non renseigné',
        comment: record?.comment ?? '',
        recordedAt: record ? formatDateTime(record.recorded_at) : '',
        recordedBy: record?.recorded_by ? (staffName.get(record.recorded_by) ?? '') : '',
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));

  const title = `Feuille de présence — Session ${session.number} · ${session.program_sessions?.title ?? ''}`;
  const date = session.scheduled_date ?? 'sans-date';
  await supabase.rpc('log_event', { p_action: format === 'csv' ? 'export.attendance_csv' : 'export.attendance_pdf', p_entity_type: 'session', p_entity_id: sessionId });

  if (format === 'csv') {
    const header = ['Nom', 'Prénom', 'Organisme', 'Présence', 'Commentaire', 'Validée le', 'Saisie par'];
    const lines = [header, ...rows.map((row) => [row.lastName, row.firstName, row.organization, row.status, row.comment, row.recordedAt, row.recordedBy])];
    const csv = `﻿${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}\r\n`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="presences-session-${session.number}-${date}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const buffer = await renderToBuffer(
    <AttendanceDocument
      title={title}
      meta={[
        `${session.groups?.name ?? ''}${session.groups?.organizations?.name ? ` · ${session.groups.organizations.name}` : ''}`,
        `${formatDate(session.scheduled_date)} · ${formatTimeRange(session.start_time, session.end_time)}${session.location ? ` · ${session.location}` : ''}`,
      ]}
      rows={rows}
      generatedAt={formatDateTime(new Date())}
    />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="presences-session-${session.number}-${date}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
