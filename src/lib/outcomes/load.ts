import 'server-only';

import type { Passport } from '@/lib/passport';
import type { ServerClient } from '@/lib/supabase/server';
import { firstOf } from '@/lib/utils';

import { dropoutAlerts, type DropoutAlert } from './dropout';
import type { ImpactDataset, ImpactGroup } from './impact';
import { followupTasks, type FollowupTask } from './schedule';

/**
 * Lectures du tableau de bord d'impact, de l'échéancier et des alertes. Tout passe par la session
 * de l'utilisateur : RLS limite les lignes (formateur : ses groupes ; organisme : ses participants).
 * Les listes longues sont lues par pages (PostgREST plafonne une réponse à 1 000 lignes) et les
 * filtres « in » par lots, pour ne pas dépasser la longueur d'une URL.
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
  const results = await Promise.all(chunks.map((chunk) => fetchAll((from, to) => build(chunk, from, to))));
  return results.flat();
}

export type ImpactScope = {
  /** Restreint aux participants rattachés à cet organisme (espace organisme). */
  organizationId?: string | null;
  /** Restreint à ces groupes (espace formateur). */
  groupIds?: string[];
};

export async function loadImpactDataset(supabase: ServerClient, scope: ImpactScope = {}): Promise<ImpactDataset> {
  const groupRows = await fetchAll((from, to) => {
    let query = supabase
      .from('groups')
      .select('id, name, status, start_date, end_date, program_id, organization_id, programs ( name ), organizations ( name )')
      .order('start_date', { ascending: false })
      .range(from, to);
    if (scope.groupIds) query = query.in('id', scope.groupIds.length ? scope.groupIds : ['00000000-0000-0000-0000-000000000000']);
    return query;
  });
  const groupIds = groupRows.map((group) => group.id);

  const memberRows = await inChunks(groupIds, (chunk, from, to) =>
    supabase.from('group_members').select('group_id, participant_id, status, drop_reason, dropped_at').in('group_id', chunk).neq('status', 'removed').range(from, to),
  );
  const participantRows = await inChunks(
    memberRows.map((row) => row.participant_id),
    (chunk, from, to) => supabase.from('participants').select('id, first_name, last_name, organization_id, organizations ( name )').in('id', chunk).range(from, to),
  );
  // Défense en profondeur : l'espace organisme ne compte que les participants de la structure.
  const participants = scope.organizationId ? participantRows.filter((row) => row.organization_id === scope.organizationId) : participantRows;
  const participantIds = participants.map((row) => row.id);
  const visible = new Set(participantIds);
  const memberships = memberRows.filter((row) => visible.has(row.participant_id));
  const usedGroups = scope.organizationId ? new Set(memberships.map((row) => row.group_id)) : null;
  const groups = usedGroups ? groupRows.filter((group) => usedGroups.has(group.id)) : groupRows;

  const [sessions, attendance, evaluations, outcomes] = await Promise.all([
    inChunks(groups.map((group) => group.id), (chunk, from, to) =>
      supabase.from('sessions').select('id, group_id, status, scheduled_date, number').in('group_id', chunk).range(from, to),
    ),
    inChunks(participantIds, (chunk, from, to) => supabase.from('attendance').select('session_id, participant_id, status').in('participant_id', chunk).range(from, to)),
    inChunks(participantIds, (chunk, from, to) =>
      supabase
        .from('evaluations')
        .select('session_id, participant_id, evaluation_scores ( skill_id, score )')
        .in('participant_id', chunk)
        .eq('status', 'validated')
        .range(from, to),
    ),
    inChunks(participantIds, (chunk, from, to) =>
      supabase.from('participant_outcomes').select('participant_id, group_id, kind, situation').in('participant_id', chunk).range(from, to),
    ),
  ]);

  return {
    groups: groups.map(
      (group): ImpactGroup => ({
        id: group.id,
        name: group.name,
        programId: group.program_id,
        programName: firstOf(group.programs)?.name ?? '',
        organizationId: group.organization_id,
        organizationName: firstOf(group.organizations)?.name ?? null,
        startDate: group.start_date,
        endDate: group.end_date,
        status: group.status,
      }),
    ),
    participants: participants.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      organizationId: row.organization_id,
      organizationName: firstOf(row.organizations)?.name ?? null,
    })),
    memberships: memberships.map((row) => ({
      groupId: row.group_id,
      participantId: row.participant_id,
      status: row.status,
      dropReason: row.drop_reason,
      droppedAt: row.dropped_at,
    })),
    sessions: sessions.map((row) => ({ id: row.id, groupId: row.group_id, status: row.status, date: row.scheduled_date, number: row.number })),
    attendance: attendance.map((row) => ({ sessionId: row.session_id, participantId: row.participant_id, status: row.status })),
    observations: evaluations.flatMap((evaluation) =>
      (evaluation.evaluation_scores ?? [])
        .filter((score) => score.score !== null)
        .map((score) => ({ participantId: evaluation.participant_id, sessionId: evaluation.session_id, skillId: score.skill_id, score: Number(score.score) })),
    ),
    outcomes: outcomes.map((row) => ({ participantId: row.participant_id, groupId: row.group_id, kind: row.kind, situation: row.situation })),
  };
}

export type OutcomeRecord = { id: string; participantId: string; groupId: string | null; kind: string; situation: string; details: string | null; observedOn: string; updatedAt: string };

