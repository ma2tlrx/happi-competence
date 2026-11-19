import 'server-only';

import { loadImpactDataset } from '@/lib/outcomes/load';
import { loadSatisfactionResults } from '@/lib/satisfaction/load';
import type { ServerClient } from '@/lib/supabase/server';
import { firstOf } from '@/lib/utils';

import { computeBpf, type BpfReport } from './bpf';
import { computeConventionReport, type ConventionReport } from './indicators';
import type { FundingDataset } from './realisation';

/**
 * Lectures des financements. Toutes passent par la session de l'utilisateur : les tables
 * de conventions ne sont lisibles que par l'administrateur (RLS) ; l'organisme passe par
 * org_funding_conventions() et ne compte que ses propres participants.
 */
const PAGE = 1000;
const CHUNK = 150;
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAll<T>(build: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function inChunks<T>(ids: string[], build: (chunk: string[], from: number, to: number) => Page<T>): Promise<T[]> {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += CHUNK) chunks.push(unique.slice(index, index + CHUNK));
  return (await Promise.all(chunks.map((chunk) => fetchAll((from, to) => build(chunk, from, to))))).flat();
}

export type Funder = {
  id: string;
  name: string;
  kind: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isDemo: boolean;
  conventions: number;
};

export async function loadFunders(supabase: ServerClient): Promise<Funder[]> {
  const [{ data: funders }, { data: conventions }] = await Promise.all([
    supabase.from('funders').select('id, name, kind, contact_name, contact_email, contact_phone, is_demo').order('name'),
    supabase.from('funding_conventions').select('funder_id'),
  ]);
  const count = new Map<string, number>();
  for (const row of conventions ?? []) count.set(row.funder_id, (count.get(row.funder_id) ?? 0) + 1);
  return (funders ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    isDemo: row.is_demo,
    conventions: count.get(row.id) ?? 0,
  }));
}

export type Convention = {
  id: string;
  funderId: string;
  funderName: string;
  funderKind: string;
  reference: string | null;
  title: string;
  startDate: string;
  endDate: string;
  plannedParticipants: number;
  plannedHours: number;
  /** Nul pour l'organisme (jamais transmis) ou s'il n'est pas renseigné. */
  amount: number | null;
  status: string;
  notes: string | null;
  isDemo: boolean;
  groupIds: string[];
};

const CONVENTION_COLUMNS =
  'id, funder_id, reference, title, start_date, end_date, planned_participants, planned_hours_per_participant, amount_eur, status, notes, is_demo, funders ( name, kind )';

type ConventionRow = {
  id: string;
  funder_id: string;
  reference: string | null;
  title: string;
  start_date: string;
  end_date: string;
  planned_participants: number;
  planned_hours_per_participant: number;
  amount_eur: number | null;
  status: string;
  notes: string | null;
  is_demo: boolean;
  funders: { name: string; kind: string } | { name: string; kind: string }[] | null;
};

function toConvention(row: ConventionRow, groupIds: string[]): Convention {
  const funder = firstOf(row.funders);
  return {
    id: row.id,
    funderId: row.funder_id,
    funderName: funder?.name ?? '',
    funderKind: funder?.kind ?? '',
    reference: row.reference,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    plannedParticipants: row.planned_participants,
    plannedHours: Number(row.planned_hours_per_participant),
    amount: row.amount_eur === null ? null : Number(row.amount_eur),
    status: row.status,
    notes: row.notes,
    isDemo: row.is_demo,
    groupIds,
  };
}

/** Conventions et groupes rattachés (administrateur). */
export async function loadConventions(supabase: ServerClient): Promise<Convention[]> {
  const [{ data: rows }, { data: links }] = await Promise.all([
    supabase.from('funding_conventions').select(CONVENTION_COLUMNS).order('start_date', { ascending: false }),
    supabase.from('funding_convention_groups').select('group_id, convention_id'),
  ]);
  const groups = new Map<string, string[]>();
  for (const link of links ?? []) groups.set(link.convention_id, [...(groups.get(link.convention_id) ?? []), link.group_id]);
  return ((rows ?? []) as ConventionRow[]).map((row) => toConvention(row, groups.get(row.id) ?? []));
}

