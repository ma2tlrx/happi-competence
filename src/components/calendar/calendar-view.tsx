'use client';

import { Ban, CalendarX2, CircleCheck, Clock, ExternalLink, MapPin, PlayCircle, UserRound, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Dialog, DialogContent } from '@/components/ui/overlays';
import { buttonClasses } from '@/components/ui/button';
import { Badge, EmptyState, type BadgeVariant } from '@/components/ui/primitives';
import {
  displayStatus,
  groupByDay,
  monthGrid,
  STATUS_LABEL,
  weekDays,
  type CalendarEvent,
  type CalendarView,
  type DisplayStatus,
} from '@/lib/calendar/calendar';
import { dayLabel, dayLabelYear, dayNumber, sessionCountLabel, timeLabel, weekdayLabel } from '@/lib/calendar/format';
import { cn } from '@/lib/utils';

/** Statut = icône + mot + couleur (jamais la couleur seule). */
const STATUS: Record<DisplayStatus, { icon: LucideIcon; variant: BadgeVariant; bar: string; chip: string }> = {
  upcoming: { icon: Clock, variant: 'petrol', bar: 'border-l-petrol-500', chip: 'bg-petrol-50 text-petrol-900 hover:bg-petrol-100' },
  in_progress: { icon: PlayCircle, variant: 'orange', bar: 'border-l-orange-500', chip: 'bg-orange-50 text-orange-900 hover:bg-orange-100' },
  completed: { icon: CircleCheck, variant: 'success', bar: 'border-l-success', chip: 'bg-success-soft text-ink hover:bg-[#d7ecdd]' },
  cancelled: { icon: Ban, variant: 'neutral', bar: 'border-l-line-strong', chip: 'bg-paper text-ink-muted line-through hover:bg-line' },
};

export const LEGEND: DisplayStatus[] = ['upcoming', 'in_progress', 'completed', 'cancelled'];

