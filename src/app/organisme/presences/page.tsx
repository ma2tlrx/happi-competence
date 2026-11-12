import { ClipboardCheck, FileDown, FileSignature, Sheet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AttendanceBadge } from '@/components/passport/session-status';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { attendanceRate } from '@/lib/evaluation-engine';
import { getOrganizationOverview } from '@/lib/organization';
import { createClient } from '@/lib/supabase/server';
import { cn, formatDate, formatPercent } from '@/lib/utils';

export const metadata: Metadata = { title: 'Présences' };

export default async function OrganizationAttendancePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session: selectedId } = await searchParams;
  const user = await requireRole('organisme');
  if (!hasPermission(user, 'org.attendance.read')) {
    return (
      <>
        <PageHeader title="Présences" />
        <Notice variant="warning" title="Accès non autorisé">Votre structure n’a pas accès aux fiches de présence.</Notice>
      </>
    );
  }
  const supabase = await createClient();
  const overview = await getOrganizationOverview(supabase);
  const completed = overview.sessions.filter((session) => session.status === 'completed').reverse();
  const selected = completed.find((session) => session.id === selectedId) ?? completed[0];
  const canExport = hasPermission(user, 'org.exports');
  const nameOf = new Map(overview.participants.map((p) => [p.id, `${p.lastName.toUpperCase()} ${p.firstName}`]));

  return (
    <>
      <PageHeader title="Présences" description="Les fiches de présence des sessions réalisées, limitées à vos participants." />
      {completed.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="Aucune session réalisée" description="Les fiches de présence apparaîtront après la première session." /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Sessions réalisées" className="rounded-lg border border-line bg-white p-2 lg:self-start">
            <ul className="space-y-0.5">
              {completed.map((session) => {
                const rows = overview.attendance.filter((row) => row.session_id === session.id);
                return (
                  <li key={session.id}>
                    <Link
                      href={`/organisme/presences?session=${session.id}`}
                      aria-current={session.id === selected?.id ? 'page' : undefined}
                      className={cn('block rounded-md px-3 py-2', session.id === selected?.id ? 'bg-petrol-900 text-white' : 'hover:bg-petrol-50')}
                    >
                      <span className="block text-sm font-semibold">Session {session.number} · {session.groupName}</span>
                      <span className={cn('block text-xs', session.id === selected?.id ? 'text-white/70' : 'text-ink-subtle')}>
                        {formatDate(session.date)} · présence {formatPercent(attendanceRate(rows.map((row) => row.status)))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {selected ? (
            <Card>
              <CardHeader
                title={`Session ${selected.number} · ${selected.title}`}
                description={`${selected.groupName} · ${formatDate(selected.date)}`}
                action={
                  canExport ? (
                    <>
                      <Button asChild size="sm" variant="outline"><a href={`/api/exports/emargement/${selected.id}`} download><FileSignature aria-hidden />Émargement</a></Button>
                      <Button asChild size="sm" variant="outline"><a href={`/api/exports/presences/${selected.id}?format=pdf`} download><FileDown aria-hidden />PDF</a></Button>
                      <Button asChild size="sm" variant="outline"><a href={`/api/exports/presences/${selected.id}?format=csv`} download><Sheet aria-hidden />CSV</a></Button>
                    </>
                  ) : null
                }
              />
              <CardBody className="pt-3">
                <ul className="divide-y divide-line">
                  {overview.participants
                    .filter((participant) => participant.groupId === selected.groupId)
                    .map((participant) => {
                      const record = overview.attendance.find((row) => row.session_id === selected.id && row.participant_id === participant.id);
                      return (
                        <li key={participant.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="font-medium">{nameOf.get(participant.id)}</span>
                          {record ? <AttendanceBadge status={record.status} /> : <span className="text-sm text-ink-subtle">Non renseigné</span>}
                        </li>
                      );
                    })}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