export type FollowupItem = FollowupTask & { participantName: string; organizationName: string | null; outcome: OutcomeRecord | null };

/** Suivis à faire (sortie, 3 mois, 6 mois) sur le périmètre donné, avec la saisie existante. */
export async function loadFollowups(supabase: ServerClient, scope: ImpactScope, today: string): Promise<FollowupItem[]> {
  const dataset = await loadImpactDataset(supabase, scope);
  const participantIds = dataset.participants.map((participant) => participant.id);
  const records = await inChunks(participantIds, (chunk, from, to) =>
    supabase.from('participant_outcomes').select('id, participant_id, group_id, kind, situation, details, observed_on, updated_at').in('participant_id', chunk).range(from, to),
  );
  const recordByKey = new Map(
    records.map((row) => [
      `${row.participant_id}:${row.group_id ?? ''}:${row.kind}`,
      { id: row.id, participantId: row.participant_id, groupId: row.group_id, kind: row.kind, situation: row.situation, details: row.details, observedOn: row.observed_on, updatedAt: row.updated_at },
    ]),
  );
  const lastSession = new Map<string, string>();
  for (const session of dataset.sessions) {
    if (session.status === 'completed' && session.date && session.date > (lastSession.get(session.groupId) ?? '')) lastSession.set(session.groupId, session.date);
  }
  const tasks = followupTasks(
    dataset.memberships,
    dataset.groups.map((group) => ({ id: group.id, name: group.name, status: group.status, endDate: group.endDate, lastCompletedSessionDate: lastSession.get(group.id) ?? null })),
    dataset.outcomes,
    today,
  );
  const participantById = new Map(dataset.participants.map((participant) => [participant.id, participant]));
  return tasks.map((task) => {
    const participant = participantById.get(task.participantId);
    return {
      ...task,
      participantName: participant ? `${participant.lastName.toUpperCase()} ${participant.firstName}` : 'Participant',
      organizationName: participant?.organizationName ?? null,
      outcome: recordByKey.get(`${task.participantId}:${task.groupId}:${task.kind}`) ?? null,
    };
  });
}

export type NamedDropoutAlert = DropoutAlert & { participantName: string; groupId: string; groupName: string };

/** Alertes de décrochage des participants actifs des groupes donnés (calcul à la volée). */
export async function loadDropoutAlerts(supabase: ServerClient, groupIds: string[]): Promise<NamedDropoutAlert[]> {
  if (groupIds.length === 0) return [];
  const [groups, members, sessions] = await Promise.all([
    inChunks(groupIds, (chunk, from, to) => supabase.from('groups').select('id, name').in('id', chunk).range(from, to)),
    inChunks(groupIds, (chunk, from, to) =>
      supabase.from('group_members').select('group_id, participant_id, participants ( first_name, last_name )').in('group_id', chunk).eq('status', 'active').range(from, to),
    ),
    inChunks(groupIds, (chunk, from, to) => supabase.from('sessions').select('id, group_id, status, scheduled_date, number').in('group_id', chunk).eq('status', 'completed').range(from, to)),
  ]);
  const attendance = await inChunks(
    sessions.map((session) => session.id),
    (chunk, from, to) => supabase.from('attendance').select('session_id, participant_id, status').in('session_id', chunk).range(from, to),
  );
  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const alerts: NamedDropoutAlert[] = [];
  for (const groupId of groupIds) {
    const groupMembers = members.filter((member) => member.group_id === groupId);
    const groupSessions = sessions.filter((session) => session.group_id === groupId);
    const ids = new Set(groupSessions.map((session) => session.id));
    const result = dropoutAlerts(
      groupMembers.map((member) => member.participant_id),
      groupSessions.map((session) => ({ id: session.id, status: session.status, date: session.scheduled_date, number: session.number })),
      attendance.filter((row) => ids.has(row.session_id)).map((row) => ({ sessionId: row.session_id, participantId: row.participant_id, status: row.status })),
    );
    for (const alert of result) {
      const person = firstOf(groupMembers.find((member) => member.participant_id === alert.participantId)?.participants);
      alerts.push({
        ...alert,
        participantName: person ? `${person.first_name} ${person.last_name}` : 'Participant',
        groupId,
        groupName: groupName.get(groupId) ?? '',
      });
    }
  }
  return alerts;
}

/** Situations enregistrées d'un participant (toutes cohortes), pour sa fiche. */
export async function loadParticipantOutcomes(supabase: ServerClient, participantId: string): Promise<OutcomeRecord[]> {
  const { data } = await supabase
    .from('participant_outcomes')
    .select('id, participant_id, group_id, kind, situation, details, observed_on, updated_at')
    .eq('participant_id', participantId);
  return (data ?? []).map((row) => ({
    id: row.id,
    participantId: row.participant_id,
    groupId: row.group_id,
    kind: row.kind,
    situation: row.situation,
    details: row.details,
    observedOn: row.observed_on,
    updatedAt: row.updated_at,
  }));
}

/** Groupes d'un participant (groupe de référence puis précédents), avec le statut d'inscription. */
export function participantGroups(passport: Pick<Passport, 'group' | 'otherGroups'>) {
  return [
    ...(passport.group ? [{ id: passport.group.id, name: passport.group.name, status: passport.group.dropped ? 'dropped' : 'active' }] : []),
    ...passport.otherGroups,
  ];
}
