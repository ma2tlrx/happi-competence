import { BellRing, CalendarDays, ClipboardCheck, ClipboardPen, MonitorPlay, Plus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { PixelProgress } from '@/components/engagement/visuals';
import { SessionStatusBadge } from '@/components/passport/session-status';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { saisieProgress, startOfWeekParis } from '@/lib/engagement/week';
import { DROPOUT_REASON_LABELS } from '@/lib/outcomes/dropout';
import { loadDropoutAlerts } from '@/lib/outcomes/load';
import { createClient } from '@/lib/supabase/server';
import { listSessions, myGroupIds, pendingEvaluations, todayIso } from '@/lib/trainer';
import { formatShortDate, formatTimeRange, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Tableau de bord formateur' };

export default async function TrainerDashboard() {
  const user = await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const groupIds = await myGroupIds(supabase, user.id);
  const week = startOfWeekParis();
  const [sessions, groupsResult, alerts, validatedWeek, observedWeek, attendanceWeek] = await Promise.all([
    listSessions(supabase, { groupIds }),
    supabase.from('groups').select('id, name, status, start_date, end_date, programs ( name ), organizations ( name )').in('id', groupIds).order('start_date', { ascending: false }),
    loadDropoutAlerts(supabase, groupIds),
    // Ma semaine : seulement ce que le formateur connecté a fait lui-même depuis lundi.
    supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('validated_by', user.id).gte('validated_at', week.iso),
    supabase
      .from('evaluation_scores')
      .select('id, evaluations!inner ( validated_by, validated_at )', { count: 'exact', head: true })
      .eq('evaluations.validated_by', user.id)
      .gte('evaluations.validated_at', week.iso)
      .not('score', 'is', null),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('recorded_by', user.id).gte('recorded_at', week.iso),
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
  const validated = validatedWeek.count ?? 0;
  const progress = saisieProgress(validated, pending.length);
  const evaluationTasks = done.filter((session) => pendingBySession.has(session.id));
  const taskCount = evaluationTasks.length + alerts.length;

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.firstName}`}
        description={taskCount > 0 ? `${pluralize(taskCount, 'chose', 'choses')} à faire, le reste est à jour.` : 'Tout est à jour. Belle semaine.'}
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

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader
            title={taskCount > 0 ? `À faire (${taskCount})` : 'À faire'}
            description={taskCount > 0 ? 'Les évaluations des sessions terminées et les personnes à relancer.' : undefined}
            action={
              <Link href="/formateur/suivis" className="text-sm font-semibold text-petrol-700">
                Suivi des parcours
              </Link>
            }
          />
          <CardBody className="pt-2">
            {taskCount > 0 ? (
              <ul className="divide-y divide-line">
                {evaluationTasks.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-start gap-3">
                      <span aria-hidden className="pixel-corners mt-0.5 flex size-9 shrink-0 items-center justify-center bg-petrol-100 text-petrol-700">
                        <ClipboardPen className="size-[1.125rem]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">
                          {pluralize(pendingBySession.get(session.id)!, 'évaluation', 'évaluations')} à finaliser
                        </span>
                        <span className="block text-sm text-ink-muted">
                          Session {session.number} · {session.groupName}
                        </span>
                      </span>
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/formateur/sessions/${session.id}/evaluations`}>Évaluer</Link>
                    </Button>
                  </li>
                ))}
                {alerts.map((alert) => (
                  <li key={`${alert.groupId}:${alert.participantId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-start gap-3">
                      <span aria-hidden className="pixel-corners mt-0.5 flex size-9 shrink-0 items-center justify-center bg-orange-50 text-orange-700">
                        <BellRing className="size-[1.125rem]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">
                          Relancer{' '}
                          <Link href={`/formateur/participants/${alert.participantId}`} className="hover:underline">
                            {alert.participantName}
                          </Link>
                        </span>
                        <span className="block text-sm text-ink-muted">
                          {alert.groupName} · {alert.reasons.map((reason) => DROPOUT_REASON_LABELS[reason]).join(', ')}
                        </span>
                      </span>
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/formateur/groupes/${alert.groupId}`}>Voir le groupe</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-5 py-2">
                <Image src="/brand/happi-mascotte-3d.webp" alt="" width={72} height={120} className="h-24 w-auto shrink-0" />
                <div>
                  <p className="font-display text-xl font-semibold text-ink">Tout est à jour</p>
                  <p className="mt-1 text-[0.9375rem] text-ink-muted">Évaluations validées, personne à relancer. Le moment idéal pour préparer la prochaine session.</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ma semaine" description="Depuis lundi. Ces chiffres ne sont visibles que par vous." />
          <CardBody className="space-y-5 pt-2">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[0.9375rem] font-medium text-ink">Évaluations à jour</span>
                <span className="font-display text-lg font-semibold text-ink tabular-nums">{progress === null ? '—' : `${progress} %`}</span>
              </div>
              <PixelProgress
                current={progress ?? 0}
                target={100}
                label={progress === null ? 'Aucune évaluation à faire cette semaine' : `Évaluations à jour : ${progress} %`}
              />
              <p className="mt-1.5 text-sm text-ink-subtle">
                {pending.length > 0 ? `Encore ${pluralize(pending.length, 'évaluation', 'évaluations')} et c’est complet.` : 'Rien en attente.'}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              {[
                { label: 'évaluations validées', value: validated },
                { label: 'compétences observées', value: observedWeek.count ?? 0 },
                { label: 'présences saisies', value: attendanceWeek.count ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex flex-col">
                  <dt className="text-sm leading-snug text-ink-muted">{item.label}</dt>
                  <dd className="order-first font-display text-2xl font-semibold text-ink tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                        <span className="block truncate font-medium text-ink group-hover:underline">Session {session.number} · {session.title}</span>
                        <span className="block truncate text-sm text-ink-muted">{session.groupName} · {formatTimeRange(session.startTime, session.endTime)}</span>
                      </span>
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
          <CardHeader title="Mes groupes" action={<Link href="/formateur/groupes" className="text-sm font-semibold text-petrol-700">Gérer</Link>} />
          <CardBody className="pt-3">
            {groups.length > 0 ? (
              <ul className="space-y-3">
                {groups.map((group) => {
                  const groupSessions = sessions.filter((session) => session.groupId === group.id);
                  const completed = groupSessions.filter((session) => session.status === 'completed').length;
                  const total = Math.max(groupSessions.length, 6);
                  return (
                    <li key={group.id}>
                      <Link href={`/formateur/groupes/${group.id}`} className="block rounded-lg border border-line p-4 transition-colors hover:border-petrol-300">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-semibold text-ink">{group.name}</p>
                          <p className="text-sm text-ink-muted tabular-nums">
                            {completed}/{total}
                          </p>
                        </div>
                        <p className="text-sm text-ink-muted">{group.organizations?.name ?? 'Sans organisme'}</p>
                        <PixelProgress current={completed} target={total} label={`${completed} sessions terminées sur ${total}`} className="mt-3" />
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
      </div>
    </>
  );
}
