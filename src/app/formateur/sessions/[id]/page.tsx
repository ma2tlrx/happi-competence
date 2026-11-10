import { ClipboardCheck, ClipboardPen, MonitorPlay } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AttendanceBadge } from '@/components/passport/session-status';
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, ProvisionalBadge } from '@/components/ui/primitives';
import { hasPermission } from '@/lib/auth/session';

import { getSessionContext } from './context';
import { SessionDetailsForm, SessionStatusButtons } from './session-client';
import { SessionHeader } from './session-nav';

export const metadata: Metadata = { title: 'Session' };

export default async function SessionHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase, session, group, title, members } = await getSessionContext(id);
  const [attendance, evaluations] = await Promise.all([
    supabase.from('attendance').select('participant_id, status').eq('session_id', id),
    supabase.from('evaluations').select('participant_id, status').eq('session_id', id),
  ]);
  const attendanceBy = new Map((attendance.data ?? []).map((row) => [row.participant_id, row.status]));
  const evaluationBy = new Map((evaluations.data ?? []).map((row) => [row.participant_id, row.status]));
  const sheet = session.program_sessions;
  const canManage = hasPermission(user, 'sessions.manage');
  const recorded = attendanceBy.size;
  const validated = [...evaluationBy.values()].filter((status) => status === 'validated').length;

  return (
    <>
      <SessionHeader session={session} title={title} groupName={group.name} actions={canManage ? <SessionStatusButtons sessionId={session.id} status={session.status} /> : null} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: `/formateur/sessions/${id}/lecteur`, icon: MonitorPlay, title: 'Lecteur pédagogique', text: 'Animer la session pas à pas' },
          { href: `/formateur/sessions/${id}/presences`, icon: ClipboardCheck, title: 'Présences', text: `${recorded}/${members.length} renseignées` },
          { href: `/formateur/sessions/${id}/evaluations`, icon: ClipboardPen, title: 'Évaluations', text: `${validated}/${members.length} validées` },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="group flex items-center gap-4 rounded-lg border border-line bg-white p-4 transition-[border-color,box-shadow] hover:border-petrol-300 hover:shadow-sm">
            <span className="flex size-11 items-center justify-center rounded-md bg-petrol-900 text-white transition-colors group-hover:bg-orange-500 group-hover:text-petrol-950">
              <item.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold text-ink">{item.title}</span>
              <span className="block text-sm text-ink-muted">{item.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={`Participants attendus (${members.length})`} />
            <CardBody className="pt-3">
              {members.length > 0 ? (
                <ul className="divide-y divide-line">
                  {members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <Link href={`/formateur/participants/${member.id}`} className="flex items-center gap-3 hover:text-petrol-700">
                        <Avatar person={{ first_name: member.firstName, last_name: member.lastName }} size="sm" />
                        <span className="font-medium">{member.firstName} {member.lastName}</span>
                      </Link>
                      <span className="flex gap-1.5">
                        <AttendanceBadge status={attendanceBy.get(member.id) ?? null} />
                        {evaluationBy.get(member.id) === 'validated' ? <Badge variant="petrol">Évalué</Badge> : evaluationBy.get(member.id) === 'draft' ? <Badge variant="outline">Brouillon</Badge> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Aucun participant dans ce groupe" description="Ajoutez des participants depuis la fiche du groupe." />
              )}
            </CardBody>
          </Card>
          {sheet ? (
            <Card>
              <CardHeader title="Fiche de session" action={sheet.is_provisional ? <ProvisionalBadge /> : null} />
              <CardBody className="space-y-4 text-[0.9375rem]">
                {sheet.summary ? <p className="text-ink">{sheet.summary}</p> : null}
                {sheet.activities.length ? (
                  <div>
                    <p className="text-sm font-semibold text-ink-muted">Activités</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">{sheet.activities.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                ) : null}
                {!sheet.summary && sheet.activities.length === 0 ? <p className="text-ink-muted">Contenu à venir.</p> : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
        {canManage ? (
          <Card>
            <CardHeader title="Informations" />
            <CardBody>
              <SessionDetailsForm
                sessionId={session.id}
                values={{ scheduledDate: session.scheduled_date, startTime: session.start_time, endTime: session.end_time, location: session.location, status: session.status }}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