export async function loadConvention(supabase: ServerClient, id: string): Promise<Convention | null> {
  const [{ data: row }, { data: links }] = await Promise.all([
    supabase.from('funding_conventions').select(CONVENTION_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('funding_convention_groups').select('group_id').eq('convention_id', id),
  ]);
  return row ? toConvention(row as ConventionRow, (links ?? []).map((link) => link.group_id)) : null;
}

/** Conventions visibles par l'organisme connecté (hors brouillons, sans montant ni notes). */
export async function loadOrganizationConventions(supabase: ServerClient): Promise<Convention[]> {
  const { data } = await supabase.rpc('org_funding_conventions');
  return (data ?? []).map((row) => ({
    id: row.id,
    funderId: '',
    funderName: row.funder_name,
    funderKind: row.funder_kind,
    reference: row.reference,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    plannedParticipants: row.planned_participants,
    plannedHours: Number(row.planned_hours_per_participant),
    amount: null,
    status: row.status,
    notes: null,
    isDemo: false,
    groupIds: row.group_ids ?? [],
  }));
}

export type GroupOption = { id: string; name: string; startDate: string | null; endDate: string | null; status: string; conventionId: string | null };

/** Groupes, avec leur convention éventuelle, pour le rattachement (administrateur). */
export async function loadGroupOptions(supabase: ServerClient): Promise<GroupOption[]> {
  const [groups, links] = await Promise.all([
    fetchAll((from, to) => supabase.from('groups').select('id, name, start_date, end_date, status').order('start_date', { ascending: false }).range(from, to)),
    fetchAll((from, to) => supabase.from('funding_convention_groups').select('group_id, convention_id').range(from, to)),
  ]);
  const conventionOf = new Map(links.map((link) => [link.group_id, link.convention_id]));
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    startDate: group.start_date,
    endDate: group.end_date,
    status: group.status,
    conventionId: conventionOf.get(group.id) ?? null,
  }));
}

/** Données de calcul (impact + horaires + trame) des groupes donnés, avec les droits de l'utilisateur. */
export async function loadFundingDataset(supabase: ServerClient, groupIds: string[], organizationId: string | null = null): Promise<FundingDataset> {
  const impact = await loadImpactDataset(supabase, { groupIds, organizationId });
  const ids = impact.groups.map((group) => group.id);
  const [sessions, groups] = await Promise.all([
    inChunks(ids, (chunk, from, to) => supabase.from('sessions').select('id, start_time, end_time').in('group_id', chunk).range(from, to)),
    inChunks(ids, (chunk, from, to) =>
      supabase.from('groups').select('id, programs ( session_duration_minutes, sessions_count )').in('id', chunk).range(from, to),
    ),
  ]);
  return {
    impact,
    sessionDetails: sessions.map((row) => ({ id: row.id, startTime: row.start_time, endTime: row.end_time })),
    programs: groups.map((row) => {
      const program = firstOf(row.programs);
      return { groupId: row.id, sessionMinutes: program?.session_duration_minutes ?? null, sessionsCount: program?.sessions_count ?? null };
    }),
  };
}

/**
 * Tableau de bord d'une convention. Pour l'organisme (organizationId), le périmètre se limite
 * à ses participants : indicateurs partiels, signalés comme tels à l'écran.
 */
export async function loadConventionReport(
  supabase: ServerClient,
  convention: Convention,
  today: string,
  { organizationId = null }: { organizationId?: string | null } = {},
): Promise<ConventionReport> {
  const dataset = await loadFundingDataset(supabase, convention.groupIds, organizationId);
  const sessionIds = dataset.impact.sessions.filter((session) => session.status === 'completed').map((session) => session.id);
  const [countersigned, satisfaction] = await Promise.all([
    inChunks(sessionIds, (chunk, from, to) => supabase.from('attendance_countersignatures').select('session_id').in('session_id', chunk).range(from, to)),
    organizationId ? Promise.resolve(null) : loadSatisfactionResults(supabase, dataset.impact.groups.map((group) => group.id)),
  ]);
  return computeConventionReport({
    terms: { plannedParticipants: convention.plannedParticipants, plannedHoursPerParticipant: convention.plannedHours, startDate: convention.startDate, endDate: convention.endDate },
    groupIds: dataset.impact.groups.map((group) => group.id),
    dataset,
    satisfaction: satisfaction?.summaries ?? [],
    countersignedSessionIds: countersigned.map((row) => row.session_id),
    today,
  });
}

/** BPF d'une année civile (administrateur) : groupes ayant au moins une séance datée de l'année. */
export async function loadBpf(supabase: ServerClient, year: number): Promise<BpfReport> {
  const sessions = await fetchAll((from, to) =>
    supabase.from('sessions').select('group_id').gte('scheduled_date', `${year}-01-01`).lte('scheduled_date', `${year}-12-31`).range(from, to),
  );
  const groupIds = [...new Set(sessions.map((row) => row.group_id))];
  const [dataset, conventions, links] = await Promise.all([
    loadFundingDataset(supabase, groupIds),
    loadConventions(supabase),
    fetchAll((from, to) => supabase.from('funding_convention_groups').select('group_id, convention_id').range(from, to)),
  ]);
  return computeBpf({
    year,
    dataset,
    links: links.map((link) => ({ groupId: link.group_id, conventionId: link.convention_id })),
    conventions: conventions.map((convention) => ({
      id: convention.id,
      reference: convention.reference,
      title: convention.title,
      funderName: convention.funderName,
      funderKind: convention.funderKind,
    })),
  });
}
