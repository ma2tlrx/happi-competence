import 'server-only';

import { hasPermission, type CurrentUser } from '@/lib/auth/session';
import { fetchAll, inChunks } from '@/lib/outcomes/load';
import { createClient, type ServerClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { firstOf } from '@/lib/utils';

import type { Answer, AnswerColumn, EntryProfileRecord, EntryProfileValues } from './codes';
import { ANSWER_FIELDS } from './codes';
import { buildFseReport, type FseDataset, type FseFilters, type FseReport } from './indicators';

/**
 * Lectures FSE+. Tout passe par la session de l'utilisateur : RLS limite les fiches d'entrée à
 * l'administrateur, à l'organisme du participant (permission org.entry_profile.manage) et au
 * participant lui-même — jamais au formateur.
 */
export const ENTRY_PROFILE_COLUMNS =
  'id, participant_id, group_id, entry_date, gender, age_band, labour_status, unemployment_duration, diploma_level, disability, third_country_national, foreign_background, minority, homeless_or_housing_excl, rural_area, qpv_resident, zrr_frr_resident, rqth, rsa_beneficiary, france_travail_registered, cej, participant_informed_at, participant_confirmed_at, updated_at';

type ProfileRow = Record<string, unknown> & {
  id: string;
  participant_id: string;
  group_id: string | null;
  entry_date: string | null;
  gender: string | null;
  age_band: string | null;
  labour_status: string | null;
  unemployment_duration: string | null;
  diploma_level: string | null;
  participant_informed_at: string | null;
  participant_confirmed_at: string | null;
  updated_at: string;
};

export function toEntryProfile(row: ProfileRow): EntryProfileRecord {
  const answers: Partial<Record<AnswerColumn, Answer | null>> = {};
  for (const field of ANSWER_FIELDS) answers[field.column] = (row[field.column] as Answer | null) ?? null;
  return {
    id: row.id,
    participantId: row.participant_id,
    groupId: row.group_id,
    entryDate: row.entry_date,
    gender: row.gender as EntryProfileValues['gender'],
    ageBand: row.age_band as EntryProfileValues['ageBand'],
    labourStatus: row.labour_status as EntryProfileValues['labourStatus'],
    unemploymentDuration: row.unemployment_duration as EntryProfileValues['unemploymentDuration'],
    diplomaLevel: row.diploma_level as EntryProfileValues['diplomaLevel'],
    answers,
    participantInformedAt: row.participant_informed_at,
    participantConfirmedAt: row.participant_confirmed_at,
    updatedAt: row.updated_at,
  };
}

/** Fiches d'entrée d'un participant (toutes cohortes). RLS : vide pour un formateur. */
export async function loadEntryProfiles(supabase: ServerClient, participantId: string): Promise<EntryProfileRecord[]> {
  const { data } = await supabase.from('participant_entry_profiles').select(ENTRY_PROFILE_COLUMNS).eq('participant_id', participantId);
  return ((data ?? []) as unknown as ProfileRow[]).map(toEntryProfile);
}

/** Vrai si l'utilisateur peut lire et saisir les fiches d'entrée (hors participant pour lui-même). */
export function canManageEntryProfiles(user: CurrentUser) {
  return user.role === 'admin' || (user.role === 'organisme' && user.organization?.status === 'active' && hasPermission(user, 'org.entry_profile.manage'));
}

/**
 * Indicateurs et exports FSE+ : administrateur ; organisme avec la fiche d'entrée ET la lecture
 * des situations (org.impact.read), sinon les sorties seraient faussement « non renseignées ».
 */
export function canReadFse(user: CurrentUser) {
  return user.role === 'admin' || (canManageEntryProfiles(user) && hasPermission(user, 'org.impact.read'));
}

export async function loadFseDataset(supabase: ServerClient, organizationId: string | null): Promise<FseDataset> {
  const groupRows = await fetchAll((from, to) =>
    supabase
      .from('groups')
      .select('id, name, status, start_date, end_date, program_id, organization_id, programs ( name ), organizations ( name )')
      .order('start_date', { ascending: false })
      .range(from, to),
  );
  const memberRows = await inChunks(
    groupRows.map((group) => group.id),
    (chunk, from, to) =>
      supabase.from('group_members').select('group_id, participant_id, status, drop_reason, dropped_at').in('group_id', chunk).neq('status', 'removed').range(from, to),
  );
  const participantRows = await inChunks(
    memberRows.map((row) => row.participant_id),
    (chunk, from, to) => supabase.from('participants').select('id, first_name, last_name, organization_id, organizations ( name )').in('id', chunk).range(from, to),
  );
  // Défense en profondeur : l'espace organisme ne compte que les participants de la structure.
  const participants = organizationId ? participantRows.filter((row) => row.organization_id === organizationId) : participantRows;
  const participantIds = participants.map((row) => row.id);
  const visible = new Set(participantIds);
  const memberships = memberRows.filter((row) => visible.has(row.participant_id));
  const usedGroups = new Set(memberships.map((row) => row.group_id));
  const groups = groupRows.filter((group) => usedGroups.has(group.id));

  const [sessions, outcomes, profiles] = await Promise.all([
    inChunks(
      groups.map((group) => group.id),
      (chunk, from, to) => supabase.from('sessions').select('id, group_id, status, scheduled_date, number').in('group_id', chunk).range(from, to),
    ),
    inChunks(participantIds, (chunk, from, to) =>
      supabase.from('participant_outcomes').select('participant_id, group_id, kind, situation, observed_on, qualification_obtained').in('participant_id', chunk).range(from, to),
    ),
    inChunks(participantIds, (chunk, from, to) => supabase.from('participant_entry_profiles').select(ENTRY_PROFILE_COLUMNS).in('participant_id', chunk).range(from, to)),
  ]);

  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      programId: group.program_id,
      programName: firstOf(group.programs)?.name ?? '',
      organizationId: group.organization_id,
      organizationName: firstOf(group.organizations)?.name ?? null,
      startDate: group.start_date,
      endDate: group.end_date,
      status: group.status,
    })),
    participants: participants.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      organizationId: row.organization_id,
      organizationName: firstOf(row.organizations)?.name ?? null,
    })),
    memberships: memberships.map((row) => ({ groupId: row.group_id, participantId: row.participant_id, status: row.status, dropReason: row.drop_reason, droppedAt: row.dropped_at })),
    sessions: sessions.map((row) => ({ id: row.id, groupId: row.group_id, status: row.status, date: row.scheduled_date, number: row.number })),
    outcomes: outcomes.map((row) => ({
      participantId: row.participant_id,
      groupId: row.group_id,
      kind: row.kind,
      situation: row.situation,
      observedOn: row.observed_on,
      qualificationObtained: row.qualification_obtained,
    })),
    profiles: (profiles as unknown as ProfileRow[]).map((row) => {
      const profile = toEntryProfile(row);
      return { ...profile, participantId: profile.participantId, groupId: profile.groupId };
    }),
  };
}

