import { CalendarDays, ClipboardCheck, Layers, Send, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PendingSurveysCard } from '@/components/satisfaction/pending-card';
import { groupStatusBadge } from '@/components/trainer/labels';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { parisDate } from '@/lib/attendance/signature';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { isUpcomingSession } from '@/lib/listing-rules';
import { getOrganizationOverview } from '@/lib/organization';
import { referralBuckets } from '@/lib/referrals/status';
import { loadMySurveys } from '@/lib/satisfaction/load';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatPercent, formatShortDate, formatTimeRange } from '@/lib/utils';

export const metadata: Metadata = { title: 'Espace organisme' };

export default async function OrganizationDashboard() {
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const canRefer = hasPermission(user, 'org.referrals.write');
  const [overview, surveys, referrals] = await Promise.all([
    getOrganizationOverview(supabase),
    loadMySurveys(supabase),
    canRefer ? supabase.from('referrals').select('status').limit(2000) : Promise.resolve({ data: [] as { status: string }[] }),
  ]);
  const buckets = referralBuckets((referrals.data ?? []).map((row) => row.status));
  const today = parisDate();
  // Séances en cours d'abord (signalées comme telles), puis les séances prévues à venir.
  const upcoming = [
    ...overview.sessions.filter((session) => session.status === 'in_progress'),
    ...overview.sessions.filter((session) => isUpcomingSession(session, today)),
  ].slice(0, 5);

  return (
    <>
      <PageHeader title={user.organization!.name} description="Suivi des participants rattachés à votre structure. Les données sont consultables, non modifiables." />
      {surveys.some((survey) => !survey.answered) ? (
        <div className="mb-6">
          <PendingSurveysCard surveys={surveys} basePath="/organisme/satisfaction" />
        </div>
      ) : null}
      {canRefer ? (
        <Card className="mb-6">
          <CardHeader
            title="Mes orientations"
            description="Personnes orientées vers HAPPI par votre structure."
            action={
              <Link href="/organisme/orientations/nouvelle" className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-petrol-700">
                <Send className="size-4" aria-hidden />
                Orienter une personne
              </Link>
            }
          />
          <CardBody className="grid grid-cols-3 gap-3 pt-3">
            {[
              { label: 'En attente', value: buckets.pending, href: '/organisme/orientations' },
              { label: 'En cours d’instruction', value: buckets.inProgress, href: '/organisme/orientations' },
              { label: 'Acceptées', value: buckets.accepted, href: '/organisme/orientations?statut=accepted' },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="rounded-md border border-line px-3 py-3 hover:border-petrol-400">
                <span className="block font-display text-2xl font-semibold tabular-nums">{item.value}</span>
                <span className="text-sm text-ink-muted">{item.label}</span>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile label="Programmes" value={overview.stats.programs} icon={Layers} />
        <StatTile label="Participants" value={overview.stats.participants} icon={Users} />
        <StatTile label="Sessions réalisées" value={overview.stats.completedSessions} icon={ClipboardCheck} />
        <StatTile
          label="Sessions à venir"
          value={overview.stats.upcomingSessions}
          detail={overview.stats.ongoingSessions ? `${overview.stats.ongoingSessions} en cours` : undefined}
          icon={CalendarDays}
        />
        <StatTile label="Taux de présence" value={formatPercent(overview.stats.attendanceRate)} detail="Retards et départs anticipés inclus" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
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
                      const status = groupStatusBadge(group.status, group.startDate);
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
                    <p className="font-medium">
                      Session {session.number} · {session.title}
                      {session.status === 'in_progress' ? <Badge variant="orange" className="ml-2">En cours</Badge> : null}
                    </p>
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
