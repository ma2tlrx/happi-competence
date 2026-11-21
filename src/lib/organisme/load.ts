import 'server-only';

import { parisDate } from '@/lib/attendance/signature';
import { completedJourneys } from '@/lib/engagement/milestones';
import { attendanceRate } from '@/lib/evaluation-engine';
import { fetchAll, inChunks } from '@/lib/outcomes/load';
import type { ServerClient } from '@/lib/supabase/server';
import { firstOf } from '@/lib/utils';

import {
  countToRelaunch,
  followupState,
  groupBucket,
  nextSession,
  presenceTrail,
  revealedSkillCounts,
  sortMembers,
  type FollowupState,
  type GroupBucket,
  type OrgSession,
  type PresenceEntry,
} from './groups';

/**
 * Lectures de l'espace organisme « Mes groupes ». Tout passe par la session de l'utilisateur : RLS limite
 * les groupes à ceux de la structure (ou qui accueillent ses participants), les membres aux personnes de la
 * structure, les présences à la permission « org.attendance.read », les évaluations à « org.evaluations.read ».
 */

export type Access = { attendance: boolean; evaluations: boolean };

export type SessionView = OrgSession & { title: string | null; startTime: string | null; endTime: string | null; location: string | null };

export type MemberView = {
  participantId: string;
  firstName: string;
  lastName: string;
  membership: 'active' | 'dropped';
  /** Une case par séance terminée (vide sans accès aux présences). */
  presence: PresenceEntry[];
  followup: FollowupState;
  /** Compétences révélées ; null sans accès aux évaluations. */
  revealed: number | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  programName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  bucket: GroupBucket;
  trainers: string[];
  /** Personnes de la structure inscrites (hors parcours interrompus). */
  members: number;
  totalSessions: number;
  completedSessions: number;
  /** Présence aux séances terminées (retards et départs anticipés inclus) ; null sans donnée ou sans accès. */
  attendanceRate: number | null;
  next: SessionView | null;
  nextDate: string | null;
  toRelaunch: number;
};

export type GroupDetail = GroupSummary & { sessions: SessionView[]; people: MemberView[]; hidden: number };

const GROUP_COLUMNS = 'id, name, status, start_date, end_date, programs ( name, sessions_count )' as const;

type GroupRow = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  programs: { name: string; sessions_count: number } | { name: string; sessions_count: number }[] | null;
};

const key = (participantId: string, sessionId: string) => `${participantId}:${sessionId}`;

function groupMap<T, K extends string>(rows: readonly T[], pick: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const row of rows) map.set(pick(row), [...(map.get(pick(row)) ?? []), row]);
  return map;
}

