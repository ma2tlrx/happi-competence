import { ArrowRight, CalendarDays, ClipboardCheck, ClipboardPen, MonitorPlay, Plus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionStatusBadge } from '@/components/passport/session-status';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, EmptyState, PageHeader, StatTile } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listSessions, myGroupIds, pendingEvaluations, todayIso } from '@/lib/trainer';
import { formatShortDate, formatTimeRange, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Tableau de bord formateur' };

export default async function TrainerDashboard() {
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const groupIds = await myGroupIds(supabase, user.id);
  const [sessions, groupsResult, membersResult] = await Promise.all([
    listSessions(supabase, { groupIds }),
    supabase.from('groups').select('id, name, status, start_date, end_date, programs ( name ), organizations ( name )').in('id', groupIds).order('start_date', { ascending: false }),
    supabase.from('group_members').select('participant_id').in('group_id', groupIds).eq('status', 'active'),
  ]);
  const today = todayIso();
  const active = sessions.filter((session) => session.status === 'planned' || session.status === 'in_progress');
  const focus = sessions.find((session) => session.status === 'in_progress') ?? active.find((session) => session.date === today) ?? null;
  const upcoming = active.filter((session) => session !== focus && (!session.date || session.date >= today)).slice(0, 5);
  const done = sessions.filter((session) => session.status === 'completed');
  const pending = await pendingEvaluations(supabase, done.map((session) => session.id));
  const pendingBySession = new Map<string, number>();
  for (const item of pending) pendingBySession.set(item.sessionId, (pendingBySession.get(item.sessionId) ?? 0) + 1);
  const groups = groupsResult.data ?? [];
  const participants = new Set((membersResult.data ?? []).map((row) => row.participant_id)).size;

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.firstName}`}
        description="Vos groupes, vos prochaines sessions et les évaluations à compléter."
        actions={
          <Button asChild variant="outline">
            <Link href="/formateur/groupes?nouveau=1">
              <Plus aria-hidden />
              Nouveau groupe
            </Link>
          </Button>
        }
      />

      {focus ? (
        <section className="pixel-grid mb-6 rounded-xl bg-petrol-900 p-6 text-white sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/65">{focus.status === 'in_progress' ? 'Session en cours' : 'Session du jour'}</span>
                <SessionStatusBadge status={focus.status} />
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                Session {focus.number} · {focus.title}
              </h2>
              <p className="mt-1 text-white/70">
                {focus.groupName} · {formatTimeRange(focus.startTime, focus.endTime)}
                {focus.location ? ` · ${focus.location}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/formateur/sessions/${focus.id}/lecteur`}>
                  <MonitorPlay aria-hidden />
                  Ouvrir le lecteur
                </Link>
              </Button>
              <Button asChild variant="inverse">
                <Link href={`/formateur/sessions/${focus.id}/presences`}>
                  <ClipboardCheck aria-hidden />
                  Présences
                </Link>
              </Button>
              <Button asChild variant="inverse">
                <Link href={`/formateur/sessions/${focus.id}/evaluations`}>
                  <ClipboardPen aria-hidden />
                  Évaluations
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Groupes en cours" value={groups.filter((group) => group.status === 'active').length} icon={Users} />
        <StatTile label="Sessions à venir" value={active.length} icon={CalendarDays} />
        <StatTile label="Sessions réalisées" value={done.length} icon={ClipboardCheck} />
        <StatTile label="Évaluations à compléter" value={pending.length} detail={pluralize(participants, 'participant suivi', 'participants suivis')} icon={ClipboardPen} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Prochaines sessions" action={<Link href="/formateur/sessions" className="text-sm font-semibold text-petrol-700">Toutes les sessions</Link>} />
          <CardBody className="pt-3">
            {upcoming.length > 0 ? (
              <ul className="divide-y divide-line">
                {upcoming.map((session) => (
                  <li key={session.id}>
                    <Link href={`/formateur/sessions/${session.id}`} className="group flex items-center gap-4 py-3">
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-md bg-paper py-1.5 text-center">
                        <span className="text-xs text-ink-muted capitalize">{formatShortDate(session.date).split(' ')[0]}</span>
                        <span className="font-display text-lg leading-none font-semibold">{session.date ? Number(session.date.slice(8, 10)) : '?'}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">Session {session.number} · {session.title}</span>
                        <span className="block truncate text-sm text-ink-muted">{session.groupName} · {formatTimeRange(session.startTime, session.endTime)}</span>
                      </span>
                      <ArrowRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarDays} title="Aucune session planifiée" description="Planifiez les sessions depuis la fiche d’un groupe." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Évaluations à compléter" description="Participants présents à une session terminée, sans évaluation validée." />
          <CardBody className="pt-3">
            {pendingBySession.size > 0 ? (
              <ul className="divide-y divide-line">
                {done
                  .filter((session) => pendingBySession.has(session.id))
                  .map((session) => (
                    <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">Session {session.number} · {session.groupName}</span>
                        <span className="block text-sm text-ink-muted">{pluralize(pendingBySession.get(session.id)!, 'évaluation', 'évaluations')} à finaliser</span>
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/formateur/sessions/${session.id}/evaluations`}>Évaluer</Link>
                      </Button>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState icon={ClipboardPen} title="Tout est à jour" description="Les évaluations des sessions terminées sont toutes validées." />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Mes groupes" action={<Link href="/formateur/groupes" className="text-sm font-semibold text-petrol-700">Gérer</Link>} />
        <CardBody className="pt-3">
          {groups.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => {
                const groupSessions = sessions.filter((session) => session.groupId === group.id);
                const completed = groupSessions.filter((session) => session.status === 'completed').length;
                return (
                  <li key={group.id}>
                    <Link href={`/formateur/groupes/${group.id}`} className="block rounded-lg border border-line p-4 transition-colors hover:border-petrol-300">
                      <p className="font-semibold text-ink">{group.name}</p>
                      <p className="text-sm text-ink-muted">{group.organizations?.name ?? 'Sans organisme'}</p>
                      <div className="mt-3 flex gap-1" aria-label={`${completed} sessions terminées sur ${groupSessions.length || 6}`}>
                        {Array.from({ length: Math.max(groupSessions.length, 6) }, (_, index) => (
                          <span key={index} className={index < completed ? 'h-1.5 flex-1 rounded-full bg-petrol-900' : 'h-1.5 flex-1 rounded-full bg-petrol-100'} />
                        ))}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title="Aucun groupe pour le moment"
              description="Créez votre premier groupe pour y ajouter des participants et planifier les six sessions."
              action={
                <Button asChild>
                  <Link href="/formateur/groupes?nouveau=1">Créer un groupe</Link>
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}
