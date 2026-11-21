import { CalendarCheck, Flag, Layers, Send, Users, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PixelProgress } from '@/components/engagement/visuals';
import { PendingSurveysCard } from '@/components/satisfaction/pending-card';
import { groupStatusBadge } from '@/components/trainer/labels';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { parisDate } from '@/lib/attendance/signature';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { completedJourneys, MILESTONE_TIERS, milestoneProgress, type MilestoneId } from '@/lib/engagement/milestones';
import { isUpcomingSession } from '@/lib/listing-rules';
import { getOrganizationOverview } from '@/lib/organization';
import { referralBuckets } from '@/lib/referrals/status';
import { loadMySurveys } from '@/lib/satisfaction/load';
import { createClient } from '@/lib/supabase/server';
import { cn, formatDate, formatPercent, formatShortDate, formatTimeRange, pluralize } from '@/lib/utils';

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
  const milestones: { id: MilestoneId; label: string; icon: LucideIcon; value: number }[] = [
    { id: 'personnes', label: 'personnes accompagnées', icon: Users, value: overview.stats.participants },
    { id: 'sessions', label: 'sessions réalisées', icon: CalendarCheck, value: overview.stats.completedSessions },
    { id: 'parcours', label: 'parcours menés à terme', icon: Flag, value: completedJourneys(overview.participants) },
    ...(canRefer ? [{ id: 'orientations' as const, label: 'orientations acceptées', icon: Send, value: buckets.accepted }] : []),
  ];
  const today = parisDate();
  // Séances en cours d'abord (signalées comme telles), puis les séances prévues à venir.
  const upcoming = [
    ...overview.sessions.filter((session) => session.status === 'in_progress'),
    ...overview.sessions.filter((session) => isUpcomingSession(session, today)),
  ].slice(0, 5);

  return (
    <>
      <PageHeader title={user.organization!.name} description="Le parcours de vos participants, en un coup d’œil. Les données sont consultables, non modifiables." />
      <section aria-labelledby="jalons-titre" className="pixel-grid mb-6 rounded-xl bg-petrol-900 p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="jalons-titre" className="font-display text-xl font-semibold text-white">
            Les jalons de votre structure
          </h2>
          <p className="text-sm text-white/70">
            Présence {formatPercent(overview.stats.attendanceRate)} (retards et départs anticipés inclus) ·{' '}
            {pluralize(overview.stats.upcomingSessions, 'session à venir', 'sessions à venir')}
            {overview.stats.ongoingSessions ? `, ${overview.stats.ongoingSessions} en cours` : ''}
          </p>
        </div>
        <ul className={cn('mt-5 grid grid-cols-2 gap-3', milestones.length === 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3')}>
          {milestones.map((item) => {
            const progress = milestoneProgress(item.value, MILESTONE_TIERS[item.id]);
            return (
              <li key={item.id} className="rounded-lg bg-white/[0.06] p-3.5 ring-1 ring-white/10 sm:p-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'pixel-corners hidden size-10 shrink-0 items-center justify-center sm:flex',
                      progress.reached > 0 ? 'bg-orange-500 text-petrol-950' : 'bg-white/10 text-white/60',
                    )}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <p>
                    <span className="block font-display text-2xl leading-none font-semibold text-white tabular-nums">{progress.value}</span>
                    <span className="mt-1 block text-sm leading-snug text-white/75">{item.label}</span>
                  </p>
                </div>
                <PixelProgress
                  tone="dark"
                  className="mt-4"
                  current={progress.next === null ? 1 : progress.value - progress.previous}
                  target={progress.next === null ? 1 : progress.next - progress.previous}
                  label={progress.next === null ? `${item.label} : tous les jalons franchis` : `${item.label} : ${progress.value} sur ${progress.next}, prochain jalon`}
                />
                <p className="mt-2 text-sm leading-snug text-white/65">
                  {progress.next === null ? 'Tous les jalons franchis' : `Prochain jalon : ${progress.next}`}
                  {progress.reached > 0 ? <span className="hidden sm:inline">{` · ${progress.reached} franchi${progress.reached > 1 ? 's' : ''}`}</span> : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
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
                          <Td className="min-w-48">
                            <span className="font-semibold">{group.name}</span>
                            <span className="block text-sm text-ink-subtle">{group.programName} · {formatDate(group.startDate, 'dates à définir')}</span>
                          </Td>
                          <Td className="text-right tabular-nums">{group.participants}</Td>
                          <Td className="min-w-40">
                            <div className="flex items-center gap-3">
                              <PixelProgress
                                current={group.completedSessions}
                                target={group.totalSessions}
                                label={`${group.completedSessions} sessions terminées sur ${group.totalSessions}`}
                                className="flex-1"
                              />
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
