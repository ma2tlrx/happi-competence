import { BellRing, CalendarClock, CalendarDays, GraduationCap, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PixelProgress } from '@/components/engagement/visuals';
import { Badge } from '@/components/ui/primitives';
import { compactTimeRange, dateSpan, joinNames } from '@/lib/organisme/groups';
import type { GroupSummary } from '@/lib/organisme/load';
import { formatDate, formatPercent, formatShortDate, pluralize } from '@/lib/utils';

function Line({ icon: Icon, children }: { icon: typeof Users; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-ink-muted">
      <Icon className="mt-0.5 size-4 shrink-0 text-petrol-400" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Ce qui vient ensuite pour le groupe : la séance en cours, la prochaine, ou la fin. */
function nextText(group: GroupSummary) {
  if (group.next?.status === 'in_progress') return <span className="font-semibold text-ink">Séance {group.next.number} en cours</span>;
  if (group.next) {
    const label = group.completedSessions === 0 ? 'Première séance' : 'Prochaine séance';
    const time = compactTimeRange(group.next.startTime, group.next.endTime);
    return (
      <>
        {label} :{' '}
        <span className="font-semibold text-ink">
          {group.next.date ? formatShortDate(group.next.date) : 'date à fixer'}
          {group.next.date && time ? (
            <>
              , <span className="whitespace-nowrap">{time}</span>
            </>
          ) : null}
        </span>
      </>
    );
  }
  if (group.bucket === 'finished') return group.endDate ? `Groupe terminé le ${formatDate(group.endDate)}` : 'Groupe terminé';
  return 'Aucune séance prévue pour l’instant';
}

/** Carte d'un groupe : toute la carte mène à la page du groupe (lien étiré, nom accessible = nom du groupe). */
export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <article className="relative flex flex-col gap-4 rounded-lg border border-line bg-white p-5 transition-[border-color,box-shadow] duration-150 hover:border-petrol-300 hover:shadow-sm has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-orange-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[1.0625rem] leading-snug font-semibold text-ink">
            <Link href={`/organisme/groupes/${group.id}`} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none">
              {group.name}
            </Link>
          </h3>
          {group.programName ? <p className="mt-0.5 text-sm text-ink-muted">{group.programName}</p> : null}
        </div>
        {group.toRelaunch > 0 ? (
          <Badge variant="orange" icon={BellRing} className="shrink-0">
            {group.toRelaunch} à relancer
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <PixelProgress
          current={group.completedSessions}
          target={Math.max(group.totalSessions, 1)}
          label={`${pluralize(group.completedSessions, 'séance faite', 'séances faites')} sur ${group.totalSessions}`}
          className="flex-1"
        />
        <span className="text-sm font-semibold text-ink tabular-nums">
          {group.completedSessions}/{group.totalSessions}
          <span className="sr-only"> séances faites</span>
        </span>
      </div>

      <div className="space-y-1.5">
        <Line icon={CalendarDays}>{dateSpan(group.startDate, group.endDate).replace(/^./, (letter) => letter.toUpperCase())}</Line>
        {group.trainers.length ? <Line icon={GraduationCap}>Avec {joinNames(group.trainers)}</Line> : null}
        <Line icon={Users}>
          {group.members ? pluralize(group.members, 'membre') : 'Aucun membre de votre structure'}
          {group.attendanceRate !== null ? (
            <>
              <span aria-hidden className="px-1.5 text-line-strong">
                |
              </span>
              <span className="sr-only">, </span>
              Présence <span className="font-semibold text-ink">{formatPercent(group.attendanceRate)}</span>
            </>
          ) : null}
        </Line>
        <Line icon={CalendarClock}>{nextText(group)}</Line>
      </div>
    </article>
  );
}
