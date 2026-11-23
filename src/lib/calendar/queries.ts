import 'server-only';

import type { ServerClient } from '@/lib/supabase/server';

import { displayStatus, parisNow, type CalendarEvent, type DbSessionStatus, type DisplayStatus } from './calendar';

export type CalendarSpace = 'admin' | 'formateur' | 'organisme' | 'participant';

export type CalendarFilters = {
  organisme?: string;
  formateur?: string;
  groupe?: string;
  statut?: DisplayStatus;
};

type Option = { value: string; label: string };
export type CalendarData = {
  events: CalendarEvent[];
  /** Listes des filtres (limitées à ce que l'appelant a le droit de voir). */
  groups: Option[];
  organizations: Option[];
  trainers: Option[];
};

/** Lien de détail selon l'espace : la page la plus utile que le rôle puisse ouvrir. */
export function eventHref(space: CalendarSpace, session: { id: string; groupId: string }) {
  if (space === 'organisme') return `/organisme/groupes/${session.groupId}`;
  if (space === 'participant') return '/participant/parcours';
  return `/formateur/sessions/${session.id}`;
}

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const cleanId = (value: string | undefined) => (value && UUID.test(value) ? value : undefined);

/**
 * Sessions d'une plage de dates (incluse), lues avec le client de l'appelant : la sécurité au niveau
 * des lignes décide seule de ce qui est visible. Deux requêtes en parallèle (sessions de la plage,
 * groupes pour les filtres et les noms de formateurs), jamais une par session.
 * `groupIds` restreint en plus (formateur : ses groupes) ; les filtres ne font que réduire.
 */
export async function loadCalendar(
  supabase: ServerClient,
  options: { space: CalendarSpace; from: string; to: string; groupIds?: string[]; filters?: CalendarFilters; now?: Date },
): Promise<CalendarData> {
  const { space, from, to, groupIds, filters = {} } = options;
  const now = parisNow(options.now);

  let groupsQuery = supabase
    .from('groups')
    .select('id, name, organization_id, organizations ( id, name ), group_trainers ( trainer_id, profiles!group_trainers_trainer_id_fkey ( first_name, last_name ) )')
    .order('name');
  if (groupIds) groupsQuery = groupsQuery.in('id', groupIds);
  const groupsPromise = groupsQuery;

  const buildSessions = (restrict: string[] | null) => {
    let query = supabase
      .from('sessions')
      .select('id, number, scheduled_date, start_time, end_time, location, status, group_id, program_sessions ( title )')
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date')
      .order('start_time', { nullsFirst: true })
      .order('number');
    if (restrict) query = query.in('group_id', restrict);
    if (filters.groupe) query = query.eq('group_id', filters.groupe);
    return query;
  };

  // Le filtre « formateur » ou « organisme » se traduit en groupes : il faut alors connaître les groupes d'abord.
  const needsGroups = Boolean(filters.formateur || filters.organisme);
  const groupsResult = needsGroups ? await groupsPromise : null;
  const restrictTo = groupsResult
    ? (groupsResult.data ?? [])
        .filter((group) => (!filters.organisme || group.organization_id === filters.organisme) && (!filters.formateur || group.group_trainers.some((t) => t.trainer_id === filters.formateur)))
        .map((group) => group.id)
    : groupIds ?? null;
  const [sessionsResult, groupsRows] = await Promise.all([
    restrictTo && restrictTo.length === 0 ? Promise.resolve({ data: [] as never[] }) : buildSessions(restrictTo),
    groupsResult ?? groupsPromise,
  ]);

  const groups = groupsRows.data ?? [];
  const byGroup = new Map(groups.map((group) => [group.id, group]));
  const name = (person: { first_name: string | null; last_name: string | null } | null) => [person?.first_name, person?.last_name].filter(Boolean).join(' ');

  const events = (sessionsResult.data ?? []).flatMap((session): CalendarEvent[] => {
    if (!session.scheduled_date) return [];
    const group = byGroup.get(session.group_id);
    const event: CalendarEvent = {
      id: session.id,
      number: session.number,
      title: session.program_sessions?.title ?? `Session ${session.number}`,
      date: session.scheduled_date,
      startTime: hhmm(session.start_time),
      endTime: hhmm(session.end_time),
      location: session.location,
      status: session.status as DbSessionStatus,
      groupId: session.group_id,
      groupName: group?.name ?? '',
      organizationName: group?.organizations?.name ?? null,
      trainerNames: (group?.group_trainers ?? []).map((t) => name(t.profiles)).filter(Boolean),
      href: eventHref(space, { id: session.id, groupId: session.group_id }),
    };
    return !filters.statut || displayStatus(event, now) === filters.statut ? [event] : [];
  });

  const options_ = <T,>(items: T[], value: (item: T) => string | undefined, label: (item: T) => string | undefined): Option[] => {
    const map = new Map<string, string>();
    for (const item of items) {
      const v = value(item);
      const l = label(item);
      if (v && l) map.set(v, l);
    }
    return [...map.entries()].map(([v, l]) => ({ value: v, label: l })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  };
  return {
    events,
    groups: options_(groups, (g) => g.id, (g) => g.name),
    organizations: options_(groups, (g) => g.organization_id ?? undefined, (g) => g.organizations?.name),
    trainers: options_(
      groups.flatMap((g) => g.group_trainers),
      (t) => t.trainer_id,
      (t) => name(t.profiles),
    ),
  };
}
