import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/navigation';
import { Card, PageHeader } from '@/components/ui/primitives';
import {
  CALENDAR_VIEWS,
  isIsoDate,
  parisNow,
  parseView,
  rangeFor,
  shiftAnchor,
  type DisplayStatus,
} from '@/lib/calendar/calendar';
import { periodLabel } from '@/lib/calendar/format';
import { cleanId, loadCalendar, type CalendarFilters, type CalendarSpace } from '@/lib/calendar/queries';
import type { ServerClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

import { CalendarView, StatusLegend } from './calendar-view';

export type CalendarSearchParams = { vue?: string; date?: string; organisme?: string; formateur?: string; groupe?: string; statut?: string };

const STATUS_PARAM: Record<string, DisplayStatus> = { 'a-venir': 'upcoming', 'en-cours': 'in_progress', terminee: 'completed', annulee: 'cancelled' };
const STATUS_OPTIONS = [
  { value: 'a-venir', label: 'À venir' },
  { value: 'en-cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'annulee', label: 'Annulées' },
];

const COPY: Record<CalendarSpace, { description: string; detailLabel: string }> = {
  admin: { description: 'Toutes les sessions des organismes et des formateurs de la plateforme : passées, en cours et à venir.', detailLabel: 'Ouvrir la session' },
  formateur: { description: 'Les sessions de vos groupes.', detailLabel: 'Ouvrir la session' },
  organisme: { description: 'Les sessions des groupes de votre structure.', detailLabel: 'Voir le groupe' },
  participant: { description: 'Les sessions auxquelles vous êtes inscrit.', detailLabel: 'Voir mon parcours' },
};

/**
 * Page de calendrier commune aux quatre espaces. Rendu serveur : la vue, la période et les filtres
 * sont dans l'URL ; une seule plage de dates est lue à chaque affichage (voir loadCalendar).
 */
export async function CalendarPage({
  space,
  basePath,
  params,
  supabase,
  groupIds,
}: {
  space: CalendarSpace;
  basePath: string;
  params: CalendarSearchParams;
  supabase: ServerClient;
  groupIds?: string[];
}) {
  const now = parisNow();
  const view = parseView(params.vue);
  const anchor = isIsoDate(params.date) ? params.date : now.date;
  const filters: CalendarFilters = {
    groupe: cleanId(params.groupe),
    ...(space === 'admin' ? { organisme: cleanId(params.organisme), formateur: cleanId(params.formateur), statut: params.statut ? STATUS_PARAM[params.statut] : undefined } : {}),
  };
  const { from, to } = rangeFor(view, anchor);
  const data = await loadCalendar(supabase, { space, from, to, groupIds, filters });

  const href = (patch: { vue?: string; date?: string | null }) => {
    const query = new URLSearchParams();
    for (const key of ['organisme', 'formateur', 'groupe', 'statut'] as const) {
      const value = params[key];
      if (value) query.set(key, value);
    }
    const nextView = patch.vue ?? view;
    if (nextView !== 'mois') query.set('vue', nextView);
    const date = patch.date === undefined ? (params.date && isIsoDate(params.date) ? params.date : null) : patch.date;
    if (date) query.set('date', date);
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const unit = view === 'semaine' ? 'semaine' : 'mois';
  const title = periodLabel(view, anchor);
  const nav = 'inline-flex size-11 items-center justify-center rounded-md border border-line-strong bg-white text-ink transition-colors hover:border-petrol-400 hover:bg-petrol-50';

  return (
    <>
      <PageHeader
        title="Calendrier"
        description={COPY[space].description}
        actions={
          space !== 'admin' ? (
            <a href="/api/calendrier/ics" download className={buttonClasses({ variant: 'outline', size: 'md' })}>
              <Download aria-hidden />
              Ajouter à mon agenda
            </a>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ date: shiftAnchor(view, anchor, -1) })} className={nav} aria-label={`${unit === 'mois' ? 'Mois' : 'Semaine'} précédent${unit === 'mois' ? '' : 'e'}`}>
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <Link href={href({ date: shiftAnchor(view, anchor, 1) })} className={nav} aria-label={`${unit === 'mois' ? 'Mois' : 'Semaine'} suivant${unit === 'mois' ? '' : 'e'}`}>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
          <Link href={href({ date: null })} className={buttonClasses({ variant: 'outline', size: 'md', className: 'min-h-11' })}>
            Aujourd’hui
          </Link>
          <h2 className="ml-1 font-display text-xl font-semibold text-ink" aria-live="polite">
            {title}
          </h2>
        </div>
        <nav aria-label="Affichage du calendrier" className="inline-flex self-start rounded-lg border border-line-strong bg-white p-1">
          {CALENDAR_VIEWS.map((item) => (
            <Link
              key={item.value}
              href={href({ vue: item.value })}
              aria-current={item.value === view ? 'page' : undefined}
              className={cn('inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold transition-colors', item.value === view ? 'bg-petrol-900 text-white' : 'text-ink-muted hover:bg-petrol-50 hover:text-ink')}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {space === 'admin' || data.groups.length > 1 ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap" role="group" aria-label="Filtres du calendrier">
          {space === 'admin' ? <FilterSelect param="organisme" label="Filtrer par organisme" allLabel="Tous les organismes" options={data.organizations} /> : null}
          {space === 'admin' ? <FilterSelect param="formateur" label="Filtrer par formateur" allLabel="Tous les formateurs" options={data.trainers} /> : null}
          <FilterSelect param="groupe" label="Filtrer par groupe" allLabel="Tous les groupes" options={data.groups} />
          {space === 'admin' ? <FilterSelect param="statut" label="Filtrer par statut" allLabel="Tous les statuts" options={STATUS_OPTIONS} /> : null}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
          <CalendarDays className="size-5 text-petrol-600" aria-hidden />
          <p className="text-sm text-ink-muted" role="status">
            {data.events.length === 0 ? 'Aucune session à cette période.' : data.events.length === 1 ? '1 session sur la période affichée.' : `${data.events.length} sessions sur la période affichée.`}
          </p>
        </div>
        <CalendarView view={view} anchor={anchor} events={data.events} now={now} showOrganization={space === 'admin' || space === 'organisme'} detailLabel={COPY[space].detailLabel} />
        <div className="border-t border-line bg-paper/50 px-4 py-3 sm:px-6">
          <StatusLegend />
        </div>
      </Card>
    </>
  );
}