export function StatusLegend() {
  return (
    <ul aria-label="Légende des statuts" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted">
      {LEGEND.map((status) => {
        const Icon = STATUS[status].icon;
        return (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-flex size-6 items-center justify-center rounded-sm border-l-4', STATUS[status].bar, STATUS[status].chip.split(' ').slice(0, 2).join(' '))}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            {STATUS_LABEL[status]}
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  view: CalendarView;
  anchor: string;
  events: CalendarEvent[];
  /** Date et heure de Paris au moment du rendu serveur (statuts et « aujourd'hui »). */
  now: { date: string; time: string };
  showOrganization: boolean;
  /** Libellé du lien de détail, selon l'espace. */
  detailLabel: string;
};

const eventSummary = (event: CalendarEvent, status: DisplayStatus) =>
  `${event.groupName} — Session ${event.number} : ${event.title}, ${timeLabel(event.startTime, event.endTime)}${event.location ? `, ${event.location}` : ''}, ${STATUS_LABEL[status].toLowerCase()}`;

export function CalendarView({ view, anchor, events, now, showOrganization, detailLabel }: Props) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const byDay = useMemo(() => groupByDay(events), [events]);
  const statusOf = (event: CalendarEvent) => displayStatus(event, now);
  const month = anchor.slice(0, 7);
  const monthDays = useMemo(() => [...byDay.keys()].filter((date) => date.startsWith(month)).sort(), [byDay, month]);

  const agenda = (days: string[], label: string) =>
    days.length === 0 ? (
      <EmptyState icon={CalendarX2} title="Aucune session à cette période" description="Changez de période ou retirez un filtre pour voir d’autres sessions." />
    ) : (
      <ol aria-label={label} className="divide-y divide-line">
        {days.map((date) => (
          <li key={date} className="px-4 py-4 sm:px-6">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-ink first-letter:uppercase">
              {dayLabel(date)}
              {date === now.date ? <span className="text-sm font-semibold text-orange-700">Aujourd’hui</span> : null}
            </h3>
            <ul className="mt-3 space-y-2">
              {byDay.get(date)!.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} status={statusOf(event)} showOrganization={showOrganization} onOpen={setSelected} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    );

  return (
    <>
      {view === 'mois' ? (
        <>
          <div className="hidden md:block">
            <MonthGrid anchor={anchor} byDay={byDay} now={now} statusOf={statusOf} onOpen={setSelected} />
          </div>
          <div className="md:hidden">{agenda(monthDays, 'Sessions du mois')}</div>
        </>
      ) : view === 'semaine' ? (
        <WeekView anchor={anchor} byDay={byDay} now={now} statusOf={statusOf} showOrganization={showOrganization} onOpen={setSelected} />
      ) : (
        agenda(monthDays, 'Sessions du mois')
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => (open ? null : setSelected(null))}>
        {selected ? <EventDetail event={selected} status={statusOf(selected)} showOrganization={showOrganization} detailLabel={detailLabel} /> : null}
      </Dialog>
    </>
  );
}

function EventCard({ event, status, showOrganization, onOpen }: { event: CalendarEvent; status: DisplayStatus; showOrganization: boolean; onOpen: (event: CalendarEvent) => void }) {
  const config = STATUS[status];
  const Icon = config.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      aria-haspopup="dialog"
      className={cn('block min-h-11 w-full rounded-md border border-line border-l-4 bg-white px-3 py-2.5 text-left transition-colors hover:bg-petrol-50', config.bar, status === 'cancelled' && 'bg-paper')}
    >
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink tabular-nums">{timeLabel(event.startTime, event.endTime)}</span>
        <Badge variant={config.variant} icon={Icon}>{STATUS_LABEL[status]}</Badge>
      </span>
      <span className={cn('mt-1 block font-semibold text-ink', status === 'cancelled' && 'line-through')}>
        Session {event.number} — {event.title}
      </span>
      <span className="mt-0.5 block text-sm text-ink-muted">
        {event.groupName}
        {showOrganization && event.organizationName ? ` · ${event.organizationName}` : ''}
        {event.location ? ` · ${event.location}` : ''}
      </span>
    </button>
  );
}

function Pill({ event, status, onOpen }: { event: CalendarEvent; status: DisplayStatus; onOpen: (event: CalendarEvent) => void }) {
  const config = STATUS[status];
  const Icon = config.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      aria-haspopup="dialog"
      title={eventSummary(event, status)}
      className={cn('flex min-h-7 w-full items-center gap-1 rounded-sm border-l-4 px-1.5 py-1 text-left text-xs leading-tight transition-colors', config.bar, config.chip)}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="shrink-0 font-semibold tabular-nums">{event.startTime ?? 'Jour'}</span>
      <span className="truncate">{event.groupName}</span>
      <span className="sr-only">
        , Session {event.number} — {event.title}, {timeLabel(event.startTime, event.endTime)}
        {event.location ? `, ${event.location}` : ''}, {STATUS_LABEL[status].toLowerCase()}
      </span>
    </button>
  );
}

function MonthGrid({
  anchor,
  byDay,
  now,
  statusOf,
  onOpen,
}: {
  anchor: string;
  byDay: Map<string, CalendarEvent[]>;
  now: { date: string };
  statusOf: (event: CalendarEvent) => DisplayStatus;
  onOpen: (event: CalendarEvent) => void;
}) {
  const weeks = monthGrid(anchor);
  const MAX = 3;
  return (
    <div>
      <div aria-hidden className="grid grid-cols-7 border-b border-line bg-petrol-50/60 text-center text-xs font-semibold text-ink-muted">
        {weeks[0]!.map((day) => (
          <div key={day.date} className="py-2 capitalize">{weekdayLabel(day.date)}</div>
        ))}
      </div>
      <ol aria-label="Jours du mois" className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const list = byDay.get(day.date) ?? [];
          const isToday = day.date === now.date;
          return (
            <li key={day.date} className={cn('min-h-28 min-w-0 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0', !day.inMonth && 'bg-paper/70')}>
              <h3 className="mb-1 flex items-center justify-between">
                <span aria-hidden className={cn('inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold', isToday ? 'bg-petrol-900 text-white' : day.inMonth ? 'text-ink' : 'text-ink-subtle')}>
                  {dayNumber(day.date)}
                </span>
                <span className="sr-only">
                  {dayLabelYear(day.date)}, {sessionCountLabel(list.length)}
                  {isToday ? ', aujourd’hui' : ''}
                </span>
              </h3>
              {list.length > 0 ? (
                <ul className="space-y-1">
                  {list.slice(0, MAX).map((event) => (
                    <li key={event.id}>
                      <Pill event={event} status={statusOf(event)} onOpen={onOpen} />
                    </li>
                  ))}
                  {list.length > MAX ? (
                    <li>
                      <Link
                        href={`?vue=semaine&date=${day.date}`}
                        className="flex min-h-7 items-center rounded-sm px-1.5 text-xs font-semibold text-petrol-700 hover:underline"
                        aria-label={`Voir les ${list.length} sessions du ${dayLabel(day.date)} dans la vue semaine`}
                      >
                        + {list.length - MAX} autres
                      </Link>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WeekView({
  anchor,
  byDay,
  now,
  statusOf,
  showOrganization,
  onOpen,
}: {
  anchor: string;
  byDay: Map<string, CalendarEvent[]>;
  now: { date: string };
  statusOf: (event: CalendarEvent) => DisplayStatus;
  showOrganization: boolean;
  onOpen: (event: CalendarEvent) => void;
}) {
  const days = weekDays(anchor);
  const total = days.reduce((sum, date) => sum + (byDay.get(date)?.length ?? 0), 0);
  return (
    <>
      {total === 0 ? <p className="border-b border-line px-4 py-3 text-sm text-ink-muted sm:px-6" role="status">Aucune session à cette période.</p> : null}
      <ol aria-label="Jours de la semaine" className="grid divide-y divide-line md:grid-cols-7 md:divide-x md:divide-y-0">
        {days.map((date) => {
          const list = byDay.get(date) ?? [];
          const isToday = date === now.date;
          return (
            <li key={date} className={cn('min-w-0 px-3 py-3', isToday && 'bg-orange-50/50')}>
              <h3 className="mb-2 text-sm font-semibold text-ink first-letter:uppercase">
                {dayLabel(date)}
                <span className="sr-only">, {sessionCountLabel(list.length)}</span>
                {isToday ? <span className="ml-1.5 text-orange-700">Aujourd’hui</span> : null}
              </h3>
              {list.length > 0 ? (
                <ul className="space-y-2">
                  {list.map((event) => (
                    <li key={event.id}>
                      <EventCard event={event} status={statusOf(event)} showOrganization={showOrganization} onOpen={onOpen} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p aria-hidden className="text-sm text-ink-subtle md:hidden">—</p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function EventDetail({ event, status, showOrganization, detailLabel }: { event: CalendarEvent; status: DisplayStatus; showOrganization: boolean; detailLabel: string }) {
  const config = STATUS[status];
  const rows: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Clock, label: 'Date et horaire', value: `${dayLabelYear(event.date)}, ${timeLabel(event.startTime, event.endTime)}` },
    { icon: Users, label: 'Groupe', value: showOrganization && event.organizationName ? `${event.groupName} — ${event.organizationName}` : event.groupName },
    ...(event.trainerNames.length > 0 ? [{ icon: UserRound, label: event.trainerNames.length > 1 ? 'Formateurs' : 'Formateur', value: event.trainerNames.join(', ') }] : []),
    { icon: MapPin, label: 'Lieu', value: event.location ?? 'Lieu à définir' },
  ];
  return (
    <DialogContent title={`Session ${event.number} — ${event.title}`} description={<Badge variant={config.variant} icon={config.icon}>{STATUS_LABEL[status]}</Badge>} size="md">
      <dl className="space-y-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-petrol-600" aria-hidden />
            <div>
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <Link href={event.href} className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'mt-6 w-full sm:w-auto')}>
        {detailLabel}
        <ExternalLink aria-hidden />
      </Link>
    </DialogContent>
  );
}
