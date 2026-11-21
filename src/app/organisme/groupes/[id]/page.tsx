import { ArrowLeft, BellRing, CalendarDays, GraduationCap, Sparkle, UserCheck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PresenceLegend, PresenceTrail } from '@/components/organisme/presence';
import { RelaunchControl } from '@/components/organisme/relaunch-control';
import { SessionStrip } from '@/components/organisme/session-strip';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, Notice } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { dateSpan, joinNames } from '@/lib/organisme/groups';
import { loadGroupDetail, type MemberView } from '@/lib/organisme/load';
import { createClient } from '@/lib/supabase/server';
import { formatPercent, isUuid, pluralize } from '@/lib/utils';

import { relaunchAbsent } from './actions';

export const metadata: Metadata = { title: 'Mon groupe' };

function revealedText(count: number) {
  if (count === 0) return 'Aucune compétence révélée pour l’instant';
  return pluralize(count, 'compétence révélée', 'compétences révélées');
}

export default async function OrganizationGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const access = { attendance: hasPermission(user, 'org.attendance.read'), evaluations: hasPermission(user, 'org.evaluations.read') };
  // RLS : seulement un groupe de la structure, ou qui accueille l'une de ses personnes.
  const group = await loadGroupDetail(supabase, id, access);
  if (!group) notFound();

  const member = (person: MemberView) => {
    const fullName = `${person.firstName} ${person.lastName}`;
    return (
      <li
        key={person.participantId}
        className="p-4 max-xl:rounded-lg max-xl:border max-xl:border-line max-xl:bg-white xl:col-span-4 xl:grid xl:grid-cols-subgrid xl:items-center xl:px-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={{ first_name: person.firstName, last_name: person.lastName }} tone={person.followup.kind === 'to_relaunch' ? 'orange' : 'petrol'} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{fullName}</p>
            {person.membership === 'dropped' ? (
              <Badge variant="neutral" className="mt-0.5">
                Parcours interrompu
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="mt-3 xl:mt-0">{access.attendance ? <PresenceTrail entries={person.presence} name={fullName} /> : null}</div>
        <div className="mt-2 xl:mt-0">
          {person.revealed !== null ? (
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
              <Sparkle className={person.revealed > 0 ? 'size-4 shrink-0 text-orange-500' : 'size-4 shrink-0 text-ink-subtle'} aria-hidden />
              {revealedText(person.revealed)}
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 xl:mt-0 xl:justify-end">
          <Button asChild size="sm" variant="outline">
            <Link href={`/organisme/participants/${person.participantId}?groupe=${group.id}`}>
              Voir ses résultats
              <span className="sr-only"> : {fullName}</span>
            </Link>
          </Button>
          {person.membership === 'active' && access.attendance ? (
            <RelaunchControl action={relaunchAbsent} groupId={group.id} participantId={person.participantId} fullName={fullName} followup={person.followup} />
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <>
      <Link href="/organisme/dashboard" className="mb-3 inline-flex min-h-8 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Mes groupes
      </Link>

      <header className="pixel-grid mb-8 rounded-xl bg-petrol-900 p-5 text-white sm:p-7">
        <h1 className="font-display text-[1.625rem] leading-tight font-semibold text-white sm:text-[1.875rem]">{group.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/75">
          {group.programName ? <span>{group.programName}</span> : null}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-white/55" aria-hidden />
            {dateSpan(group.startDate, group.endDate).replace(/^./, (letter) => letter.toUpperCase())}
          </span>
          {group.trainers.length ? (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-4 text-white/55" aria-hidden />
              Avec {joinNames(group.trainers)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-white/55" aria-hidden />
            {group.members ? pluralize(group.members, 'membre') : 'Aucun membre de votre structure'}
          </span>
          {group.attendanceRate !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="size-4 text-white/55" aria-hidden />
              Présence {formatPercent(group.attendanceRate)}
            </span>
          ) : null}
        </div>
        <div className="mt-6">
          <SessionStrip sessions={group.sessions} total={group.totalSessions} />
        </div>
      </header>

      <section aria-labelledby="membres-titre">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="membres-titre" className="font-display text-xl font-semibold text-ink">
              Les membres
            </h2>
            {access.attendance && group.toRelaunch > 0 ? (
              <p className="mt-1.5">
                <Badge variant="orange" icon={BellRing}>
                  {pluralize(group.toRelaunch, 'personne à relancer', 'personnes à relancer')}
                </Badge>
              </p>
            ) : access.attendance && group.people.some((person) => person.membership === 'active') ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                <Image src="/brand/happi-mascotte.png" alt="" width={28} height={28} className="size-7" />
                Personne à relancer pour l’instant.
              </p>
            ) : null}
          </div>
          {access.attendance && group.people.length ? <PresenceLegend /> : null}
        </div>

        {!access.attendance ? (
          <Notice className="mb-4" title="Présences non partagées">
            Votre structure n’a pas accès aux présences : les cases de présence et la relance ne s’affichent pas.
          </Notice>
        ) : null}

        {group.people.length ? (
          // Une carte par personne (deux colonnes sur tablette) ; dès 1280 px, une ligne par personne, colonnes alignées (sous-grille).
          <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-[minmax(10rem,1.2fr)_minmax(11rem,1fr)_minmax(9rem,1fr)_18rem] xl:gap-x-6 xl:gap-y-0 xl:divide-y xl:divide-line xl:overflow-hidden xl:rounded-lg xl:border xl:border-line xl:bg-white">
            {group.people.map(member)}
          </ul>
        ) : (
          <Card className="flex flex-col items-center px-6 py-10 text-center">
            <Image src="/brand/happi-mascotte-3d.webp" alt="" width={72} height={120} className="h-24 w-auto" />
            <p className="mt-4 font-display font-semibold text-ink">Personne de votre structure dans ce groupe</p>
            <p className="mt-1 max-w-md text-sm text-ink-muted">Les personnes que vous accompagnez apparaîtront ici dès qu’un formateur les inscrira.</p>
          </Card>
        )}

        {group.hidden ? (
          <p className="mt-4 text-sm text-ink-subtle">
            {pluralize(group.hidden, 'autre personne', 'autres personnes')} de ce groupe : résultats non partagés avec votre structure.
          </p>
        ) : null}
      </section>
    </>
  );
}