/** Membres, séances, formateurs, présences et relances des groupes indiqués, assemblés par groupe. */
async function assemble(supabase: ServerClient, groups: GroupRow[], access: Access) {
  const ids = groups.map((group) => group.id);
  const [memberRows, sessionRows, trainerRows] = await Promise.all([
    inChunks(ids, (chunk, from, to) =>
      supabase
        .from('group_members')
        .select('group_id, participant_id, status, participants ( id, first_name, last_name )')
        .in('group_id', chunk)
        .in('status', ['active', 'dropped'])
        .order('joined_at')
        .range(from, to),
    ),
    inChunks(ids, (chunk, from, to) =>
      supabase
        .from('sessions')
        .select('id, group_id, number, status, scheduled_date, start_time, end_time, location, program_sessions ( title )')
        .in('group_id', chunk)
        .order('number')
        .range(from, to),
    ),
    inChunks(ids, (chunk, from, to) => supabase.from('group_trainers').select('group_id, trainer_id, is_lead').in('group_id', chunk).range(from, to)),
  ]);

  const completedIds = sessionRows.filter((row) => row.status === 'completed').map((row) => row.id);
  const trainerIds = [...new Set(trainerRows.map((row) => row.trainer_id))];
  const [staff, attendance, followups] = await Promise.all([
    trainerIds.length ? inChunks(trainerIds, (chunk, from, to) => supabase.from('staff_directory').select('id, first_name, last_name').in('id', chunk).range(from, to)) : [],
    // Sans accès aux présences, personne n'est « à relancer » : ni présences ni relances à lire.
    access.attendance && completedIds.length
      ? inChunks(completedIds, (chunk, from, to) => supabase.from('attendance').select('session_id, participant_id, status').in('session_id', chunk).range(from, to))
      : [],
    access.attendance && completedIds.length
      ? inChunks(completedIds, (chunk, from, to) => supabase.from('absence_followups').select('session_id, participant_id, created_at').in('session_id', chunk).range(from, to))
      : [],
  ]);

  const staffName = new Map(staff.map((person) => [person.id, `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()]));
  const statusByKey = new Map(attendance.map((row) => [key(row.participant_id, row.session_id), row.status]));
  const followupByKey = new Map(followups.map((row) => [key(row.participant_id, row.session_id), row.created_at]));
  const membersByGroup = groupMap(memberRows, (row) => row.group_id);
  const sessionsByGroup = groupMap(sessionRows, (row) => row.group_id);
  const trainersByGroup = groupMap(trainerRows, (row) => row.group_id);
  const today = parisDate();

  return groups.map((group) => {
    const program = firstOf(group.programs);
    const sessions: SessionView[] = (sessionsByGroup.get(group.id) ?? []).map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      date: row.scheduled_date,
      title: firstOf(row.program_sessions)?.title ?? null,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
    }));
    let hidden = 0;
    const people: MemberView[] = [];
    const statuses: string[] = [];
    for (const member of membersByGroup.get(group.id) ?? []) {
      const person = firstOf(member.participants);
      // Fiche non lisible par la structure : la personne n'est pas affichée (seul le nombre est indiqué).
      if (!person) {
        hidden += 1;
        continue;
      }
      const statusBySession = new Map<string, string>();
      const followupBySession = new Map<string, string>();
      for (const session of sessions) {
        const status = statusByKey.get(key(person.id, session.id));
        if (status && session.status === 'completed') {
          statusBySession.set(session.id, status);
          statuses.push(status);
        }
        const at = followupByKey.get(key(person.id, session.id));
        if (at) followupBySession.set(session.id, at);
      }
      const membership = member.status === 'dropped' ? 'dropped' : 'active';
      people.push({
        participantId: person.id,
        firstName: person.first_name,
        lastName: person.last_name,
        membership,
        presence: access.attendance ? presenceTrail(sessions, statusBySession) : [],
        followup: access.attendance
          ? followupState({ membership, sessions, statusBySession, followups: followupBySession })
          : membership === 'dropped'
            ? { kind: 'dropped' }
            : { kind: 'none' },
        revealed: null,
      });
    }
    const trainers = [...(trainersByGroup.get(group.id) ?? [])]
      .sort((a, b) => Number(b.is_lead) - Number(a.is_lead))
      .map((row) => staffName.get(row.trainer_id))
      .filter((name): name is string => Boolean(name));
    const totalSessions = program?.sessions_count ?? sessions.length;
    const next = nextSession(sessions, today);
    const summary: GroupSummary = {
      id: group.id,
      name: group.name,
      programName: program?.name ?? '',
      status: group.status,
      startDate: group.start_date,
      endDate: group.end_date,
      bucket: groupBucket({ status: group.status, startDate: group.start_date, endDate: group.end_date, totalSessions }, sessions, today),
      trainers,
      members: people.filter((person) => person.membership === 'active').length,
      totalSessions,
      completedSessions: sessions.filter((session) => session.status === 'completed').length,
      attendanceRate: access.attendance ? attendanceRate(statuses) : null,
      next,
      nextDate: next?.date ?? null,
      toRelaunch: countToRelaunch(people.map((person) => person.followup)),
    };
    return { summary, sessions, people, hidden };
  });
}

/** Accueil « Mes groupes » : une carte par groupe et trois jalons de la structure. */
export async function loadMyGroups(supabase: ServerClient, access: Access) {
  const [groups, participants] = await Promise.all([
    fetchAll((from, to) => supabase.from('groups').select(GROUP_COLUMNS).order('start_date', { ascending: false }).order('id').range(from, to)),
    supabase.from('participants').select('id', { count: 'exact', head: true }),
  ]);
  const assembled = await assemble(supabase, groups, access);
  const memberships = assembled.flatMap(({ summary, people }) =>
    people.map((person) => ({ dropped: person.membership === 'dropped', completedSessions: summary.completedSessions, totalSessions: summary.totalSessions, groupId: summary.id })),
  );
  return {
    groups: assembled.map(({ summary }) => summary),
    stats: {
      people: participants.count ?? 0,
      completedSessions: assembled.reduce((total, { summary }) => total + summary.completedSessions, 0),
      completedJourneys: completedJourneys(memberships),
    },
  };
}

/** Page d'un groupe : en-tête, séances et membres de la structure. Null si le groupe n'est pas visible (RLS). */
export async function loadGroupDetail(supabase: ServerClient, groupId: string, access: Access): Promise<GroupDetail | null> {
  const { data: group } = await supabase.from('groups').select(GROUP_COLUMNS).eq('id', groupId).maybeSingle();
  if (!group) return null;
  const [{ summary, sessions, people, hidden }] = await assemble(supabase, [group], access);
  let revealed = new Map<string, number>();
  if (access.evaluations && people.length) {
    const evaluations = await inChunks(
      people.map((person) => person.participantId),
      (chunk, from, to) =>
        supabase
          .from('evaluations')
          .select('participant_id, evaluation_scores ( skill_id, score, skills ( code, framework_versions ( frameworks ( code ) ) ) )')
          .in('participant_id', chunk)
          .eq('status', 'validated')
          .range(from, to),
    );
    revealed = revealedSkillCounts(
      evaluations.flatMap((evaluation) =>
        evaluation.evaluation_scores.map((score) => {
          const skill = firstOf(score.skills);
          const framework = firstOf(firstOf(skill?.framework_versions)?.frameworks);
          // Clé stable (référentiel + code) : une compétence observée sous deux versions ne compte qu'une fois.
          const skillKey = skill ? `${framework?.code ?? ''}:${skill.code}` : score.skill_id;
          return { participantId: evaluation.participant_id, skillKey, score: score.score === null ? null : Number(score.score) };
        }),
      ),
    );
  }
  return {
    ...summary,
    sessions: [...sessions].sort((a, b) => a.number - b.number),
    people: sortMembers(people).map((person) => ({ ...person, revealed: access.evaluations ? (revealed.get(person.participantId) ?? 0) : null })),
    hidden,
  };
}
