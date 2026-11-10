import 'server-only';

import { attendanceRate } from '@/lib/evaluation-engine';
import type { ServerClient } from '@/lib/supabase/server';

export type OrgParticipantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  hasAccount: boolean;
  groupId: string | null;
  groupName: string | null;
  programName: string | null;
  joinedAt: string | null;
  completedSessions: number;
  totalSessions: number;
  attended: number;
  attendanceRate: number | null;
  evaluated: number;
};

/**
 * Vue d'ensemble d'un organisme. Toutes les lectures se font avec la session de
 * l'utilisateur : RLS limite d'office les données à la structure de l'appelant.
 */
export async function getOrganizationOverview(supabase: ServerClient) {
  const [participantsResult, groupsResult] = await Promise.all([
    supabase.from('participants').select('id, first_name, last_name, email, user_id, created_at').order('last_name'),
    supabase.from('groups').select('id, name, status, start_date, end_date, programs ( id, name, sessions_count ), organizations ( name )').order('start_date', { ascending: false }),
  ]);
  const groups = groupsResult.data ?? [];
  const groupIds = groups.map((group) => group.id);
  const participantIds = (participantsResult.data ?? []).map((participant) => participant.id);

  const [membersResult, sessionsResult, attendanceResult, evaluationsResult] = await Promise.all([
    participantIds.length
      ? supabase.from('group_members').select('group_id, participant_id, status, joined_at').in('participant_id', participantIds)
      : Promise.resolve({ data: [] as { group_id: string; participant_id: string; status: string; joined_at: string }[] }),
    groupIds.length
      ? supabase.from('sessions').select('id, group_id, number, status, scheduled_date, start_time, end_time, location, program_sessions ( title )').in('group_id', groupIds).order('scheduled_date')
      : Promise.resolve({ data: [] }),
    participantIds.length ? supabase.from('attendance').select('session_id, participant_id, status').in('participant_id', participantIds) : Promise.resolve({ data: [] }),
    participantIds.length ? supabase.from('evaluations').select('participant_id, session_id').in('participant_id', participantIds).eq('status', 'validated') : Promise.resolve({ data: [] }),
  ]);

  const sessions = sessionsResult.data ?? [];
  const attendance = attendanceResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const participants: OrgParticipantRow[] = (participantsResult.data ?? []).map((participant) => {
    const membership = (membersResult.data ?? []).filter((m) => m.participant_id === participant.id).sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1))[0];
    const group = membership ? groupById.get(membership.group_id) : undefined;
    const groupSessions = group ? sessions.filter((session) => session.group_id === group.id) : [];
    const completed = groupSessions.filter((session) => session.status === 'completed');
    const statuses = attendance.filter((row) => row.participant_id === participant.id && completed.some((session) => session.id === row.session_id)).map((row) => row.status);
    return {
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      email: participant.email,
      hasAccount: Boolean(participant.user_id),
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      programName: group?.programs?.name ?? null,
      joinedAt: membership?.joined_at ?? participant.created_at,
      completedSessions: completed.length,
      totalSessions: group?.programs?.sessions_count ?? groupSessions.length,
      attended: statuses.filter((status) => ['present', 'late', 'left_early'].includes(status)).length,
      attendanceRate: completed.length ? ((statuses.filter((status) => ['present', 'late', 'left_early'].includes(status)).length) / completed.length) * 100 : null,
      evaluated: evaluations.filter((row) => row.participant_id === participant.id).length,
    };
  });

  const completedSessionIds = new Set(sessions.filter((session) => session.status === 'completed').map((session) => session.id));
  const globalRate = attendanceRate(attendance.filter((row) => completedSessionIds.has(row.session_id)).map((row) => row.status));
  const today = new Date().toISOString().slice(0, 10);

  return {
    participants,
    groups: groups.map((group) => {
      const groupSessions = sessions.filter((session) => session.group_id === group.id);
      return {
        id: group.id,
        name: group.name,
        status: group.status,
        startDate: group.start_date,
        endDate: group.end_date,
        programName: group.programs?.name ?? '',
        organizationName: group.organizations?.name ?? null,
        totalSessions: group.programs?.sessions_count ?? groupSessions.length,
        completedSessions: groupSessions.filter((session) => session.status === 'completed').length,
        participants: participants.filter((participant) => participant.groupId === group.id).length,
      };
    }),
    sessions: sessions.map((session) => ({
      id: session.id,
      groupId: session.group_id,
      groupName: groupById.get(session.group_id)?.name ?? '',
      number: session.number,
      title: session.program_sessions?.title ?? `Session ${session.number}`,
      status: session.status,
      date: session.scheduled_date,
      startTime: session.start_time,
      endTime: session.end_time,
      location: session.location,
    })),
    stats: {
      programs: new Set(groups.map((group) => group.programs?.id).filter(Boolean)).size,
      participants: participants.length,
      completedSessions: sessions.filter((session) => session.status === 'completed').length,
      upcomingSessions: sessions.filter((session) => (session.status === 'planned' || session.status === 'in_progress') && (!session.scheduled_date || session.scheduled_date >= today)).length,
      attendanceRate: globalRate,
    },
    attendance,
  };
}
