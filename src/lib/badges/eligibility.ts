import 'server-only';

import { computeRealisation } from '@/lib/attendance/hours';
import type { ServerClient } from '@/lib/supabase/server';

import { skillKey, type MembershipFacts } from './rules';

/**
 * Faits mesurés par participant et par groupe, pour les règles d'attribution des badges.
 * Lu avec la session de l'administrateur (RLS). Les listes longues sont lues par pages
 * (PostgREST plafonne une réponse à 1 000 lignes) et les filtres « in » par lots.
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

export type Membership = {
  participantId: string;
  firstName: string;
  lastName: string;
  groupId: string;
  groupName: string;
  facts: MembershipFacts;
};

export type SkillOption = { key: string; frameworkCode: string; frameworkName: string; skillCode: string; name: string };

/** Compétences des versions publiées, une entrée par code stable (référentiel:compétence). */
export async function loadSkillOptions(supabase: ServerClient): Promise<SkillOption[]> {
  const rows = await fetchAll((from, to) =>
    supabase.from('skills').select('code, name, framework_versions!inner ( status, frameworks ( code, name ) )').eq('framework_versions.status', 'published').range(from, to),
  );
  const options = new Map<string, SkillOption>();
  for (const row of rows) {
    const framework = row.framework_versions?.frameworks;
    if (!framework) continue;
    const key = skillKey(framework.code, row.code);
    if (!options.has(key)) options.set(key, { key, frameworkCode: framework.code, frameworkName: framework.name, skillCode: row.code, name: row.name });
  }
  return [...options.values()].sort((a, b) => a.frameworkName.localeCompare(b.frameworkName, 'fr') || a.name.localeCompare(b.name, 'fr'));
}

export async function loadMemberships(supabase: ServerClient, filter: { participantId?: string } = {}): Promise<Membership[]> {
  const members = await fetchAll((from, to) => {
    let query = supabase
      .from('group_members')
      .select('group_id, participant_id, participants ( first_name, last_name ), groups ( name, status, programs ( sessions_count, session_duration_minutes ) )')
      .eq('status', 'active');
    if (filter.participantId) query = query.eq('participant_id', filter.participantId);
    return query.order('joined_at').range(from, to);
  });
  if (members.length === 0) return [];

  const sessions = await inChunks(
    members.map((member) => member.group_id),
    (chunk, from, to) => supabase.from('sessions').select('id, group_id, number, status, scheduled_date, start_time, end_time').in('group_id', chunk).range(from, to),
  );
  const sessionIds = sessions.map((session) => session.id);
  const [attendance, evaluations, skills] = await Promise.all([
    inChunks(sessionIds, (chunk, from, to) => supabase.from('attendance').select('session_id, participant_id, status').in('session_id', chunk).range(from, to)),
    inChunks(sessionIds, (chunk, from, to) =>
      supabase.from('evaluations').select('session_id, participant_id, evaluation_scores ( skill_id, score )').eq('status', 'validated').in('session_id', chunk).range(from, to),
    ),
    fetchAll((from, to) => supabase.from('skills').select('id, code, framework_versions ( frameworks ( code ) )').range(from, to)),
  ]);

  const keyOfSkill = new Map(skills.map((skill) => [skill.id, skill.framework_versions?.frameworks ? skillKey(skill.framework_versions.frameworks.code, skill.code) : null]));
  const sessionsOf = new Map<string, typeof sessions>();
  const groupOfSession = new Map<string, string>();
  for (const session of sessions) {
    sessionsOf.set(session.group_id, [...(sessionsOf.get(session.group_id) ?? []), session]);
    groupOfSession.set(session.id, session.group_id);
  }
  const attendanceOf = new Map<string, Map<string, string>>();
  for (const row of attendance) {
    const key = `${row.participant_id}|${groupOfSession.get(row.session_id)}`;
    if (!attendanceOf.has(key)) attendanceOf.set(key, new Map());
    attendanceOf.get(key)!.set(row.session_id, row.status);
  }
  const scoresOf = new Map<string, Record<string, number[]>>();
  for (const evaluation of evaluations) {
    const key = `${evaluation.participant_id}|${groupOfSession.get(evaluation.session_id)}`;
    const scores = scoresOf.get(key) ?? {};
    for (const score of evaluation.evaluation_scores) {
      const skill = keyOfSkill.get(score.skill_id);
      if (!skill || score.score === null) continue;
      (scores[skill] ??= []).push(Number(score.score));
    }
    scoresOf.set(key, scores);
  }

  return members
    .filter((member) => member.participants && member.groups)
    .map((member) => {
      const key = `${member.participant_id}|${member.group_id}`;
      const realisation = computeRealisation({
        sessions: (sessionsOf.get(member.group_id) ?? []).map((session) => ({
          id: session.id,
          number: session.number,
          status: session.status,
          scheduledDate: session.scheduled_date,
          startTime: session.start_time,
          endTime: session.end_time,
        })),
        attendance: attendanceOf.get(key) ?? new Map(),
        programMinutes: member.groups!.programs?.session_duration_minutes ?? null,
        programSessionsCount: member.groups!.programs?.sessions_count ?? null,
      });
      return {
        participantId: member.participant_id,
        firstName: member.participants!.first_name,
        lastName: member.participants!.last_name,
        groupId: member.group_id,
        groupName: member.groups!.name,
        facts: {
          realisedMinutes: realisation.realisedMinutes,
          plannedSessions: realisation.plannedSessions,
          completedSessions: realisation.completedSessions,
          groupCompleted: member.groups!.status === 'completed',
          skillScores: scoresOf.get(key) ?? {},
        },
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr') || a.groupName.localeCompare(b.groupName, 'fr'));
}
