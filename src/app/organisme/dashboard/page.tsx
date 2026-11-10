import { CalendarDays, ClipboardCheck, Layers, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { GROUP_STATUS } from '@/components/trainer/labels';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { getOrganizationOverview } from '@/lib/organization';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatPercent, formatShortDate, formatTimeRange } from '@/lib/utils';

export const metadata: Metadata = { title: 'Espace organisme' };

export default async function OrganizationDashboard() {
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const overview = await getOrganizationOverview(supabase);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = overview.sessions.filter((session) => (session.status === 'planned' || session.status === 'in_progress') && (!session.date || session.date >= today)).slice(0, 5);

  return (
    <>
      <PageHeader title={user.organization!.name} description="Suivi des participants rattachés à votre structure. Les données sont consultables, non modifiables." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile label="Programmes" value={overview.stats.programs} icon={Layers} />
        <StatTile label="Participants" value={overview.stats.participants} icon={Users} />
        <StatTile label="Sessions réalisées" value={overview.stats.completedSessions} icon={ClipboardCheck} />
        <StatTile label="Sessions à venir" value={overview.stats.upcomingSessions} icon={CalendarDays} />
        <StatTile label="Taux de présence" value={formatPercent(overview.stats.attendanceRate)} detail="Retards et départs anticipés inclus" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Avancement des programmes" action={<Link href="/organisme/programmes" className="text-sm font-semibold text-petrol-700">Détail</Link>} />
          <CardBody className="px-0 pt-3 pb-1 sm:px-0">
            {overview.groups.length > 0 ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Groupe</Th>
                      <Th className="text-right">Participants</Th>
                      <Th>Avancement</Th>
                      <Th>Statut</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.groups.map((group) => {
                      const status = GROUP_STATUS[group.status] ?? GROUP_STATUS.active!;
                      return (
                        <Tr key={group.id}>
                          <Td>
                            <span className="font-semibold">{group.name}</span>
                            <span className="block text-sm text-ink-subtle">{group.programName} · {formatDate(group.startDate, 'dates à définir')}</span>
                          </Td>
                          <Td className="text-right tabular-nums">{group.participants}</Td>
                          <Td className="min-w-40">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-1 gap-1" aria-hidden>
                                {Array.from({ length: group.totalSessions }, (_, i) => (
                                  <span key={i} className={i < group.completedSessions ? 'h-1.5 flex-1 rounded-full bg-petrol-900' : 'h-1.5 flex-1 rounded-full bg-petrol-100'} />
                                ))}
                              </div>
                              <span className="text-sm tabular-nums text-ink-muted">{group.completedSessions}/{group.totalSessions}</span>
                            </div>
                          </Td>
                          <Td><Badge variant={status.variant}>{status.label}</Badge></Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState icon={Layers} title="Aucun programme en cours" description="Les groupes apparaîtront ici dès qu’un formateur y aura inscrit vos participants." />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Prochaines sessions" action={<Link href="/organisme/sessions" className="text-sm font-semibold text-petrol-700">Toutes</Link>} />
          <CardBody className="pt-3">
            {upcoming.length > 0 ? (
              <ul className="divide-y divide-line">
                {upcoming.map((session) => (
                  <li key={session.id} className="py-3">
                    <p className="font-medium">Session {session.number} · {session.title}</p>
                    <p className="text-sm text-ink-muted">{session.groupName} · {formatShortDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9375rem] text-ink-muted">Aucune session à venir.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