export type FseAccess = {
  report: FseReport;
  filters: FseFilters;
  programs: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
};

/** Rapport FSE+ selon le rôle : administrateur (tout, filtre organisme possible) ; organisme (ses participants). */
export async function loadFseFor(user: CurrentUser, rawFilters: FseFilters): Promise<FseAccess | null> {
  if (!canReadFse(user)) return null;
  const supabase = await createClient();
  const organizationId = user.role === 'organisme' ? user.organization!.id : null;
  const filters: FseFilters = { ...rawFilters, organizationId: organizationId ?? rawFilters.organizationId ?? null };
  const dataset = await loadFseDataset(supabase, organizationId);
  const programs = new Map(dataset.groups.map((group) => [group.programId, group.programName]));
  const organizations = new Map(
    dataset.participants.filter((participant) => participant.organizationId).map((participant) => [participant.organizationId!, participant.organizationName ?? '']),
  );
  return {
    report: buildFseReport(dataset, filters, todayIso()),
    filters,
    programs: [...programs].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    organizations: [...organizations].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export type ParticipantGroup = { id: string; name: string; status: string };

/** Groupes d'un participant (inscrits et abandons ; les retraits sont exclus), du plus récent au plus ancien. */
export async function loadParticipantGroups(supabase: ServerClient, participantId: string): Promise<ParticipantGroup[]> {
  const { data } = await supabase
    .from('group_members')
    .select('group_id, status, joined_at, groups ( name )')
    .eq('participant_id', participantId)
    .in('status', ['active', 'dropped'])
    .order('joined_at', { ascending: false });
  return (data ?? []).map((row) => ({ id: row.group_id, name: firstOf(row.groups)?.name ?? 'Groupe', status: row.status }));
}
